"use client";

import { useState } from "react";
import { useAuthQuery, useAuthAction, useAuthMutation } from "@/lib/convex-auth";
import { api } from "../../convex/_generated/api";
import { AssetRow, TableShell } from "./TableShell";
import type { Thresholds, JobFilter, ReviewFilter, ClassificationFilter } from "@/app/page";

type ModerationItem = {
  moderation: {
    _id: string;
    muxAssetId: string;
    status: "pending" | "processing" | "completed" | "failed";
    maxScores?: { sexual: number; violence: number };
    reviewStatus: "unreviewed" | "approved" | "auto-approved" | "auto-rejected" | "rejected";
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
  { value: "auto-approved", label: "Auto-Approved", countKey: "autoApproved" },
  { value: "auto-rejected", label: "Auto-Rejected", countKey: "autoRejected" },
  { value: "rejected", label: "Rejected", countKey: "rejected" },
];

export function ModerationResultsView({
  data,
  thresholds,
  jobFilter,
  reviewFilter,
  classificationFilter,
  hasAnyFilter,
  onJobFilterChangeAction,
  onReviewFilterChangeAction,
  onClassificationFilterChangeAction,
  onResetFiltersAction,
  onSelectAssetAction,
}: {
  data: ModerationItem[] | null;
  thresholds: Thresholds;
  jobFilter: JobFilter;
  reviewFilter: ReviewFilter;
  classificationFilter: ClassificationFilter;
  hasAnyFilter: boolean;
  onJobFilterChangeAction: (f: JobFilter) => void;
  onReviewFilterChangeAction: (f: ReviewFilter) => void;
  onClassificationFilterChangeAction: (f: ClassificationFilter) => void;
  onResetFiltersAction: () => void;
  onSelectAssetAction: (muxAssetId: string) => void;
}) {
  const triggerModeration = useAuthAction(api.moderationActions.triggerModeration);
  const bulkSetReviewStatus = useAuthMutation(api.moderation.bulkSetReviewStatus);
  const counts = useAuthQuery(api.moderation.counts, {});
  const questions = useAuthQuery(api.questions.list, {});
  const questionTexts = questions?.map((q) => q.question) ?? [];
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allAssetIds = data?.map((d) => d.moderation.muxAssetId) ?? [];
  const allSelected = allAssetIds.length > 0 && allAssetIds.every((id) => selected.has(id));

  const toggleOne = (muxAssetId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(muxAssetId)) next.delete(muxAssetId);
      else next.add(muxAssetId);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allAssetIds));
    }
  };

  const handleBulkApprove = async () => {
    await bulkSetReviewStatus({ muxAssetIds: [...selected], reviewStatus: "approved" });
    setSelected(new Set());
  };

  const handleBulkReject = async () => {
    await bulkSetReviewStatus({ muxAssetIds: [...selected], reviewStatus: "rejected" });
    setSelected(new Set());
  };

  const handleBulkRerun = async () => {
    for (const id of selected) {
      await triggerModeration({ muxAssetId: id });
    }
    setSelected(new Set());
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
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
        <div className="flex-1" />
        <select
          value={classificationFilter ?? ""}
          onChange={(e) => onClassificationFilterChangeAction((e.target.value || undefined) as ClassificationFilter)}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400"
        >
          <option value="">All Classifications</option>
          <option value="pass">Pass</option>
          <option value="review">Review</option>
          <option value="reject">Reject</option>
        </select>
        <select
          value={jobFilter ?? ""}
          onChange={(e) => onJobFilterChangeAction((e.target.value || undefined) as JobFilter)}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400"
        >
          {JOB_FILTERS.map(({ value, label, countKey }) => {
            const count = counts?.[countKey as keyof typeof counts];
            return (
              <option key={label} value={value ?? ""}>
                {label === "All" ? "All Jobs" : label}{count != null ? ` (${count})` : ""}
              </option>
            );
          })}
        </select>
        {hasAnyFilter && (
          <button
            onClick={onResetFiltersAction}
            className="px-3 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
          >
            Reset
          </button>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg px-4 py-2.5">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {selected.size} selected
          </span>
          <div className="flex-1" />
          <button
            onClick={handleBulkApprove}
            className="px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
          >
            Bulk Approve
          </button>
          <button
            onClick={handleBulkReject}
            className="px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
          >
            Bulk Reject
          </button>
          <button
            onClick={handleBulkRerun}
            className="px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
          >
            Bulk Re-run
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="px-3 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      {!data ? (
        <div className="text-center py-12 text-zinc-400 text-sm">Loading...</div>
      ) : data.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-12 text-center">
          <p className="text-zinc-400 dark:text-zinc-500 text-sm">
            No moderation results match this filter.
          </p>
        </div>
      ) : (
        <TableShell questions={questionTexts} selectable onSelectAllAction={toggleAll} allSelected={allSelected}>
          {data.map(({ moderation, asset }) => (
            <AssetRow
              key={moderation._id}
              muxAssetId={moderation.muxAssetId}
              playbackId={asset?.playbackIds?.[0]?.id}
              duration={asset?.durationSeconds}
              moderation={moderation}
              thresholds={thresholds}
              questions={questionTexts}
              selectable
              selected={selected.has(moderation.muxAssetId)}
              onToggleSelectAction={() => toggleOne(moderation.muxAssetId)}
              onClickAction={() => onSelectAssetAction(moderation.muxAssetId)}
              onModerateAction={() => triggerModeration({ muxAssetId: moderation.muxAssetId })}
            />
          ))}
        </TableShell>
      )}
    </div>
  );
}
