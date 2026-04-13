import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("moderationQuestions")
      .withIndex("by_created_at")
      .order("asc")
      .take(50);
  },
});

export const add = mutation({
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

export const remove = mutation({
  args: { id: v.id("moderationQuestions") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
