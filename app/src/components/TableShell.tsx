"use client";

import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Thresholds } from "@/app/page";
import type { ReactNode } from "react";

type QuestionAnswer = {
  question: string;
  answer?: string;
  confidence: number;
  reasoning: string;
  skipped: boolean;
};

type ModerationData = {
  _id: string;
  muxAssetId: string;
  status: "pending" | "processing" | "completed" | "failed";
  maxScores?: { sexual: number; violence: number };
  reviewStatus: "unreviewed" | "approved" | "rejected";
  questionAnswers?: QuestionAnswer[];
} | null;

function formatScore(score: number): string {
  if (score < 0.001) return "<0.1%";
  return `${(score * 100).toFixed(1)}%`;
}

function scoreColor(
  score: number,
  reviewThreshold: number,
  rejectThreshold: number
): string {
  if (score >= rejectThreshold) return "text-red-600 dark:text-red-400 font-semibold";
  if (score >= reviewThreshold) return "text-yellow-600 dark:text-yellow-400 font-semibold";
  return "text-zinc-700 dark:text-zinc-300";
}

function classify(
  moderation: ModerationData,
  thresholds: Thresholds
): "clear" | "review" | "reject" | "none" {
  if (!moderation?.maxScores) return "none";
  const s = moderation.maxScores;
  if (s.sexual >= thresholds.sexual.reject || s.violence >= thresholds.violence.reject)
    return "reject";
  if (s.sexual >= thresholds.sexual.review || s.violence >= thresholds.violence.review)
    return "review";
  return "clear";
}

function rowBg(moderation: ModerationData, thresholds: Thresholds): string {
  const c = classify(moderation, thresholds);
  if (c === "reject") return "bg-red-50/60 dark:bg-red-950/20";
  if (c === "review") return "bg-yellow-50/60 dark:bg-yellow-950/20";
  return "";
}

export function TableShell({
  children,
  questions,
}: {
  children: ReactNode;
  questions?: string[];
}) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
            <th className="text-left px-4 py-2.5 font-medium text-zinc-500 dark:text-zinc-400 w-[200px]">Asset</th>
            <th className="text-left px-4 py-2.5 font-medium text-zinc-500 dark:text-zinc-400">Status</th>
            <th className="text-center px-4 py-2.5 font-medium text-zinc-500 dark:text-zinc-400">Sexual</th>
            <th className="text-center px-4 py-2.5 font-medium text-zinc-500 dark:text-zinc-400">Violence</th>
            <th className="text-center px-4 py-2.5 font-medium text-zinc-500 dark:text-zinc-400">Classification</th>
            <th className="text-center px-4 py-2.5 font-medium text-zinc-500 dark:text-zinc-400">Review</th>
            {questions?.map((q) => (
              <th
                key={q}
                className="text-center px-4 py-2.5 font-medium text-zinc-500 dark:text-zinc-400 max-w-[140px]"
                title={q}
              >
                <span className="block truncate text-xs">{q}</span>
              </th>
            ))}
            <th className="text-right px-4 py-2.5 font-medium text-zinc-500 dark:text-zinc-400">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {children}
        </tbody>
      </table>
    </div>
  );
}

