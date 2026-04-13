import { query } from "./_generated/server";
import { components } from "./_generated/api";
import { v } from "convex/values";

/**
 * List assets enriched with their moderation results.
 * Filters out deleted/errored assets.
 * Simple offset-based pagination since the component doesn't support cursors.
 */
export const listAssetsWithModeration = query({
  args: {
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 25;
    const offset = args.offset ?? 0;

    // Fetch more than we need to account for filtering
    const allAssets = await ctx.runQuery(components.mux.catalog.listAssets, {
      limit: 500,
    });

    // Filter to live assets only
    const liveAssets = allAssets.filter(
      (a: { status?: string }) => a.status === "ready" || a.status === "preparing"
    );

    const total = liveAssets.length;
    const page = liveAssets.slice(offset, offset + limit);

    // Batch-fetch all moderation results and build a lookup map
    const allModeration = await ctx.db
      .query("moderationResults")
      .withIndex("by_created_at")
      .order("desc")
      .take(500);

    const moderationByAssetId = new Map<string, (typeof allModeration)[number]>();
    for (const m of allModeration) {
      moderationByAssetId.set(m.muxAssetId, m);
    }

    const enriched = page.map((asset: { muxAssetId?: string }) => ({
      asset,
      moderation: asset.muxAssetId
        ? moderationByAssetId.get(asset.muxAssetId) ?? null
        : null,
    }));

    return {
      items: enriched,
      total,
      offset,
      limit,
      hasMore: offset + limit < total,
    };
  },
});

export const listAssets = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.mux.catalog.listAssets, {
      limit: args.limit ?? 50,
    });
  },
});

export const getAsset = query({
  args: {
    muxAssetId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.mux.catalog.getAssetByMuxId, {
      muxAssetId: args.muxAssetId,
    });
  },
});
