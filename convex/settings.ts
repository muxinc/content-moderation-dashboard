import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

const DEFAULT_SETTINGS = {
  sexual: { review: 0.3, ban: 0.7 },
  violence: { review: 0.4, ban: 0.8 },
};

export const get = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("moderationSettings").first();
    if (!settings) return DEFAULT_SETTINGS;
    return {
      sexual: settings.sexual,
      violence: settings.violence,
    };
  },
});

const dimensionThresholds = v.object({
  review: v.number(),
  ban: v.number(),
});

export const update = mutation({
  args: {
    sexual: dimensionThresholds,
    violence: dimensionThresholds,
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("moderationSettings").first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        sexual: args.sexual,
        violence: args.violence,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("moderationSettings", {
        sexual: args.sexual,
        violence: args.violence,
        updatedAt: Date.now(),
      });
    }
  },
});
