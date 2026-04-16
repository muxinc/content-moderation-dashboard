import { v } from "convex/values";
import { mutation, internalQuery, internalMutation } from "./_generated/server";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const create = mutation({
    args: { token: v.string() },
    handler: async (ctx, args) => {
        const expiresAt = Date.now() + SESSION_DURATION_MS;
        await ctx.db.insert("sessions", {
            token: args.token,
            expiresAt,
            createdAt: Date.now(),
        });
        return { token: args.token, expiresAt };
    },
});
export const deleteByToken = mutation({
    args: { token: v.string() },
    handler: async (ctx, args) => {
        const session = await ctx.db
            .query("sessions")
            .withIndex("by_token", (q) => q.eq("token", args.token))
            .first();
        if (session)
            await ctx.db.delete(session._id);
    },
});
export const validate = internalQuery({
    args: { token: v.string() },
    handler: async (ctx, args) => {
        const session = await ctx.db
            .query("sessions")
            .withIndex("by_token", (q) => q.eq("token", args.token))
            .first();
        if (!session)
            return false;
        return session.expiresAt > Date.now();
    },
});
export const cleanupExpired = internalMutation({
    args: {},
    handler: async (ctx) => {
        const now = Date.now();
        const expired = await ctx.db
            .query("sessions")
            .withIndex("by_expires_at")
            .take(200);
        let deleted = 0;
        for (const s of expired) {
            if (s.expiresAt < now) {
                await ctx.db.delete(s._id);
                deleted++;
            }
            else {
                break; // Index is ordered, so no more expired sessions
            }
        }
        return { deleted };
    },
});
