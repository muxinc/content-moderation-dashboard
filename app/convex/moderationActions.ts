"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

const MUX_BASE_URL = "https://api.mux.com";
const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_ATTEMPTS = 120; // 10 minutes at 5s intervals

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function muxAuthHeader(): string {
  const tokenId = requiredEnv("MUX_TOKEN_ID");
  const tokenSecret = requiredEnv("MUX_TOKEN_SECRET");
  return `Basic ${Buffer.from(`${tokenId}:${tokenSecret}`).toString("base64")}`;
}

// ─── Moderation job ───

export const runModeration = internalAction({
  args: {
    muxAssetId: v.string(),
    sexualThreshold: v.optional(v.number()),
    violenceThreshold: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.moderation.setProcessing, {
      muxAssetId: args.muxAssetId,
    });

    try {
      const resp = await fetch(`${MUX_BASE_URL}/robots/v1/jobs/moderate`, {
        method: "POST",
        headers: {
          Authorization: muxAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          parameters: {
            asset_id: args.muxAssetId,
            thresholds: {
              sexual: args.sexualThreshold ?? 0.7,
              violence: args.violenceThreshold ?? 0.8,
            },
          },
        }),
      });

      if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`Mux Robots API error (${resp.status}): ${body}`);
      }

      const data = await resp.json();
      const jobId = data.data.id as string;

      await ctx.runMutation(internal.moderation.setRobotsJobId, {
        muxAssetId: args.muxAssetId,
        robotsJobId: jobId,
      });

      await ctx.scheduler.runAfter(
        POLL_INTERVAL_MS,
        internal.moderationActions.pollModeration,
        { muxAssetId: args.muxAssetId, robotsJobId: jobId, attempt: 1 }
      );

      // Also kick off ask-questions if there are configured questions
      await ctx.scheduler.runAfter(0, internal.moderationActions.runAskQuestions, {
        muxAssetId: args.muxAssetId,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      await ctx.runMutation(internal.moderation.updateResult, {
        muxAssetId: args.muxAssetId,
        status: "failed",
        error: message,
      });
    }
  },
});

export const pollModeration = internalAction({
  args: {
    muxAssetId: v.string(),
    robotsJobId: v.string(),
    attempt: v.number(),
  },
  handler: async (ctx, args) => {
    try {
      const resp = await fetch(
        `${MUX_BASE_URL}/robots/v1/jobs/moderate/${args.robotsJobId}`,
        { headers: { Authorization: muxAuthHeader() } }
      );

      if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`Mux Robots poll error (${resp.status}): ${body}`);
      }

      const job = (await resp.json()).data;

      if (job.status === "completed") {
        const outputs = job.outputs;
        await ctx.runMutation(internal.moderation.updateResult, {
          muxAssetId: args.muxAssetId,
          status: "completed",
          exceedsThreshold: outputs.exceeds_threshold,
          maxScores: outputs.max_scores,
          thumbnailScores: outputs.thumbnail_scores.map(
            (s: { sexual: number; violence: number }) => ({
              sexual: s.sexual,
              violence: s.violence,
            })
          ),
          robotsJobId: args.robotsJobId,
        });
        return;
      }

      if (job.status === "errored") {
        const errMsg =
          job.errors?.map((e: { message: string }) => e.message).join("; ") ??
          "Unknown error";
        await ctx.runMutation(internal.moderation.updateResult, {
          muxAssetId: args.muxAssetId,
          status: "failed",
          error: errMsg,
          robotsJobId: args.robotsJobId,
        });
        return;
      }

      if (args.attempt >= MAX_POLL_ATTEMPTS) {
        await ctx.runMutation(internal.moderation.updateResult, {
          muxAssetId: args.muxAssetId,
          status: "failed",
          error: `Moderation job ${args.robotsJobId} timed out after ${args.attempt} poll attempts`,
          robotsJobId: args.robotsJobId,
        });
        return;
      }

      await ctx.scheduler.runAfter(
        POLL_INTERVAL_MS,
        internal.moderationActions.pollModeration,
        {
          muxAssetId: args.muxAssetId,
          robotsJobId: args.robotsJobId,
          attempt: args.attempt + 1,
        }
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      await ctx.runMutation(internal.moderation.updateResult, {
        muxAssetId: args.muxAssetId,
        status: "failed",
        error: message,
        robotsJobId: args.robotsJobId,
      });
    }
  },
});

