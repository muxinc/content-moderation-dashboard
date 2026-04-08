"use client";

import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { AssetRow, TableShell } from "./TableShell";
import type { Thresholds } from "@/app/page";

type PageData = {
  items: Array<{
    asset: {
      muxAssetId?: string;
      status?: string;
      playbackIds?: Array<{ id: string; policy: string }>;
      durationSeconds?: number;
    };
    moderation: {
      _id: string;
      muxAssetId: string;
      status: "pending" | "processing" | "completed" | "failed";
      maxScores?: { sexual: number; violence: number };
      reviewStatus: "unreviewed" | "approved" | "rejected";
      questionAnswers?: Array<{ question: string; answer?: string; confidence: number; reasoning: string; skipped: boolean }>;
    } | null;
  }>;
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
};

export function AllAssetsView({
  data,
  thresholds,
  onSelectAssetAction,
  offset,
  onPageChangeAction,
  pageSize,
}: {
  data: PageData | null;
  thresholds: Thresholds;
  onSelectAssetAction: (muxAssetId: string) => void;
  offset: number;
  onPageChangeAction: (offset: number) => void;
  pageSize: number;
}) {
  const triggerModeration = useAction(api.moderationActions.triggerModeration);
  const questions = useQuery(api.questions.list);
  const questionTexts = questions?.map((q) => q.question) ?? [];

  if (!data) {
    return <div className="text-center py-12 text-zinc-400 text-sm">Loading...</div>;
  }

  const { items, total, hasMore } = data;

  if (items.length === 0 && offset === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-12 text-center">
        <p className="text-zinc-400 dark:text-zinc-500 text-sm">
          No assets yet. Upload a video or import existing assets to get started.
        </p>
      </div>
    );
  }

  const currentPage = Math.floor(offset / pageSize) + 1;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      <TableShell questions={questionTexts}>
        {items.map(({ asset, moderation }) => {
          const muxAssetId = asset.muxAssetId;
          if (!muxAssetId) return null;
          return (
            <AssetRow
              key={muxAssetId}
              muxAssetId={muxAssetId}
              playbackId={asset.playbackIds?.[0]?.id}
              duration={asset.durationSeconds}
              moderation={moderation}
              thresholds={thresholds}
              questions={questionTexts}
              onClickAction={() => onSelectAssetAction(muxAssetId)}
              onModerateAction={() => triggerModeration({ muxAssetId })}
            />
          );
        })}
      </TableShell>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-zinc-500">
            Showing {offset + 1}–{Math.min(offset + pageSize, total)} of {total} assets
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChangeAction(Math.max(0, offset - pageSize))}
              disabled={offset === 0}
              className="px-3 py-1.5 text-xs font-medium border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="text-zinc-400 text-xs">Page {currentPage} of {totalPages}</span>
            <button
              onClick={() => onPageChangeAction(offset + pageSize)}
              disabled={!hasMore}
              className="px-3 py-1.5 text-xs font-medium border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
