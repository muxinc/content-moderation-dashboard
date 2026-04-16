import { v } from "convex/values";
import { internalMutation, internalQuery, } from "./_generated/server";
import { components, internal } from "./_generated/api";
import { authenticatedQuery, authenticatedMutation } from "./lib/auth";
// ---------- Queries ----------
export const list = authenticatedQuery({
    args: {
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("moderationResults")
            .withIndex("by_created_at")
            .order("desc")
            .take(args.limit ?? 50);
    },
});
/**
 * List moderation results with server-side filtering, enriched with asset data.
 */
export const listWithAssets = authenticatedQuery({
    args: {
        limit: v.optional(v.number()),
        jobFilter: v.optional(v.union(v.literal("processing"), v.literal("completed"), v.literal("failed"))),
        reviewFilter: v.optional(v.union(v.literal("unreviewed"), v.literal("approved"), v.literal("auto-approved"), v.literal("auto-rejected"), v.literal("rejected"))),
        classificationFilter: v.optional(v.union(v.literal("pass"), v.literal("review"), v.literal("reject"))),
        questionFilter: v.optional(v.object({
            question: v.string(),
            answer: v.string(),
        })),
    },
    handler: async (ctx, args) => {
        const limit = args.limit ?? 50;
        // Fetch more than needed when we'll filter in-memory
        const needsInMemoryFilter = (args.reviewFilter && args.jobFilter) || args.classificationFilter || args.questionFilter;
        const fetchLimit = needsInMemoryFilter ? 200 : limit;
        let results;
        // Use the most selective index available
        if (args.jobFilter === "processing") {
            const processing = await ctx.db
                .query("moderationResults")
                .withIndex("by_status", (q) => q.eq("status", "processing"))
                .take(fetchLimit);
            const pending = await ctx.db
                .query("moderationResults")
                .withIndex("by_status", (q) => q.eq("status", "pending"))
                .take(fetchLimit);
            results = [...pending, ...processing]
                .sort((a, b) => b.createdAt - a.createdAt);
        }
        else if (args.jobFilter === "completed" || args.jobFilter === "failed") {
            results = await ctx.db
                .query("moderationResults")
                .withIndex("by_status", (q) => q.eq("status", args.jobFilter))
                .order("desc")
                .take(fetchLimit);
        }
        else if (args.reviewFilter) {
            results = await ctx.db
                .query("moderationResults")
                .withIndex("by_review_status", (q) => q.eq("reviewStatus", args.reviewFilter))
                .order("desc")
                .take(fetchLimit);
        }
        else {
            results = await ctx.db
                .query("moderationResults")
                .withIndex("by_created_at")
                .order("desc")
                .take(fetchLimit);
        }
        // In-memory cross-filter if both job and review filters are set
        if (args.jobFilter && args.reviewFilter) {
            results = results.filter((r) => {
                if (args.jobFilter === "processing") {
                    return ((r.status === "processing" || r.status === "pending") &&
                        r.reviewStatus === args.reviewFilter);
                }
                return r.status === args.jobFilter && r.reviewStatus === args.reviewFilter;
            });
        }
        else if (args.jobFilter && !args.reviewFilter) {
            // Already filtered by index, except "processing" needs pending too (handled above)
        }
        else if (!args.jobFilter && args.reviewFilter) {
            // Already filtered by index
        }
        // In-memory classification filter (computed from scores + thresholds)
        if (args.classificationFilter) {
            const settings = await ctx.db.query("moderationSettings").first();
            const sexualReview = settings?.sexual.review ?? 0.9;
            const violenceReview = settings?.violence.review ?? 0.9;
            const sexualReject = settings?.sexual.reject;
            const violenceReject = settings?.violence.reject;
            results = results.filter((r) => {
                const scores = r.maxScores;
                if (!scores)
                    return args.classificationFilter === "pass";
                const isReject = (sexualReject !== undefined && scores.sexual >= sexualReject) ||
                    (violenceReject !== undefined && scores.violence >= violenceReject);
                const isReview = !isReject && (scores.sexual >= sexualReview || scores.violence >= violenceReview);
                if (args.classificationFilter === "reject")
                    return isReject;
                if (args.classificationFilter === "review")
                    return isReview;
                return !isReject && !isReview;
            });
        }
        // In-memory question answer filter
        if (args.questionFilter) {
            results = results.filter((r) => {
                if (!r.questionAnswers)
                    return false;
                return r.questionAnswers.some((qa) => qa.question === args.questionFilter.question &&
                    qa.answer === args.questionFilter.answer);
            });
        }
        results = results.slice(0, limit);
        // Batch-fetch asset data from the component for each result
        const assetIds = [...new Set(results.map((r) => r.muxAssetId))];
        const assetLookups = await Promise.all(assetIds.map((id) => ctx.runQuery(components.mux.catalog.getAssetByMuxId, { muxAssetId: id })));
        const assetMap = new Map();
        for (let i = 0; i < assetIds.length; i++) {
            if (assetLookups[i])
                assetMap.set(assetIds[i], assetLookups[i]);
        }
        return results.map((r) => ({
            moderation: r,
            asset: assetMap.get(r.muxAssetId) ?? null,
        }));
    },
});
/**
 * Get counts for each filter category.
 */
