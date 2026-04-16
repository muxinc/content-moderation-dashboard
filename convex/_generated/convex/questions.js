import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { authenticatedQuery, authenticatedMutation } from "./lib/auth";
export const list = authenticatedQuery({
    args: {},
    handler: async (ctx) => {
        return await ctx.db
            .query("moderationQuestions")
            .withIndex("by_created_at")
            .order("asc")
            .take(50);
    },
});
// Internal version for use by other Convex functions (no auth required)
export const listInternal = internalQuery({
    args: {},
    handler: async (ctx) => {
        return await ctx.db
            .query("moderationQuestions")
            .withIndex("by_created_at")
            .order("asc")
            .take(50);
    },
});
export const add = authenticatedMutation({
    args: {
        question: v.string(),
        answerOptions: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("moderationQuestions", {
            question: args.question,
            answerOptions: args.answerOptions,
            createdAt: Date.now(),
        });
    },
});
export const remove = authenticatedMutation({
    args: { id: v.id("moderationQuestions") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
    },
});
