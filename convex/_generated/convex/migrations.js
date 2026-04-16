"use node";
import Mux from "@mux/mux-node";
import { internalAction } from "./_generated/server";
import { components, internal } from "./_generated/api";
import { v } from "convex/values";
import { authenticatedAction } from "./lib/auth";
function requiredEnv(name, value) {
    if (!value)
        throw new Error(`Missing env var: ${name}`);
    return value;
}
function asString(value) {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}
function asRecord(value) {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        return value;
    }
    return undefined;
}
function asStringArray(value) {
    if (!Array.isArray(value))
        return undefined;
    const strings = value.filter((item) => typeof item === "string");
    return strings.length > 0 ? strings : undefined;
}
function asVisibility(value) {
    return value === "private" || value === "unlisted" || value === "public"
        ? value
        : undefined;
}
function parseMetadataPassthrough(passthrough) {
    const raw = asString(passthrough);
    if (!raw)
        return {};
    try {
        const parsed = JSON.parse(raw);
        const parsedObj = asRecord(parsed);
        if (!parsedObj)
            return { userId: raw };
        return {
            userId: asString(parsedObj.userId) ?? asString(parsedObj.user_id),
            title: asString(parsedObj.title),
            description: asString(parsedObj.description),
            tags: asStringArray(parsedObj.tags),
            visibility: asVisibility(parsedObj.visibility),
            custom: asRecord(parsedObj.custom),
        };
    }
    catch {
        return { userId: raw };
    }
}
/**
 * Public action — fires the backfill in the background and returns immediately.
 */
export const backfillMux = authenticatedAction({
    args: {
        maxAssets: v.optional(v.number()),
        defaultUserId: v.optional(v.string()),
        includeVideoMetadata: v.optional(v.boolean()),
        runModeration: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        await ctx.scheduler.runAfter(0, internal.migrations.runBackfill, {
            maxAssets: args.maxAssets,
            defaultUserId: args.defaultUserId,
            includeVideoMetadata: args.includeVideoMetadata ?? true,
            runModeration: args.runModeration ?? true,
        });
    },
});
/**
 * Internal action — does the actual work: syncs assets from Mux,
 * stores metadata, and schedules moderation for each ready asset.
 */
export const runBackfill = internalAction({
    args: {
        maxAssets: v.optional(v.number()),
        defaultUserId: v.optional(v.string()),
        includeVideoMetadata: v.boolean(),
        runModeration: v.boolean(),
    },
    handler: async (ctx, args) => {
        const mux = new Mux({
            tokenId: requiredEnv("MUX_TOKEN_ID", process.env.MUX_TOKEN_ID),
            tokenSecret: requiredEnv("MUX_TOKEN_SECRET", process.env.MUX_TOKEN_SECRET),
        });
        const maxAssets = Math.max(1, Math.floor(args.maxAssets ?? 200));
        let scanned = 0;
        let syncedAssets = 0;
        let moderationScheduled = 0;
        for await (const asset of mux.video.assets.list({ limit: 100 })) {
            if (scanned >= maxAssets)
                break;
            scanned += 1;
            if (!asset.id)
                continue;
            await ctx.runMutation(components.mux.sync.upsertAssetFromPayloadPublic, {
                asset: asset,
            });
            syncedAssets += 1;
            if (args.includeVideoMetadata) {
                const metadata = parseMetadataPassthrough(asset.passthrough);
                const userId = metadata.userId ?? asString(args.defaultUserId) ?? "default";
                await ctx.runMutation(components.mux.videos.upsertVideoMetadata, {
                    muxAssetId: asset.id,
                    userId,
                    title: metadata.title,
                    description: metadata.description,
                    tags: metadata.tags,
                    visibility: metadata.visibility,
                    custom: metadata.custom,
                });
            }
            // Schedule moderation for ready assets that don't have results yet.
            // Stagger at 3s intervals to stay under Mux Robots 1 RPS limit
            // (each job creates 3 API calls spaced 1s apart: moderate, ask-questions, summarize).
            if (args.runModeration && asset.status === "ready") {
                const existing = await ctx.runQuery(internal.moderation.getByAssetIdInternal, {
                    muxAssetId: asset.id,
                });
                if (!existing || existing.status === "failed") {
                    const delayMs = moderationScheduled * 3000;
                    await ctx.scheduler.runAfter(delayMs, internal.moderationActions.runModeration, {
                        muxAssetId: asset.id,
                        skipAutoActions: true,
                    });
                    moderationScheduled += 1;
                }
            }
        }
        console.log(`Backfill complete: scanned=${scanned}, synced=${syncedAssets}, moderation_scheduled=${moderationScheduled}`);
    },
});