export const counts = authenticatedQuery({
    args: {},
    handler: async (ctx) => {
        const all = await ctx.db
            .query("moderationResults")
            .withIndex("by_created_at")
            .take(500);
        let processing = 0;
        let completed = 0;
        let failed = 0;
        let unreviewed = 0;
        let approved = 0;
        let autoApproved = 0;
        let autoRejected = 0;
        let rejected = 0;
        for (const r of all) {
            if (r.status === "pending" || r.status === "processing")
                processing++;
            if (r.status === "completed")
                completed++;
            if (r.status === "failed")
                failed++;
            if (r.reviewStatus === "unreviewed")
                unreviewed++;
            if (r.reviewStatus === "approved")
                approved++;
            if (r.reviewStatus === "auto-approved")
                autoApproved++;
            if (r.reviewStatus === "auto-rejected")
                autoRejected++;
            if (r.reviewStatus === "rejected")
                rejected++;
        }
        return {
            all: all.length,
            processing,
            completed,
            failed,
            unreviewed,
            approved,
            autoApproved,
            autoRejected,
            rejected,
        };
    },
});
export const getByAssetId = authenticatedQuery({
    args: { muxAssetId: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("moderationResults")
            .withIndex("by_mux_asset_id", (q) => q.eq("muxAssetId", args.muxAssetId))
            .first();
    },
});
// Internal version for use by other Convex functions (no auth required)
export const getByAssetIdInternal = internalQuery({
    args: { muxAssetId: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("moderationResults")
            .withIndex("by_mux_asset_id", (q) => q.eq("muxAssetId", args.muxAssetId))
            .first();
    },
});
// ---------- Mutations ----------
export const createPending = authenticatedMutation({
    args: { muxAssetId: v.string() },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("moderationResults")
            .withIndex("by_mux_asset_id", (q) => q.eq("muxAssetId", args.muxAssetId))
            .first();
        if (existing)
            return existing._id;
        return await ctx.db.insert("moderationResults", {
            muxAssetId: args.muxAssetId,
            status: "pending",
            reviewStatus: "unreviewed",
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
    },
});
export const updateResult = internalMutation({
    args: {
        muxAssetId: v.string(),
        status: v.union(v.literal("completed"), v.literal("failed")),
        exceedsThreshold: v.optional(v.boolean()),
        maxScores: v.optional(v.object({ sexual: v.number(), violence: v.number() })),
        thumbnailScores: v.optional(v.array(v.object({
            sexual: v.number(),
            violence: v.number(),
            time: v.optional(v.number()),
        }))),
        robotsJobId: v.optional(v.string()),
        error: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("moderationResults")
            .withIndex("by_mux_asset_id", (q) => q.eq("muxAssetId", args.muxAssetId))
            .first();
        if (!existing)
            return;
        const { muxAssetId, ...updates } = args;
        await ctx.db.patch(existing._id, {
            ...updates,
            updatedAt: Date.now(),
        });
    },
});
export const setRobotsJobId = internalMutation({
    args: {
        muxAssetId: v.string(),
        robotsJobId: v.string(),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("moderationResults")
            .withIndex("by_mux_asset_id", (q) => q.eq("muxAssetId", args.muxAssetId))
            .first();
        if (!existing)
            return;
        await ctx.db.patch(existing._id, {
            robotsJobId: args.robotsJobId,
            updatedAt: Date.now(),
        });
    },
});
export const setProcessing = internalMutation({
    args: { muxAssetId: v.string() },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("moderationResults")
            .withIndex("by_mux_asset_id", (q) => q.eq("muxAssetId", args.muxAssetId))
            .first();
        if (!existing) {
            await ctx.db.insert("moderationResults", {
                muxAssetId: args.muxAssetId,
                status: "processing",
                reviewStatus: "unreviewed",
                createdAt: Date.now(),
                updatedAt: Date.now(),
            });
            return;
        }
        await ctx.db.patch(existing._id, {
            status: "processing",
            reviewStatus: "unreviewed",
            autoActionApplied: false,
            askQuestionsStatus: undefined,
            questionAnswers: undefined,
            summary: undefined,
            summaryStatus: undefined,
            summaryJobId: undefined,
            updatedAt: Date.now(),
        });
    },
});
export const setAskQuestionsStatus = internalMutation({
    args: {
        muxAssetId: v.string(),
        askQuestionsStatus: v.union(v.literal("processing"), v.literal("completed"), v.literal("failed")),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("moderationResults")
            .withIndex("by_mux_asset_id", (q) => q.eq("muxAssetId", args.muxAssetId))
            .first();
        if (!existing)
            return;
        await ctx.db.patch(existing._id, {
            askQuestionsStatus: args.askQuestionsStatus,
            updatedAt: Date.now(),
        });
    },
});
export const setAskQuestionsJobId = internalMutation({
    args: {
        muxAssetId: v.string(),
        askQuestionsJobId: v.string(),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("moderationResults")
            .withIndex("by_mux_asset_id", (q) => q.eq("muxAssetId", args.muxAssetId))
            .first();
        if (!existing)
            return;
        await ctx.db.patch(existing._id, {
            askQuestionsJobId: args.askQuestionsJobId,
            updatedAt: Date.now(),
        });
    },
});
export const setSummaryStatus = internalMutation({
    args: {
        muxAssetId: v.string(),
        summaryStatus: v.union(v.literal("processing"), v.literal("completed"), v.literal("failed")),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("moderationResults")
            .withIndex("by_mux_asset_id", (q) => q.eq("muxAssetId", args.muxAssetId))
            .first();
        if (!existing)
            return;
        await ctx.db.patch(existing._id, {
            summaryStatus: args.summaryStatus,
            updatedAt: Date.now(),
        });
    },
});
export const updateSummary = internalMutation({
    args: {
        muxAssetId: v.string(),
        summary: v.string(),
        summaryJobId: v.string(),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("moderationResults")
            .withIndex("by_mux_asset_id", (q) => q.eq("muxAssetId", args.muxAssetId))
            .first();
        if (!existing)
            return;
        await ctx.db.patch(existing._id, {
            summary: args.summary,
            summaryJobId: args.summaryJobId,
            summaryStatus: "completed",
            updatedAt: Date.now(),
        });
    },
});
export const updateQuestionAnswers = internalMutation({
    args: {
        muxAssetId: v.string(),
        questionAnswers: v.array(v.object({
            question: v.string(),
            answer: v.optional(v.string()),
            confidence: v.number(),
            reasoning: v.string(),
            skipped: v.boolean(),
        })),
        askQuestionsJobId: v.string(),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("moderationResults")
            .withIndex("by_mux_asset_id", (q) => q.eq("muxAssetId", args.muxAssetId))
            .first();
        if (!existing)
            return;
        await ctx.db.patch(existing._id, {
            questionAnswers: args.questionAnswers,
            askQuestionsJobId: args.askQuestionsJobId,
            updatedAt: Date.now(),
        });
    },
});
export const setReviewStatus = authenticatedMutation({
    args: {
        muxAssetId: v.string(),
        reviewStatus: v.union(v.literal("approved"), v.literal("rejected"), v.literal("unreviewed")),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("moderationResults")
            .withIndex("by_mux_asset_id", (q) => q.eq("muxAssetId", args.muxAssetId))
            .first();
        if (!existing)
            return;
        await ctx.db.patch(existing._id, {
            reviewStatus: args.reviewStatus,
            reviewedAt: Date.now(),
            updatedAt: Date.now(),
        });
        // Fire rejected webhook on manual rejection
        if (args.reviewStatus === "rejected") {
            await ctx.scheduler.runAfter(0, internal.moderationActions.fireRejectedWebhook, {
                muxAssetId: args.muxAssetId,
                trigger: "manual",
            });
        }
    },
});
export const bulkSetReviewStatus = authenticatedMutation({
    args: {
        muxAssetIds: v.array(v.string()),
        reviewStatus: v.union(v.literal("approved"), v.literal("rejected"), v.literal("unreviewed")),
    },
    handler: async (ctx, args) => {
        for (const muxAssetId of args.muxAssetIds) {
            const existing = await ctx.db
                .query("moderationResults")
                .withIndex("by_mux_asset_id", (q) => q.eq("muxAssetId", muxAssetId))
                .first();
            if (!existing)
                continue;
            await ctx.db.patch(existing._id, {
                reviewStatus: args.reviewStatus,
                reviewedAt: Date.now(),
                updatedAt: Date.now(),
            });
            if (args.reviewStatus === "rejected") {
                await ctx.scheduler.runAfter(0, internal.moderationActions.fireRejectedWebhook, {
                    muxAssetId,
                    trigger: "manual",
                });
            }
        }
    },
});
export const logWebhook = internalMutation({
    args: {
        muxAssetId: v.string(),
        event: v.literal("rejected"),
        trigger: v.union(v.literal("auto-reject"), v.literal("rule"), v.literal("manual")),
        webhookUrl: v.string(),
        httpStatus: v.optional(v.number()),
        responseBody: v.optional(v.string()),
        error: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await ctx.db.insert("webhookLog", {
            ...args,
            createdAt: Date.now(),
        });
    },
});
// ---------- Auto-Action Coordinator ----------
/**
 * Evaluates auto-approve/auto-reject rules after both moderation scores
 * and Q&A answers are available. Called from pollModeration and
 * pollAskQuestions completions — idempotent via autoActionApplied flag.
 */
