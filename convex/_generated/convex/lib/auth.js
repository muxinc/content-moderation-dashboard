import { query, mutation, action, } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
async function validateSession(ctx, token) {
    const session = await ctx.db
        .query("sessions")
        .withIndex("by_token", (q) => q.eq("token", token))
        .first();
    if (!session)
        throw new Error("Invalid session");
    if (session.expiresAt < Date.now())
        throw new Error("Session expired");
}
async function validateSessionFromAction(ctx, token) {
    const valid = await ctx.runQuery(internal.sessions.validate, { token });
    if (!valid)
        throw new Error("Invalid or expired session");
}
/* eslint-disable @typescript-eslint/no-explicit-any */
export function authenticatedQuery(config) {
    return query({
        args: { ...config.args, sessionToken: v.string() },
        handler: async (ctx, args) => {
            const { sessionToken, ...rest } = args;
            await validateSession(ctx, sessionToken);
            return config.handler(ctx, rest);
        },
    });
}
export function authenticatedMutation(config) {
    return mutation({
        args: { ...config.args, sessionToken: v.string() },
        handler: async (ctx, args) => {
            const { sessionToken, ...rest } = args;
            await validateSession(ctx, sessionToken);
            return config.handler(ctx, rest);
        },
    });
}
export function authenticatedAction(config) {
    return action({
        args: { ...config.args, sessionToken: v.string() },
        handler: async (ctx, args) => {
            const { sessionToken, ...rest } = args;
            await validateSessionFromAction(ctx, sessionToken);
            return config.handler(ctx, rest);
        },
    });
}
