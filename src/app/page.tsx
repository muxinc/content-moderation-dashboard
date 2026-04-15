"use client";

import { useState, useCallback, Suspense } from "react";
import { useQuery } from "convex/react";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "../../convex/_generated/api";
import { UploadForm } from "@/components/UploadForm";
import { AllAssetsView } from "@/components/AllAssetsView";
import { ModerationResultsView } from "@/components/ModerationResultsView";
import { BackfillPanel } from "@/components/BackfillPanel";
import { ThresholdSettings } from "@/components/ThresholdSettings";
import { AssetDrawer } from "@/components/AssetDrawer";
import { QuestionManager } from "@/components/QuestionManager";

export type Thresholds = {
  sexual: { review: number; reject?: number };
  violence: { review: number; reject?: number };
};

export type JobFilter = undefined | "processing" | "completed" | "failed";
export type ReviewFilter =
  | undefined
  | "unreviewed"
  | "approved"
  | "auto-rejected"
  | "rejected";

const DEFAULT_THRESHOLDS: Thresholds = {
  sexual: { review: 0.9 },
  violence: { review: 0.9 },
};

const PAGE_SIZE = 25;

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const [tab, setTab] = useState<"assets" | "moderation">("moderation");
  const [assetsOffset, setAssetsOffset] = useState(0);
  const [jobFilter, setJobFilter] = useState<JobFilter>(undefined);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>(undefined);
  const [showConfig, setShowConfig] = useState(false);

  const assetsData = useQuery(api.videoQueries.listAssetsWithModeration, {
    limit: PAGE_SIZE,
    offset: assetsOffset,
  });

  const moderationData = useQuery(api.moderation.listWithAssets, {
    limit: 50,
    jobFilter: jobFilter,
    reviewFilter: reviewFilter,
  });

  const settings = useQuery(api.settings.get);
  const searchParams = useSearchParams();
  const router = useRouter();

  const selectedAssetId = searchParams.get("asset");

  const openAsset = useCallback(
    (muxAssetId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("asset", muxAssetId);
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [searchParams, router]
  );

  const closeDrawer = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("asset");
    const qs = params.toString();
    router.push(qs ? `?${qs}` : "/", { scroll: false });
  }, [searchParams, router]);

  const thresholds: Thresholds = settings
    ? {
        sexual: { review: settings.sexual.review, reject: settings.sexual.reject },
        violence: { review: settings.violence.review, reject: settings.violence.reject },
      }
    : DEFAULT_THRESHOLDS;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              Content Moderator
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Automated video content moderation powered by Mux
            </p>
          </div>
          <div className="flex items-center gap-3">
            <UploadForm />
            <BackfillPanel />
            <button
              onClick={() => setShowConfig(!showConfig)}
              className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                showConfig
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100"
                  : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              Configuration
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-4">
        {/* Collapsible configuration panel */}
        {showConfig && (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Configuration
              </h2>
              <button
                onClick={() => setShowConfig(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-sm"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ThresholdSettings thresholds={thresholds} />
              <QuestionManager />
            </div>
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setTab("assets")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === "assets"
                ? "border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            All Assets
          </button>
          <button
            onClick={() => setTab("moderation")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === "moderation"
                ? "border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            Moderation Results
          </button>
        </div>

        {tab === "assets" ? (
          <AllAssetsView
            data={assetsData ?? null}
            thresholds={thresholds}
            onSelectAssetAction={openAsset}
            offset={assetsOffset}
            onPageChangeAction={setAssetsOffset}
            pageSize={PAGE_SIZE}
          />
        ) : (
          <ModerationResultsView
            data={moderationData ?? null}
            thresholds={thresholds}
            jobFilter={jobFilter}
            reviewFilter={reviewFilter}
            onJobFilterChangeAction={setJobFilter}
            onReviewFilterChangeAction={setReviewFilter}
            onSelectAssetAction={openAsset}
          />
        )}
      </main>

      {selectedAssetId && (
        <AssetDrawer
          muxAssetId={selectedAssetId}
          thresholds={thresholds}
          onCloseAction={closeDrawer}
        />
      )}
    </div>
  );
}