export const applyAutoActions = internalMutation({
    args: {
        muxAssetId: v.string(),
        skipAutoActions: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const result = await ctx.db
            .query("moderationResults")
            .withIndex("by_mux_asset_id", (q) => q.eq("muxAssetId", args.muxAssetId))
            .first();
        if (!result)
            return;
        // Bail if not ready, already decided, or already processed
        if (result.status !== "completed")
            return;
        if (result.reviewStatus !== "unreviewed")
            return;
        if (result.autoActionApplied)
            return;
        // If caller asked to skip (e.g. backfill), just mark as processed
        if (args.skipAutoActions) {
            await ctx.db.patch(result._id, {
                autoActionApplied: true,
                updatedAt: Date.now(),
            });
            return;
        }
        // Load settings
        const settings = await ctx.db.query("moderationSettings").first();
        const rejectionRules = settings?.rejectionRules ?? [];
        // Auto-reject is enabled if any reject threshold is set
        const hasRejectThreshold = settings?.sexual.reject != null || settings?.violence.reject != null;
        // If no reject thresholds and no rejection rules, check for auto-approve
        if (!hasRejectThreshold && rejectionRules.length === 0) {
            const scores = result.maxScores;
            if (scores) {
                const belowReview = scores.sexual < (settings?.sexual.review ?? 0.9) &&
                    scores.violence < (settings?.violence.review ?? 0.9);
                if (belowReview) {
                    await ctx.db.patch(result._id, {
                        reviewStatus: "auto-approved",
                        autoActionApplied: true,
                        reviewedAt: Date.now(),
                        updatedAt: Date.now(),
                    });
                    return;
                }
            }
            await ctx.db.patch(result._id, {
                autoActionApplied: true,
                updatedAt: Date.now(),
            });
            return;
        }
        // Check if we need to wait for Q&A answers (for bypass/rejection rules)
        const configuredQuestions = await ctx.db
            .query("moderationQuestions")
            .withIndex("by_created_at")
            .take(100);
        if (configuredQuestions.length > 0 && result.askQuestionsStatus === "processing") {
            // Q&A still in flight — wait for it to complete before deciding
            return;
        }
        // Build Q&A answer map for rule evaluation
        const answerMap = new Map();
        if (result.questionAnswers) {
            for (const qa of result.questionAnswers) {
                if (qa.answer)
                    answerMap.set(qa.question, qa.answer);
            }
        }
        let shouldReject = false;
        let rejectTrigger = "auto-reject";
        // Path 1: Score-based auto-reject
        const scores = result.maxScores;
        if (hasRejectThreshold && scores) {
            const sexualReject = settings?.sexual.reject;
            const violenceReject = settings?.violence.reject;
            const exceedsThreshold = (sexualReject !== undefined && scores.sexual >= sexualReject) ||
                (violenceReject !== undefined && scores.violence >= violenceReject);
            if (exceedsThreshold) {
                // Check bypass rules
                const bypassRules = settings?.bypassRules ?? [];
                let bypassed = false;
                for (const rule of bypassRules) {
                    if (answerMap.get(rule.question) === rule.answer) {
                        bypassed = true;
                        break;
                    }
                }
                if (!bypassed) {
                    shouldReject = true;
                    rejectTrigger = "auto-reject";
                }
            }
        }
        // Path 2: Q&A rejection rules (additive — either path can trigger rejection)
        if (!shouldReject && rejectionRules.length > 0) {
            for (const rule of rejectionRules) {
                if (answerMap.get(rule.question) === rule.answer) {
                    shouldReject = true;
                    rejectTrigger = "rule";
                    break;
                }
            }
        }
        if (shouldReject) {
            await ctx.db.patch(result._id, {
                reviewStatus: "auto-rejected",
                autoActionApplied: true,
                reviewedAt: Date.now(),
                updatedAt: Date.now(),
            });
            // Fire rejected webhook (reads URL from settings, logs result)
            await ctx.scheduler.runAfter(0, internal.moderationActions.fireRejectedWebhook, {
                muxAssetId: args.muxAssetId,
                trigger: rejectTrigger,
            });
            return;
        }
        // Auto-approve: all scores below review thresholds → pass classification
        const reviewScores = result.maxScores;
        if (reviewScores) {
            const belowReview = reviewScores.sexual < (settings?.sexual.review ?? 0.9) &&
                reviewScores.violence < (settings?.violence.review ?? 0.9);
            if (belowReview) {
                await ctx.db.patch(result._id, {
                    reviewStatus: "auto-approved",
                    autoActionApplied: true,
                    reviewedAt: Date.now(),
                    updatedAt: Date.now(),
                });
                return;
            }
        }
        // Scores are in the review zone — leave as unreviewed for human review
        await ctx.db.patch(result._id, {
            autoActionApplied: true,
            updatedAt: Date.now(),
        });
    },
});
