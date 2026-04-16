"use node";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { authenticatedAction } from "./lib/auth";
const MUX_BASE_URL = "https://api.mux.com";
const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_ATTEMPTS = 120; // 10 minutes at 5s intervals
function requiredEnv(name) {
    const value = process.env[name];
    if (!value)
        throw new Error(`Missing env var: ${name}`);
    return value;
}
function muxAuthHeader() {
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
        skipAutoActions: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        await ctx.runMutation(internal.moderation.setProcessing, {
            muxAssetId: args.muxAssetId,
        });
        try {
            const resp = await fetch(`${MUX_BASE_URL}/robots/v0/jobs/moderate`, {
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
            const jobId = data.data.id;
            await ctx.runMutation(internal.moderation.setRobotsJobId, {
                muxAssetId: args.muxAssetId,
                robotsJobId: jobId,
            });
            await ctx.scheduler.runAfter(POLL_INTERVAL_MS, internal.moderationActions.pollModeration, {
                muxAssetId: args.muxAssetId,
                robotsJobId: jobId,
                attempt: 1,
                skipAutoActions: args.skipAutoActions,
            });
            // Also kick off ask-questions if there are configured questions.
            // Delay 1s to stagger Robots API calls (1 RPS limit).
            await ctx.scheduler.runAfter(1000, internal.moderationActions.runAskQuestions, {
                muxAssetId: args.muxAssetId,
                skipAutoActions: args.skipAutoActions,
            });
            // Kick off summarize job. Delay 2s to stay under 1 RPS.
            await ctx.scheduler.runAfter(2000, internal.moderationActions.runSummary, {
                muxAssetId: args.muxAssetId,
            });
        }
        catch (e) {
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
        skipAutoActions: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        try {
            const resp = await fetch(`${MUX_BASE_URL}/robots/v0/jobs/moderate/${args.robotsJobId}`, { headers: { Authorization: muxAuthHeader() } });
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
                    thumbnailScores: outputs.thumbnail_scores.map((s) => ({
                        sexual: s.sexual,
                        violence: s.violence,
                        time: s.time,
                    })),
                    robotsJobId: args.robotsJobId,
                });
                // Schedule auto-action coordinator
                await ctx.scheduler.runAfter(0, internal.moderation.applyAutoActions, {
                    muxAssetId: args.muxAssetId,
                    skipAutoActions: args.skipAutoActions,
                });
                return;
            }
            if (job.status === "errored") {
                const errMsg = job.errors?.map((e) => e.message).join("; ") ??
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
            await ctx.scheduler.runAfter(POLL_INTERVAL_MS, internal.moderationActions.pollModeration, {
                muxAssetId: args.muxAssetId,
                robotsJobId: args.robotsJobId,
                attempt: args.attempt + 1,
                skipAutoActions: args.skipAutoActions,
            });
        }
        catch (e) {
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
        skipAutoActions: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        // Fetch configured questions
        const questions = await ctx.runQuery(internal.questions.listInternal);
        if (questions.length === 0)
            return;
        // Mark Q&A as in-progress so the coordinator knows to wait
        await ctx.runMutation(internal.moderation.setAskQuestionsStatus, {
            muxAssetId: args.muxAssetId,
            askQuestionsStatus: "processing",
        });
        try {
            const resp = await fetch(`${MUX_BASE_URL}/robots/v0/jobs/ask-questions`, {
                method: "POST",
                headers: {
                    Authorization: muxAuthHeader(),
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    parameters: {
                        asset_id: args.muxAssetId,
                        questions: questions.map((q) => ({ question: q.question })),
                    },
                }),
            });
            if (!resp.ok) {
                const body = await resp.text();
                console.error(`Ask-questions API error (${resp.status}): ${body}`);
                await ctx.runMutation(internal.moderation.setAskQuestionsStatus, {
                    muxAssetId: args.muxAssetId,
                    askQuestionsStatus: "failed",
                });
                // Trigger coordinator since Q&A won't complete
                await ctx.scheduler.runAfter(0, internal.moderation.applyAutoActions, {
                    muxAssetId: args.muxAssetId,
                    skipAutoActions: args.skipAutoActions,
                });
                return;
            }
            const data = await resp.json();
            const jobId = data.data.id;
            await ctx.runMutation(internal.moderation.setAskQuestionsJobId, {
                muxAssetId: args.muxAssetId,
                askQuestionsJobId: jobId,
            });
            await ctx.scheduler.runAfter(POLL_INTERVAL_MS, internal.moderationActions.pollAskQuestions, {
                muxAssetId: args.muxAssetId,
                jobId,
                attempt: 1,
                skipAutoActions: args.skipAutoActions,
            });
        }
        catch (e) {
            console.error(`Ask-questions failed for ${args.muxAssetId}:`, e);
            await ctx.runMutation(internal.moderation.setAskQuestionsStatus, {
                muxAssetId: args.muxAssetId,
                askQuestionsStatus: "failed",
            });
            await ctx.scheduler.runAfter(0, internal.moderation.applyAutoActions, {
                muxAssetId: args.muxAssetId,
                skipAutoActions: args.skipAutoActions,
            });
        }
    },
});
export const pollAskQuestions = internalAction({
    args: {
        muxAssetId: v.string(),
        jobId: v.string(),
        attempt: v.number(),
        skipAutoActions: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        try {
            const resp = await fetch(`${MUX_BASE_URL}/robots/v0/jobs/ask-questions/${args.jobId}`, { headers: { Authorization: muxAuthHeader() } });
            if (!resp.ok) {
                console.error(`Ask-questions poll error (${resp.status})`);
                await ctx.runMutation(internal.moderation.setAskQuestionsStatus, {
                    muxAssetId: args.muxAssetId,
                    askQuestionsStatus: "failed",
                });
                await ctx.scheduler.runAfter(0, internal.moderation.applyAutoActions, {
                    muxAssetId: args.muxAssetId,
                    skipAutoActions: args.skipAutoActions,
                });
                return;
            }
            const job = (await resp.json()).data;
            if (job.status === "completed") {
                const answers = job.outputs.answers.map((a) => ({
                    question: a.question,
                    answer: a.answer ?? undefined,
                    confidence: a.confidence,
                    reasoning: a.reasoning,
                    skipped: a.skipped,
                }));
                await ctx.runMutation(internal.moderation.updateQuestionAnswers, {
                    muxAssetId: args.muxAssetId,
                    questionAnswers: answers,
                    askQuestionsJobId: args.jobId,
                });
                await ctx.runMutation(internal.moderation.setAskQuestionsStatus, {
                    muxAssetId: args.muxAssetId,
                    askQuestionsStatus: "completed",
                });
                // Schedule coordinator — Q&A answers are now available for bypass rules
                await ctx.scheduler.runAfter(0, internal.moderation.applyAutoActions, {
                    muxAssetId: args.muxAssetId,
                    skipAutoActions: args.skipAutoActions,
                });
                return;
            }
            if (job.status === "errored") {
                console.error(`Ask-questions job errored for ${args.muxAssetId}`);
                await ctx.runMutation(internal.moderation.setAskQuestionsStatus, {
                    muxAssetId: args.muxAssetId,
                    askQuestionsStatus: "failed",
                });
                await ctx.scheduler.runAfter(0, internal.moderation.applyAutoActions, {
                    muxAssetId: args.muxAssetId,
                    skipAutoActions: args.skipAutoActions,
                });
                return;
            }
            if (args.attempt >= MAX_POLL_ATTEMPTS) {
                console.error(`Ask-questions job timed out for ${args.muxAssetId}`);
                await ctx.runMutation(internal.moderation.setAskQuestionsStatus, {
                    muxAssetId: args.muxAssetId,
                    askQuestionsStatus: "failed",
                });
                await ctx.scheduler.runAfter(0, internal.moderation.applyAutoActions, {
                    muxAssetId: args.muxAssetId,
                    skipAutoActions: args.skipAutoActions,
                });
                return;
            }
            await ctx.scheduler.runAfter(POLL_INTERVAL_MS, internal.moderationActions.pollAskQuestions, {
                muxAssetId: args.muxAssetId,
                jobId: args.jobId,
                attempt: args.attempt + 1,
                skipAutoActions: args.skipAutoActions,
            });
        }
        catch (e) {
            console.error(`Ask-questions poll failed for ${args.muxAssetId}:`, e);
            await ctx.runMutation(internal.moderation.setAskQuestionsStatus, {
                muxAssetId: args.muxAssetId,
                askQuestionsStatus: "failed",
            });
            await ctx.scheduler.runAfter(0, internal.moderation.applyAutoActions, {
                muxAssetId: args.muxAssetId,
                skipAutoActions: args.skipAutoActions,
            });
        }
    },
});
// ─── Rejected webhook ───
// ─── Summarize job ───
export const runSummary = internalAction({
    args: {
        muxAssetId: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.runMutation(internal.moderation.setSummaryStatus, {
            muxAssetId: args.muxAssetId,
            summaryStatus: "processing",
        });
        try {
            const resp = await fetch(`${MUX_BASE_URL}/robots/v0/jobs/summarize`, {
                method: "POST",
                headers: {
                    Authorization: muxAuthHeader(),
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    parameters: {
                        asset_id: args.muxAssetId,
                    },
                }),
            });
            if (!resp.ok) {
                const body = await resp.text();
                console.error(`Summarize API error (${resp.status}): ${body}`);
                await ctx.runMutation(internal.moderation.setSummaryStatus, {
                    muxAssetId: args.muxAssetId,
                    summaryStatus: "failed",
                });
                return;
            }
            const data = await resp.json();
            const jobId = data.data.id;
            await ctx.scheduler.runAfter(POLL_INTERVAL_MS, internal.moderationActions.pollSummary, {
                muxAssetId: args.muxAssetId,
                jobId,
                attempt: 1,
            });
        }
        catch (e) {
            console.error(`Summarize failed for ${args.muxAssetId}:`, e);
            await ctx.runMutation(internal.moderation.setSummaryStatus, {
                muxAssetId: args.muxAssetId,
                summaryStatus: "failed",
            });
        }
    },
});
export const pollSummary = internalAction({
    args: {
        muxAssetId: v.string(),
        jobId: v.string(),
        attempt: v.number(),
    },
    handler: async (ctx, args) => {
        try {
            const resp = await fetch(`${MUX_BASE_URL}/robots/v0/jobs/summarize/${args.jobId}`, { headers: { Authorization: muxAuthHeader() } });
            if (!resp.ok) {
                console.error(`Summarize poll error (${resp.status})`);
                await ctx.runMutation(internal.moderation.setSummaryStatus, {
                    muxAssetId: args.muxAssetId,
                    summaryStatus: "failed",
                });
                return;
            }
            const job = (await resp.json()).data;
            if (job.status === "completed") {
                const outputs = job.outputs ?? {};
                const summary = outputs.description ?? outputs.summary ?? outputs.text ?? "";
                await ctx.runMutation(internal.moderation.updateSummary, {
                    muxAssetId: args.muxAssetId,
                    summary,
                    summaryTitle: outputs.title ?? undefined,
                    summaryTags: Array.isArray(outputs.tags) ? outputs.tags : undefined,
                    summaryJobId: args.jobId,
                });
                return;
            }
            if (job.status === "errored") {
                console.error(`Summarize job errored for ${args.muxAssetId}`);
                await ctx.runMutation(internal.moderation.setSummaryStatus, {
                    muxAssetId: args.muxAssetId,
                    summaryStatus: "failed",
                });
                return;
            }
            if (args.attempt >= MAX_POLL_ATTEMPTS) {
                console.error(`Summarize job timed out for ${args.muxAssetId}`);
                await ctx.runMutation(internal.moderation.setSummaryStatus, {
                    muxAssetId: args.muxAssetId,
                    summaryStatus: "failed",
                });
                return;
            }
            await ctx.scheduler.runAfter(POLL_INTERVAL_MS, internal.moderationActions.pollSummary, {
                muxAssetId: args.muxAssetId,
                jobId: args.jobId,
                attempt: args.attempt + 1,
            });
        }
        catch (e) {
            console.error(`Summarize poll failed for ${args.muxAssetId}:`, e);
            await ctx.runMutation(internal.moderation.setSummaryStatus, {
                muxAssetId: args.muxAssetId,
                summaryStatus: "failed",
            });
        }
    },
});
// ─── Rejected webhook ───
export const fireRejectedWebhook = internalAction({
    args: {
        muxAssetId: v.string(),
        trigger: v.union(v.literal("auto-reject"), v.literal("rule"), v.literal("manual")),
    },
    handler: async (ctx, args) => {
        const settings = await ctx.runQuery(internal.settings.getInternal);
        const webhookUrl = settings.rejectedWebhookUrl;
        if (!webhookUrl)
            return;
        let httpStatus;
        let responseBody;
        let error;
        try {
            const headers = { "Content-Type": "application/json" };
            if (settings.webhookHeaderKey && settings.webhookHeaderValue) {
                headers[settings.webhookHeaderKey] = settings.webhookHeaderValue;
            }
            const resp = await fetch(webhookUrl, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    event: "rejected",
                    muxAssetId: args.muxAssetId,
                    trigger: args.trigger,
                    timestamp: new Date().toISOString(),
                }),
            });
            httpStatus = resp.status;
            responseBody = await resp.text();
        }
        catch (e) {
            error = e instanceof Error ? e.message : "Unknown error";
        }
        await ctx.runMutation(internal.moderation.logWebhook, {
            muxAssetId: args.muxAssetId,
            event: "rejected",
            trigger: args.trigger,
            webhookUrl,
            httpStatus,
            responseBody,
            error,
        });
    },
});
// ─── Public trigger ───
export const triggerModeration = authenticatedAction({
    args: {
        muxAssetId: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.scheduler.runAfter(0, internal.moderationActions.runModeration, {
            muxAssetId: args.muxAssetId,
        });
    },
});