// ─── Ask-questions job ───

export const runAskQuestions = internalAction({
  args: {
    muxAssetId: v.string(),
  },
  handler: async (ctx, args) => {
    // Fetch configured questions
    const questions = await ctx.runQuery(api.questions.list);
    if (questions.length === 0) return;

    try {
      const resp = await fetch(`${MUX_BASE_URL}/robots/v1/jobs/ask-questions`, {
        method: "POST",
        headers: {
          Authorization: muxAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          parameters: {
            asset_id: args.muxAssetId,
            questions: questions.map((q) => ({ question: q.question })),
            // Use default yes/no answer options
          },
        }),
      });

      if (!resp.ok) {
        const body = await resp.text();
        console.error(`Ask-questions API error (${resp.status}): ${body}`);
        return;
      }

      const data = await resp.json();
      const jobId = data.data.id as string;

      await ctx.runMutation(internal.moderation.setAskQuestionsJobId, {
        muxAssetId: args.muxAssetId,
        askQuestionsJobId: jobId,
      });

      await ctx.scheduler.runAfter(
        POLL_INTERVAL_MS,
        internal.moderationActions.pollAskQuestions,
        { muxAssetId: args.muxAssetId, jobId, attempt: 1 }
      );
    } catch (e: unknown) {
      console.error(`Ask-questions failed for ${args.muxAssetId}:`, e);
    }
  },
});

export const pollAskQuestions = internalAction({
  args: {
    muxAssetId: v.string(),
    jobId: v.string(),
    attempt: v.number(),
  },
  handler: async (ctx, args) => {
    try {
      const resp = await fetch(
        `${MUX_BASE_URL}/robots/v1/jobs/ask-questions/${args.jobId}`,
        { headers: { Authorization: muxAuthHeader() } }
      );

      if (!resp.ok) {
        console.error(`Ask-questions poll error (${resp.status})`);
        return;
      }

      const job = (await resp.json()).data;

      if (job.status === "completed") {
        const answers = job.outputs.answers.map(
          (a: {
            question: string;
            answer: string | null;
            confidence: number;
            reasoning: string;
            skipped: boolean;
          }) => ({
            question: a.question,
            answer: a.answer ?? undefined,
            confidence: a.confidence,
            reasoning: a.reasoning,
            skipped: a.skipped,
          })
        );

        await ctx.runMutation(internal.moderation.updateQuestionAnswers, {
          muxAssetId: args.muxAssetId,
          questionAnswers: answers,
          askQuestionsJobId: args.jobId,
        });
        return;
      }

      if (job.status === "errored") {
        console.error(`Ask-questions job errored for ${args.muxAssetId}`);
        return;
      }

      if (args.attempt >= MAX_POLL_ATTEMPTS) {
        console.error(`Ask-questions job timed out for ${args.muxAssetId}`);
        return;
      }

      await ctx.scheduler.runAfter(
        POLL_INTERVAL_MS,
        internal.moderationActions.pollAskQuestions,
        {
          muxAssetId: args.muxAssetId,
          jobId: args.jobId,
          attempt: args.attempt + 1,
        }
      );
    } catch (e: unknown) {
      console.error(`Ask-questions poll failed for ${args.muxAssetId}:`, e);
    }
  },
});

// ─── Public trigger ───

export const triggerModeration = action({
  args: {
    muxAssetId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.scheduler.runAfter(0, internal.moderationActions.runModeration, {
      muxAssetId: args.muxAssetId,
    });
  },
});
