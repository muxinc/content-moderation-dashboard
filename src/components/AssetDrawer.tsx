"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import MuxPlayer from "@mux/mux-player-react";
import type { Thresholds } from "@/app/page";

function formatScore(score: number): string {
  if (score < 0.001) return "<0.1%";
  return `${(score * 100).toFixed(1)}%`;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function scoreColor(
  score: number,
  reviewThreshold: number,
  rejectThreshold?: number
): string {
  if (rejectThreshold !== undefined && score >= rejectThreshold)
    return "text-red-600 dark:text-red-400";
  if (score >= reviewThreshold) return "text-yellow-600 dark:text-yellow-400";
  return "text-zinc-700 dark:text-zinc-300";
}

export function AssetDrawer({
  muxAssetId,
  thresholds,
  onCloseAction,
}: {
  muxAssetId: string;
  thresholds: Thresholds;
  onCloseAction: () => void;
}) {
  const moderation = useQuery(api.moderation.getByAssetId, { muxAssetId });
  const asset = useQuery(api.videoQueries.getAsset, { muxAssetId });
  const setReviewStatus = useMutation(api.moderation.setReviewStatus);
  const triggerModeration = useAction(api.moderationActions.triggerModeration);
  const [expandedFrame, setExpandedFrame] = useState<number | null>(null);
  const [thumbnailFilter, setThumbnailFilter] = useState<"flagged" | "all">("flagged");

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (expandedFrame !== null) {
          setExpandedFrame(null);
        } else {
          onCloseAction();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onCloseAction, expandedFrame]);

  const playbackId = asset?.playbackIds?.[0]?.id;

  const classification = (() => {
    if (!moderation?.maxScores) return "pass" as const;
    const s = moderation.maxScores;
    const sr = thresholds.sexual.reject;
    const vr = thresholds.violence.reject;
    if ((sr !== undefined && s.sexual >= sr) || (vr !== undefined && s.violence >= vr))
      return "reject" as const;
    if (s.sexual >= thresholds.sexual.review || s.violence >= thresholds.violence.review)
      return "review" as const;
    return "pass" as const;
  })();

  const classificationBadge = {
    pass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    review: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    reject: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

  const classificationLabel = { pass: "Pass", review: "Needs Review", reject: "Reject" };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 transition-opacity"
        onClick={onCloseAction}
      />

      {/* Drawer — wider */}
      <div className="fixed top-0 right-0 h-full w-full max-w-2xl bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 z-50 overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold truncate">Asset Details</h2>
          <button
            onClick={onCloseAction}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-xl leading-none px-2"
          >
            &times;
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Video Player */}
          {playbackId ? (
            <div className="rounded-lg overflow-hidden bg-black aspect-video">
              <MuxPlayer
                playbackId={playbackId}
                streamType="on-demand"
                style={{ width: "100%", height: "100%" }}
              />
            </div>
          ) : (
            <div className="rounded-lg bg-zinc-100 dark:bg-zinc-800 aspect-video flex items-center justify-center">
              <span className="text-zinc-400 text-sm">No playback available</span>
            </div>
          )}

          {/* Asset Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Asset
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-zinc-400">Asset ID</p>
                <code className="text-xs font-mono text-zinc-600 dark:text-zinc-300 break-all">
                  {muxAssetId}
                </code>
              </div>
              <div>
                <p className="text-xs text-zinc-400">Playback ID</p>
                <code className="text-xs font-mono text-zinc-600 dark:text-zinc-300 break-all">
                  {playbackId ?? "—"}
                </code>
              </div>
              <div>
                <p className="text-xs text-zinc-400">Status</p>
                <p className="text-zinc-700 dark:text-zinc-300">{asset?.status ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-400">Duration</p>
                <p className="text-zinc-700 dark:text-zinc-300">
                  {asset?.durationSeconds ? `${Math.round(asset.durationSeconds)}s` : "—"}
                </p>
              </div>
              {asset?.aspectRatio && (
                <div>
                  <p className="text-xs text-zinc-400">Aspect Ratio</p>
                  <p className="text-zinc-700 dark:text-zinc-300">{asset.aspectRatio}</p>
                </div>
              )}
            </div>
          </div>

          {/* Moderation Results */}
          {moderation ? (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Moderation
              </h3>

              {/* Status & Classification */}
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={moderation.status} />
                <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold ${classificationBadge[classification]}`}>
                  {classificationLabel[classification]}
                </span>
                <ReviewBadge reviewStatus={moderation.reviewStatus} />
              </div>

              {moderation.error && (
                <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 p-3">
                  <p className="text-xs text-red-600 dark:text-red-400">{moderation.error}</p>
                </div>
              )}

              {/* Max Scores */}
              {moderation.maxScores && (
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800">
                    <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      Max Scores
                    </p>
                  </div>
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    <ScoreRow
                      label="Sexual"
                      score={moderation.maxScores.sexual}
                      reviewThreshold={thresholds.sexual.review}
                      rejectThreshold={thresholds.sexual.reject}
                    />
                    <ScoreRow
                      label="Violence"
                      score={moderation.maxScores.violence}
                      reviewThreshold={thresholds.violence.review}
                      rejectThreshold={thresholds.violence.reject}
                    />
                  </div>
                </div>
              )}

              {/* Q&A Answers */}
              {moderation.questionAnswers && moderation.questionAnswers.length > 0 && (
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800">
                    <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      Q&A Answers
                    </p>
                  </div>
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {moderation.questionAnswers.map((qa, i) => (
                      <div key={i} className="px-4 py-3">
                        <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-1">{qa.question}</p>
                        {qa.skipped ? (
                          <span className="text-xs text-zinc-400 italic">Skipped</span>
                        ) : (
                          <div className="flex items-center gap-3">
                            <span className={`text-sm font-semibold ${
                              qa.answer === "yes"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : qa.answer === "no"
                                  ? "text-zinc-600 dark:text-zinc-400"
                                  : "text-zinc-500"
                            }`}>
                              {qa.answer ?? "—"}
                            </span>
                            <span className="text-xs text-zinc-400">
                              {Math.round(qa.confidence * 100)}% confidence
                            </span>
                          </div>
                        )}
                        {qa.reasoning && (
                          <p className="text-xs text-zinc-400 mt-1">{qa.reasoning}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Per-frame scores with thumbnails */}
              {moderation.thumbnailScores && moderation.thumbnailScores.length > 0 && (() => {
                const allFrames = moderation.thumbnailScores.map((ts, i) => {
                  const sr = thresholds.sexual.reject;
                  const vr = thresholds.violence.reject;
                  const isReject =
                    (sr !== undefined && ts.sexual >= sr) || (vr !== undefined && ts.violence >= vr);
                  const isReview =
                    !isReject && (ts.sexual >= thresholds.sexual.review || ts.violence >= thresholds.violence.review);
                  const isFlagged = isReject || isReview;
                  return { ts, i, isReject, isReview, isFlagged };
                });
                const flaggedCount = allFrames.filter((f) => f.isFlagged).length;
                const visibleFrames = thumbnailFilter === "flagged"
                  ? allFrames.filter((f) => f.isFlagged)
                  : allFrames;

                return (
                  <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                    <div className="bg-zinc-50 dark:bg-zinc-800/50 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                      <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        Per-frame Scores ({moderation.thumbnailScores.length} sampled)
                      </p>
                      <div className="flex gap-1">
                        <button
                          onClick={() => { setThumbnailFilter("flagged"); setExpandedFrame(null); }}
                          className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors ${
                            thumbnailFilter === "flagged"
                              ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200"
                              : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                          }`}
                        >
                          Flagged ({flaggedCount})
                        </button>
                        <button
                          onClick={() => { setThumbnailFilter("all"); setExpandedFrame(null); }}
                          className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors ${
                            thumbnailFilter === "all"
                              ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200"
                              : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                          }`}
                        >
                          All
                        </button>
                      </div>
                    </div>
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {visibleFrames.length === 0 ? (
                        <div className="px-4 py-6 text-center">
                          <p className="text-xs text-zinc-400">No flagged frames</p>
                        </div>
                      ) : visibleFrames.map(({ ts, i, isReject, isReview }) => {
                        const frameBg = isReject
                          ? "bg-red-50/60 dark:bg-red-950/20"
                          : isReview
                            ? "bg-yellow-50/60 dark:bg-yellow-950/20"
                            : "";
                        const frameTime = ts.time ?? (
                          asset?.durationSeconds && moderation.thumbnailScores
                            ? (asset.durationSeconds / (moderation.thumbnailScores.length + 1)) * (i + 1)
                            : undefined
                        );
                        const isExpanded = expandedFrame === i;

                        return (
                          <div key={i} className={frameBg}>
                            <div
                              className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                              onClick={() => setExpandedFrame(isExpanded ? null : i)}
                            >
                              {/* Time */}
                              <span className="text-xs text-zinc-400 font-mono w-10 flex-shrink-0">
                                {frameTime != null ? formatTime(frameTime) : `#${i + 1}`}
                              </span>
                              {/* Scores */}
                              <div className="flex gap-4 flex-1">
                                <div className="text-center">
                                  <span className="text-[10px] text-zinc-400 block">Sexual</span>
                                  <span className={`font-mono text-xs ${scoreColor(ts.sexual, thresholds.sexual.review, thresholds.sexual.reject)}`}>
                                    {formatScore(ts.sexual)}
                                  </span>
                                </div>
                                <div className="text-center">
                                  <span className="text-[10px] text-zinc-400 block">Violence</span>
                                  <span className={`font-mono text-xs ${scoreColor(ts.violence, thresholds.violence.review, thresholds.violence.reject)}`}>
                                    {formatScore(ts.violence)}
                                  </span>
                                </div>
                              </div>
                              {/* Expand indicator */}
                              <span className="text-zinc-400 text-xs flex-shrink-0">
                                {isExpanded ? "▾" : "▸"}
                              </span>
                            </div>
                            {/* Expanded view — thumbnail only loads here */}
                            {isExpanded && (
                              <div className="px-4 pb-3">
                                {playbackId && frameTime != null ? (
                                  <img
                                    src={`https://image.mux.com/${playbackId}/thumbnail.webp?width=640&height=360&fit_mode=smartcrop&time=${frameTime}`}
                                    alt={`Frame at ${formatTime(frameTime)}`}
                                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700"
                                  />
                                ) : (
                                  <div className="w-full aspect-video rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center border border-zinc-200 dark:border-zinc-700">
                                    <span className="text-xs text-zinc-400">No thumbnail available — re-run moderation to generate</span>
                                  </div>
                                )}
                                <div className="flex gap-6 mt-2">
                                  <ScoreRow label="Sexual" score={ts.sexual} reviewThreshold={thresholds.sexual.review} rejectThreshold={thresholds.sexual.reject} />
                                  <ScoreRow label="Violence" score={ts.violence} reviewThreshold={thresholds.violence.review} rejectThreshold={thresholds.violence.reject} />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {moderation.robotsJobId && (
                  <div>
                    <p className="text-xs text-zinc-400">Robots Job ID</p>
                    <code className="text-[11px] font-mono text-zinc-500 break-all">
                      {moderation.robotsJobId}
                    </code>
                  </div>
                )}
                <div>
                  <p className="text-xs text-zinc-400">Created</p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-300">
                    {new Date(moderation.createdAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-400">Updated</p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-300">
                    {new Date(moderation.updatedAt).toLocaleString()}
                  </p>
                </div>
                {moderation.reviewedAt && (
                  <div>
                    <p className="text-xs text-zinc-400">Reviewed</p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-300">
                      {new Date(moderation.reviewedAt).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                {moderation.status === "completed" && (
                  <>
                    <button
                      onClick={() => setReviewStatus({ muxAssetId, reviewStatus: "approved" })}
                      disabled={moderation.reviewStatus === "approved"}
                      className="flex-1 px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => setReviewStatus({ muxAssetId, reviewStatus: "rejected" })}
                      disabled={moderation.reviewStatus === "rejected" || moderation.reviewStatus === "auto-rejected"}
                      className="flex-1 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      Reject
                    </button>
                  </>
                )}
                <button
                  onClick={() => triggerModeration({ muxAssetId })}
                  className="flex-1 px-4 py-2 text-sm font-medium border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Re-run Moderation
                </button>
              </div>
            </div>
          ) : moderation === null ? (
            <div className="text-center py-8">
              <p className="text-sm text-zinc-400">No moderation data yet.</p>
              <button
                onClick={() => triggerModeration({ muxAssetId })}
                className="mt-3 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Run Moderation
              </button>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-zinc-400">Loading moderation data...</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ScoreRow({
  label,
  score,
  reviewThreshold,
  rejectThreshold,
}: {
  label: string;
  score: number;
  reviewThreshold: number;
  rejectThreshold?: number;
}) {
  const zone =
    rejectThreshold !== undefined && score >= rejectThreshold
      ? "reject"
      : score >= reviewThreshold
        ? "review"
        : "pass";
  const barWidth = Math.max(score * 100, score > 0 ? 1 : 0);
  const barColor = { pass: "bg-emerald-500", review: "bg-yellow-500", reject: "bg-red-500" }[zone];
  const zoneLabel = { pass: "Pass", review: "Review", reject: "Reject" }[zone];
  const zoneBadge = {
    pass: "text-emerald-600 dark:text-emerald-400",
    review: "text-yellow-600 dark:text-yellow-400",
    reject: "text-red-600 dark:text-red-400",
  }[zone];

  return (
    <div className="px-4 py-3 space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-zinc-600 dark:text-zinc-300">{label}</span>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${zoneBadge}`}>{zoneLabel}</span>
          <span className={`font-mono text-sm font-semibold ${scoreColor(score, reviewThreshold, rejectThreshold)}`}>
            {formatScore(score)}
          </span>
        </div>
      </div>
      <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2.5 relative overflow-hidden">
        {rejectThreshold !== undefined && (
          <>
            <div
              className="absolute top-0 h-2.5 bg-yellow-200/40 dark:bg-yellow-800/20"
              style={{ left: `${reviewThreshold * 100}%`, width: `${(rejectThreshold - reviewThreshold) * 100}%` }}
            />
            <div
              className="absolute top-0 h-2.5 bg-red-200/40 dark:bg-red-800/20 rounded-r-full"
              style={{ left: `${rejectThreshold * 100}%`, width: `${(1 - rejectThreshold) * 100}%` }}
            />
          </>
        )}
        {rejectThreshold === undefined && (
          <div
            className="absolute top-0 h-2.5 bg-yellow-200/40 dark:bg-yellow-800/20 rounded-r-full"
            style={{ left: `${reviewThreshold * 100}%`, width: `${(1 - reviewThreshold) * 100}%` }}
          />
        )}
        <div
          className={`h-2.5 rounded-full transition-all duration-300 relative z-10 ${barColor}`}
          style={{ width: `${Math.min(barWidth, 100)}%` }}
        />
        <div className="absolute top-0 w-0.5 h-2.5 bg-yellow-500/60 z-20" style={{ left: `${reviewThreshold * 100}%` }} />
        {rejectThreshold !== undefined && (
          <div className="absolute top-0 w-0.5 h-2.5 bg-red-500/60 z-20" style={{ left: `${rejectThreshold * 100}%` }} />
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
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

function ReviewBadge({ reviewStatus }: { reviewStatus: string }) {
  const styles: Record<string, string> = {
    unreviewed: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
    approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    "auto-rejected": "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-300 border border-red-200 dark:border-red-800",
    rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
  const labels: Record<string, string> = {
    unreviewed: "unreviewed",
    approved: "approved",
    "auto-rejected": "auto-rejected",
    rejected: "rejected",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${styles[reviewStatus] ?? ""}`}>
      {labels[reviewStatus] ?? reviewStatus}
    </span>
  );
}
