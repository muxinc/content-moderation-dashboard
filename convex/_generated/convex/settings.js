import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { authenticatedQuery, authenticatedMutation } from "./lib/auth";
const DEFAULT_SETTINGS = {
    sexual: { review: 0.9, reject: undefined },
    violence: { review: 0.9, reject: undefined },
    rejectedWebhookUrl: "",
    webhookHeaderKey: "",
    webhookHeaderValue: "",
    rejectionRules: [],
    bypassRules: [],
};
function settingsFromDoc(settings) {
    if (!settings)
        return DEFAULT_SETTINGS;
    return {
        sexual: settings.sexual,
        violence: settings.violence,
        rejectedWebhookUrl: settings.rejectedWebhookUrl ?? "",
        webhookHeaderKey: settings.webhookHeaderKey ?? "",
        webhookHeaderValue: settings.webhookHeaderValue ?? "",
        rejectionRules: settings.rejectionRules ?? [],
        bypassRules: settings.bypassRules ?? [],
    };
}
export const get = authenticatedQuery({
    args: {},
    handler: async (ctx) => {
        const settings = await ctx.db.query("moderationSettings").first();
        return settingsFromDoc(settings);
    },
});
// Internal version for use by other Convex functions (no auth required)
export const getInternal = internalQuery({
    args: {},
    handler: async (ctx) => {
        const settings = await ctx.db.query("moderationSettings").first();
        return settingsFromDoc(settings);
    },
});
const dimensionThresholds = v.object({
    review: v.number(),
    reject: v.optional(v.number()),
});
const bypassRuleValidator = v.object({
    question: v.string(),
    answer: v.string(),
});
const rejectionRuleValidator = v.object({
    question: v.string(),
    answer: v.string(),
});
export const update = authenticatedMutation({
    args: {
        sexual: dimensionThresholds,
        violence: dimensionThresholds,
        rejectedWebhookUrl: v.optional(v.string()),
        webhookHeaderKey: v.optional(v.string()),
        webhookHeaderValue: v.optional(v.string()),
        rejectionRules: v.optional(v.array(rejectionRuleValidator)),
        bypassRules: v.optional(v.array(bypassRuleValidator)),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db.query("moderationSettings").first();
        const data = {
            sexual: args.sexual,
            violence: args.violence,
            rejectedWebhookUrl: args.rejectedWebhookUrl,
            webhookHeaderKey: args.webhookHeaderKey,
            webhookHeaderValue: args.webhookHeaderValue,
            rejectionRules: args.rejectionRules,
            bypassRules: args.bypassRules,
            updatedAt: Date.now(),
        };
        if (existing) {
            await ctx.db.patch(existing._id, data);
        }
        else {
            await ctx.db.insert("moderationSettings", data);
        }
    },
});
