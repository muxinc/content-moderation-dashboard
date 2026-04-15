"use client";

import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function BackfillPanel() {
  const backfillMux = useAction(api.migrations.backfillMux);
  const settings = useQuery(api.settings.get);
  const questions = useQuery(api.questions.list);
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [maxAssets, setMaxAssets] = useState(50);

  const handleImport = async () => {
    setRunning(true);
    try {
      await backfillMux({ maxAssets, includeVideoMetadata: true, runModeration: true });
    } catch {
      // ignore
    }
    setTimeout(() => {
      setRunning(false);
      setOpen(false);
    }, 2000);
  };

  const hasQuestions = (questions?.length ?? 0) > 0;
  const hasRejectThreshold =
    (settings?.sexual.reject != null) || (settings?.violence.reject != null);
  const configReady = hasQuestions || hasRejectThreshold;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-2 text-sm font-medium bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
      >
        Import Assets
      </button>

      {open && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setOpen(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xl w-full max-w-md">
              <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Import Assets</h2>
                <button
                  onClick={() => setOpen(false)}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-xl leading-none px-2"
                >
                  &times;
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* Config reminder */}
                {!configReady && (
                  <div className="rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800/50 p-3">
                    <p className="text-xs text-yellow-700 dark:text-yellow-400 font-medium mb-1">
                      Configuration recommended
                    </p>
                    <p className="text-xs text-yellow-600 dark:text-yellow-500">
                      Set up thresholds, Q&A questions, and auto-reject rules before importing.
                      Imported assets skip auto-reject to prevent accidental bulk rejections.
                    </p>
                  </div>
                )}

                {/* Current settings summary */}
                <div className="text-xs space-y-1.5 text-zinc-500 dark:text-zinc-400">
                  <p className="font-medium text-zinc-700 dark:text-zinc-300 text-sm">Current Configuration</p>
                  <p>
                    Review thresholds: Sexual {Math.round((settings?.sexual.review ?? 0.9) * 100)}
                    , Violence {Math.round((settings?.violence.review ?? 0.9) * 100)}
                  </p>
                  <p>
                    Reject thresholds:{" "}
                    {hasRejectThreshold
                      ? `Sexual ${settings?.sexual.reject != null ? Math.round(settings.sexual.reject * 100) : "—"}, Violence ${settings?.violence.reject != null ? Math.round(settings.violence.reject * 100) : "—"}`
                      : "Not set"}
                  </p>
                  <p>Q&A questions: {questions?.length ?? 0} configured</p>
                  <p>Auto-reject: {hasRejectThreshold ? "Enabled (threshold set)" : "Disabled (no threshold)"}</p>
                </div>

                {/* Number of assets */}
                <div>
                  <label htmlFor="maxAssets" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Number of assets to import
                  </label>
                  <input
                    id="maxAssets"
                    type="number"
                    min={1}
                    max={200}
                    value={maxAssets}
                    onChange={(e) => setMaxAssets(Math.min(200, Math.max(1, Number(e.target.value) || 1)))}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  />
                  <p className="text-xs text-zinc-400 mt-1">
                    Most recent assets first. Max 200.
                  </p>
                </div>

                <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
                  <p>Moderation will run on imported assets, rate-limited to ~1 job/sec.</p>
                  <p>Auto-reject is skipped for imported assets.</p>
                  <p className="text-zinc-400">
                    Estimated time: ~{Math.ceil(maxAssets * 3 / 60)} min for {maxAssets} assets.
                  </p>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-2">
                <button
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={running}
                  className="px-4 py-2 text-sm font-medium bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-lg hover:opacity-80 disabled:opacity-50 transition-opacity"
                >
                  {running ? "Importing..." : "Import"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
