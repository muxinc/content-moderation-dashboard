import { components } from "./_generated/api";
import { v } from "convex/values";
import { authenticatedQuery } from "./lib/auth";

export const listAssetsWithModeration = authenticatedQuery({
  args: {
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 25;
    const offset = args.offset ?? 0;

    const allAssets = await ctx.runQuery(components.mux.catalog.listAssets, {
      limit: 500,
    });

    const liveAssets = allAssets.filter(
      (a: { status?: string }) => a.status === "ready" || a.status === "preparing"
    );

    const total = liveAssets.length;
    const page = liveAssets.slice(offset, offset + limit);

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

export const listAssets = authenticatedQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.mux.catalog.listAssets, {
      limit: args.limit ?? 50,
    });
  },
});

export const getAsset = authenticatedQuery({
  args: {
    muxAssetId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.mux.catalog.getAssetByMuxId, {
      muxAssetId: args.muxAssetId,
    });
  },
});
