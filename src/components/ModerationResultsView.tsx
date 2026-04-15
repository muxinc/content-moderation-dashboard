"use client";

import { useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { AssetRow, TableShell } from "./TableShell";
import type { Thresholds, JobFilter, ReviewFilter } from "@/app/page";

type ModerationItem = {
  moderation: {
    _id: string;
    muxAssetId: string;
    status: "pending" | "processing" | "completed" | "failed";
    maxScores?: { sexual: number; violence: number };
    reviewStatus: "unreviewed" | "approved" | "auto-rejected" | "rejected";
    questionAnswers?: Array<{ question: string; answer?: string; confidence: number; reasoning: string; skipped: boolean }>;
  };
  asset: {
    muxAssetId?: string;
    status?: string;
    playbackIds?: Array<{ id: string; policy: string }>;
    durationSeconds?: number;
  } | null;
};

const JOB_FILTERS: { value: JobFilter; label: string; countKey: string }[] = [
  { value: undefined, label: "All", countKey: "all" },
  { value: "processing", label: "Processing", countKey: "processing" },
  { value: "completed", label: "Completed", countKey: "completed" },
  { value: "failed", label: "Failed", countKey: "failed" },
];

const REVIEW_FILTERS: { value: ReviewFilter; label: string; countKey: string }[] = [
  { value: undefined, label: "All", countKey: "all" },
  { value: "unreviewed", label: "Unreviewed", countKey: "unreviewed" },
  { value: "approved", label: "Approved", countKey: "approved" },
  { value: "auto-rejected", label: "Auto-Rejected", countKey: "autoRejected" },
  { value: "rejected", label: "Rejected", countKey: "rejected" },
];

export function ModerationResultsView({
  data,
  thresholds,
  jobFilter,
  reviewFilter,
  onJobFilterChangeAction,
  onReviewFilterChangeAction,
  onSelectAssetAction,
}: {
  data: ModerationItem[] | null;
  thresholds: Thresholds;
  jobFilter: JobFilter;
  reviewFilter: ReviewFilter;
  onJobFilterChangeAction: (f: JobFilter) => void;
  onReviewFilterChangeAction: (f: ReviewFilter) => void;
  onSelectAssetAction: (muxAssetId: string) => void;
}) {
  const triggerModeration = useAction(api.moderationActions.triggerModeration);
  const counts = useQuery(api.moderation.counts);
  const questions = useQuery(api.questions.list);
  const questionTexts = questions?.map((q) => q.question) ?? [];

  return (
    <div className="space-y-4">
      {/* Filter rows */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 w-16">Job</span>
          {JOB_FILTERS.map(({ value, label, countKey }) => {
            const active = jobFilter === value;
            const count = counts?.[countKey as keyof typeof counts];
            return (
              <button
                key={label}
                onClick={() => onJobFilterChangeAction(value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  active
                    ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100"
                    : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                }`}
              >
                {label}
                {count != null && (
                  <span className={`ml-1.5 ${active ? "opacity-70" : "text-zinc-400 dark:text-zinc-500"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 w-16">Review</span>
          {REVIEW_FILTERS.map(({ value, label, countKey }) => {
            const active = reviewFilter === value;
            const count = counts?.[countKey as keyof typeof counts];
            return (
              <button
                key={label}
                onClick={() => onReviewFilterChangeAction(value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  active
                    ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100"
                    : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                }`}
              >
                {label}
                {count != null && (
                  <span className={`ml-1.5 ${active ? "opacity-70" : "text-zinc-400 dark:text-zinc-500"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {!data ? (
        <div className="text-center py-12 text-zinc-400 text-sm">Loading...</div>
      ) : data.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-12 text-center">
          <p className="text-zinc-400 dark:text-zinc-500 text-sm">
            No moderation results match this filter.
          </p>
        </div>
      ) : (
        <TableShell questions={questionTexts}>
          {data.map(({ moderation, asset }) => (
            <AssetRow
              key={moderation._id}
              muxAssetId={moderation.muxAssetId}
              playbackId={asset?.playbackIds?.[0]?.id}
              duration={asset?.durationSeconds}
              moderation={moderation}
              thresholds={thresholds}
              questions={questionTexts}
              onClickAction={() => onSelectAssetAction(moderation.muxAssetId)}
              onModerateAction={() => triggerModeration({ muxAssetId: moderation.muxAssetId })}
            />
          ))}
        </TableShell>
      )}
    </div>
  );
}
