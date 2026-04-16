"use client";

import { useState, useCallback, Suspense } from "react";
import { useAuthQuery } from "@/lib/convex-auth";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "../../convex/_generated/api";
import { UploadForm } from "@/components/UploadForm";
import { ModerationResultsView } from "@/components/ModerationResultsView";
import { BackfillPanel } from "@/components/BackfillPanel";
import { AssetDrawer } from "@/components/AssetDrawer";
import { ConfigurationModal } from "@/components/ConfigurationModal";

export type Thresholds = {
  sexual: { review: number; reject?: number };
  violence: { review: number; reject?: number };
};

export type JobFilter = undefined | "processing" | "completed" | "failed";
export type ReviewFilter =
  | undefined
  | "unreviewed"
  | "approved"
  | "auto-approved"
  | "auto-rejected"
  | "rejected";
export type ClassificationFilter = undefined | "pass" | "review" | "reject";

const DEFAULT_THRESHOLDS: Thresholds = {
  sexual: { review: 0.9 },
  violence: { review: 0.9 },
};

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const [showConfig, setShowConfig] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  // All filter state lives in URL query params
  const jobFilter = (searchParams.get("job") || undefined) as JobFilter;
  const reviewFilter = (searchParams.get("review") || undefined) as ReviewFilter;
  const classificationFilter = (searchParams.get("classification") || undefined) as ClassificationFilter;
  const selectedAssetId = searchParams.get("asset");

  const setParam = useCallback(
    (key: string, value: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      const qs = params.toString();
      router.push(qs ? `?${qs}` : "/", { scroll: false });
    },
    [searchParams, router]
  );

  const setJobFilter = useCallback((f: JobFilter) => setParam("job", f), [setParam]);
  const setReviewFilter = useCallback((f: ReviewFilter) => setParam("review", f), [setParam]);
  const setClassificationFilter = useCallback((f: ClassificationFilter) => setParam("classification", f), [setParam]);

  const moderationData = useAuthQuery(api.moderation.listWithAssets, {
    limit: 50,
    jobFilter,
    reviewFilter,
    classificationFilter,
  });

  const settings = useAuthQuery(api.settings.get, {});

  const openAsset = useCallback(
    (muxAssetId: string) => setParam("asset", muxAssetId),
    [setParam]
  );

  const closeDrawer = useCallback(() => setParam("asset", undefined), [setParam]);

  const hasAnyFilter = jobFilter || reviewFilter || classificationFilter;
  const resetFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("job");
    params.delete("review");
    params.delete("classification");
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

      {showConfig && (
        <ConfigurationModal
          thresholds={thresholds}
          onCloseAction={() => setShowConfig(false)}
        />
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-4">
        <ModerationResultsView
          data={moderationData ?? null}
          thresholds={thresholds}
          jobFilter={jobFilter}
          reviewFilter={reviewFilter}
          classificationFilter={classificationFilter}
          hasAnyFilter={!!hasAnyFilter}
          onJobFilterChangeAction={setJobFilter}
          onReviewFilterChangeAction={setReviewFilter}
          onClassificationFilterChangeAction={setClassificationFilter}
          onResetFiltersAction={resetFilters}
          onSelectAssetAction={openAsset}
        />
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
