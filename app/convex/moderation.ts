import { v } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import { components } from "./_generated/api";

// ---------- Queries ----------

export const list = query({
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
export const listWithAssets = query({
  args: {
    limit: v.optional(v.number()),
    filter: v.optional(
      v.union(
        v.literal("processing"),
        v.literal("completed"),
        v.literal("failed"),
        v.literal("approved"),
        v.literal("rejected"),
        v.literal("unreviewed")
      )
    ),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const filter = args.filter;

    let results;
    if (filter === "processing") {
      // "processing" includes both pending and processing statuses
      // Use by_status index for "processing", then also grab "pending"
      const processing = await ctx.db
        .query("moderationResults")
        .withIndex("by_status", (q) => q.eq("status", "processing"))
        .take(limit);
      const pending = await ctx.db
        .query("moderationResults")
        .withIndex("by_status", (q) => q.eq("status", "pending"))
        .take(limit);
      results = [...pending, ...processing]
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limit);
    } else if (filter === "completed" || filter === "failed") {
      results = await ctx.db
        .query("moderationResults")
        .withIndex("by_status", (q) => q.eq("status", filter))
        .order("desc")
        .take(limit);
    } else if (
      filter === "approved" ||
      filter === "rejected" ||
      filter === "unreviewed"
    ) {
      results = await ctx.db
        .query("moderationResults")
        .withIndex("by_review_status", (q) => q.eq("reviewStatus", filter))
        .order("desc")
        .take(limit);
    } else {
      results = await ctx.db
        .query("moderationResults")
        .withIndex("by_created_at")
        .order("desc")
        .take(limit);
    }

    // Batch-fetch asset data from the component for each result
    const assetIds = [...new Set(results.map((r) => r.muxAssetId))];
    const assetLookups = await Promise.all(
      assetIds.map((id) =>
        ctx.runQuery(components.mux.catalog.getAssetByMuxId, { muxAssetId: id })
      )
    );
    const assetMap = new Map<string, (typeof assetLookups)[number]>();
    for (let i = 0; i < assetIds.length; i++) {
      if (assetLookups[i]) assetMap.set(assetIds[i], assetLookups[i]);
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
export const counts = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db
      .query("moderationResults")
      .withIndex("by_created_at")
      .take(500);

    let processing = 0;
    let completed = 0;
    let failed = 0;
    let approved = 0;
    let rejected = 0;
    let unreviewed = 0;

    for (const r of all) {
      if (r.status === "pending" || r.status === "processing") processing++;
      if (r.status === "completed") completed++;
      if (r.status === "failed") failed++;
      if (r.reviewStatus === "approved") approved++;
      if (r.reviewStatus === "rejected") rejected++;
      if (r.reviewStatus === "unreviewed") unreviewed++;
    }

    return {
      all: all.length,
      processing,
      completed,
      failed,
      approved,
      rejected,
      unreviewed,
    };
  },
});

export const getByAssetId = query({
  args: { muxAssetId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("moderationResults")
      .withIndex("by_mux_asset_id", (q) => q.eq("muxAssetId", args.muxAssetId))
      .first();
  },
});

// ---------- Mutations ----------

export const createPending = mutation({
  args: { muxAssetId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("moderationResults")
      .withIndex("by_mux_asset_id", (q) => q.eq("muxAssetId", args.muxAssetId))
      .first();
    if (existing) return existing._id;

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
    status: v.union(
      v.literal("completed"),
      v.literal("failed")
    ),
    exceedsThreshold: v.optional(v.boolean()),
    maxScores: v.optional(
      v.object({ sexual: v.number(), violence: v.number() })
    ),
    thumbnailScores: v.optional(
      v.array(
        v.object({
          sexual: v.number(),
          violence: v.number(),
        })
      )
    ),
    robotsJobId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("moderationResults")
      .withIndex("by_mux_asset_id", (q) => q.eq("muxAssetId", args.muxAssetId))
      .first();
    if (!existing) return;

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
    if (!existing) return;
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
    if (!existing) return;
    await ctx.db.patch(existing._id, {
      askQuestionsJobId: args.askQuestionsJobId,
      updatedAt: Date.now(),
    });
  },
});

export const updateQuestionAnswers = internalMutation({
  args: {
    muxAssetId: v.string(),
    questionAnswers: v.array(
      v.object({
        question: v.string(),
        answer: v.optional(v.string()),
        confidence: v.number(),
        reasoning: v.string(),
        skipped: v.boolean(),
      })
    ),
    askQuestionsJobId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("moderationResults")
      .withIndex("by_mux_asset_id", (q) => q.eq("muxAssetId", args.muxAssetId))
      .first();
    if (!existing) return;
    await ctx.db.patch(existing._id, {
      questionAnswers: args.questionAnswers,
      askQuestionsJobId: args.askQuestionsJobId,
      updatedAt: Date.now(),
    });
  },
});

export const setReviewStatus = mutation({
  args: {
    muxAssetId: v.string(),
    reviewStatus: v.union(
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("unreviewed")
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("moderationResults")
      .withIndex("by_mux_asset_id", (q) => q.eq("muxAssetId", args.muxAssetId))
      .first();
    if (!existing) return;
    await ctx.db.patch(existing._id, {
      reviewStatus: args.reviewStatus,
      reviewedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});
