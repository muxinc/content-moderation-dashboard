import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const dimensionThresholds = v.object({
  review: v.number(),
  ban: v.number(),
});

export default defineSchema({
  moderationResults: defineTable({
    muxAssetId: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    exceedsThreshold: v.optional(v.boolean()),
    maxScores: v.optional(
      v.object({
        sexual: v.number(),
        violence: v.number(),
      })
    ),
    thumbnailScores: v.optional(
      v.array(
        v.object({
          sexual: v.number(),
          violence: v.number(),
          // Legacy fields from @mux/ai
          url: v.optional(v.string()),
          time: v.optional(v.number()),
          error: v.optional(v.boolean()),
          errorMessage: v.optional(v.string()),
        })
      )
    ),
    // Legacy fields from @mux/ai
    thresholds: v.optional(
      v.object({
        sexual: v.number(),
        violence: v.number(),
      })
    ),
    mode: v.optional(v.union(v.literal("thumbnails"), v.literal("transcript"))),
    isAudioOnly: v.optional(v.boolean()),
    robotsJobId: v.optional(v.string()),
    error: v.optional(v.string()),
    reviewStatus: v.union(
      v.literal("unreviewed"),
      v.literal("approved"),
      v.literal("rejected")
    ),
    reviewedAt: v.optional(v.number()),
    // Q&A answers from Robots ask-questions
    questionAnswers: v.optional(
      v.array(
        v.object({
          question: v.string(),
          answer: v.optional(v.string()),
          confidence: v.number(),
          reasoning: v.string(),
          skipped: v.boolean(),
        })
      )
    ),
    askQuestionsJobId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_mux_asset_id", ["muxAssetId"])
    .index("by_status", ["status"])
    .index("by_review_status", ["reviewStatus"])
    .index("by_created_at", ["createdAt"]),

  moderationSettings: defineTable({
    sexual: dimensionThresholds,
    violence: dimensionThresholds,
    updatedAt: v.number(),
  }),

  // Configured Q&A questions to run on every asset
  moderationQuestions: defineTable({
    question: v.string(),
    answerOptions: v.optional(v.array(v.string())),
    createdAt: v.number(),
  }).index("by_created_at", ["createdAt"]),
});