export function AssetRow({
  muxAssetId,
  playbackId,
  duration,
  moderation,
  thresholds,
  questions,
  onClickAction,
  onModerateAction,
}: {
  muxAssetId: string;
  playbackId?: string;
  duration?: number;
  moderation: ModerationData;
  thresholds: Thresholds;
  questions?: string[];
  onClickAction: () => void;
  onModerateAction: () => void;
}) {
  const setReviewStatus = useMutation(api.moderation.setReviewStatus);
  const thumbUrl = playbackId
    ? `https://image.mux.com/${playbackId}/thumbnail.webp?width=160&height=90&fit_mode=smartcrop`
    : null;
  const c = classify(moderation, thresholds);

  // Build a map of question -> answer for quick lookup
  const answerMap = new Map<string, QuestionAnswer>();
  if (moderation?.questionAnswers) {
    for (const qa of moderation.questionAnswers) {
      answerMap.set(qa.question, qa);
    }
  }

  return (
    <tr
      className={`${rowBg(moderation, thresholds)} hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer`}
      onClick={onClickAction}
    >
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-3">
          {thumbUrl ? (
            <img src={thumbUrl} alt="" className="w-16 h-9 object-cover rounded flex-shrink-0" />
          ) : (
            <div className="w-16 h-9 rounded bg-zinc-100 dark:bg-zinc-800 flex-shrink-0" />
          )}
          <div className="min-w-0">
            <code className="text-[11px] text-zinc-400 font-mono block truncate max-w-[120px]">
              {muxAssetId.slice(0, 12)}...
            </code>
            {duration != null && (
              <span className="text-[10px] text-zinc-400">
                {Math.round(duration)}s
              </span>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-2.5">
        {moderation ? (
          <JobStatusBadge status={moderation.status} />
        ) : (
          <span className="text-xs text-zinc-400">unmoderated</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-center">
        {moderation?.maxScores ? (
          <span className={`font-mono text-sm ${scoreColor(moderation.maxScores.sexual, thresholds.sexual.review, thresholds.sexual.reject)}`}>
            {formatScore(moderation.maxScores.sexual)}
          </span>
        ) : (
          <span className="text-zinc-300 dark:text-zinc-600">—</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-center">
        {moderation?.maxScores ? (
          <span className={`font-mono text-sm ${scoreColor(moderation.maxScores.violence, thresholds.violence.review, thresholds.violence.reject)}`}>
            {formatScore(moderation.maxScores.violence)}
          </span>
        ) : (
          <span className="text-zinc-300 dark:text-zinc-600">—</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-center">
        <ClassificationBadge classification={c} />
      </td>
      <td className="px-4 py-2.5 text-center">
        {moderation ? (
          <ReviewBadge reviewStatus={moderation.reviewStatus} />
        ) : (
          <span className="text-zinc-300 dark:text-zinc-600">—</span>
        )}
      </td>
      {/* Q&A answer columns */}
      {questions?.map((q) => {
        const qa = answerMap.get(q);
        if (!qa) {
          return (
            <td key={q} className="px-4 py-2.5 text-center">
              <span className="text-zinc-300 dark:text-zinc-600">—</span>
            </td>
          );
        }
        if (qa.skipped) {
          return (
            <td key={q} className="px-4 py-2.5 text-center">
              <span className="text-xs text-zinc-400">skipped</span>
            </td>
          );
        }
        const answerColor =
          qa.answer === "yes"
            ? "text-emerald-600 dark:text-emerald-400"
            : qa.answer === "no"
              ? "text-zinc-600 dark:text-zinc-400"
              : "text-zinc-500";
        return (
          <td key={q} className="px-4 py-2.5 text-center" title={qa.reasoning}>
            <span className={`text-xs font-medium ${answerColor}`}>
              {qa.answer ?? "—"}
            </span>
            {qa.confidence > 0 && (
              <span className="text-[10px] text-zinc-400 ml-1">
                {Math.round(qa.confidence * 100)}%
              </span>
            )}
          </td>
        );
      })}
      <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          {moderation?.status === "completed" && (
            <>
              <button
                onClick={() => setReviewStatus({ muxAssetId, reviewStatus: "approved" })}
                disabled={moderation.reviewStatus === "approved"}
                className="px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Approve
              </button>
              <button
                onClick={() => setReviewStatus({ muxAssetId, reviewStatus: "rejected" })}
                disabled={moderation.reviewStatus === "rejected"}
                className="px-2 py-1 text-xs font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Reject
              </button>
            </>
          )}
          {!moderation && (
            <button
              onClick={onModerateAction}
              className="px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            >
              Moderate
            </button>
          )}
          {moderation && (
            <button
              onClick={onModerateAction}
              className="px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
            >
              Re-run
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function JobStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    processing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${styles[status] ?? styles.pending}`}>
      {status}
    </span>
  );
}

function ClassificationBadge({ classification }: { classification: "clear" | "review" | "reject" | "none" }) {
  if (classification === "none") return <span className="text-zinc-300 dark:text-zinc-600">—</span>;
  const config = {
    clear: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    review: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    reject: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
  const labels = { clear: "Clear", review: "Review", reject: "Reject" };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold ${config[classification]}`}>
      {labels[classification]}
    </span>
  );
}

function ReviewBadge({ reviewStatus }: { reviewStatus: string }) {
  const styles: Record<string, string> = {
    unreviewed: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
    approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${styles[reviewStatus] ?? ""}`}>
      {reviewStatus}
    </span>
  );
}
