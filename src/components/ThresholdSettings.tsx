"use client";

import { useState, useEffect } from "react";
import { useAuthMutation } from "@/lib/convex-auth";
import { api } from "../../convex/_generated/api";
import type { Thresholds } from "@/app/page";

export function ThresholdSettings({
  thresholds,
}: {
  thresholds: Thresholds;
}) {
  const updateSettings = useAuthMutation(api.settings.update);

  const [local, setLocal] = useState({
    sexualReview: Math.round(thresholds.sexual.review * 100),
    sexualReject: thresholds.sexual.reject != null ? Math.round(thresholds.sexual.reject * 100) : ("" as string | number),
    violenceReview: Math.round(thresholds.violence.review * 100),
    violenceReject: thresholds.violence.reject != null ? Math.round(thresholds.violence.reject * 100) : ("" as string | number),
  });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setLocal({
      sexualReview: Math.round(thresholds.sexual.review * 100),
      sexualReject: thresholds.sexual.reject != null ? Math.round(thresholds.sexual.reject * 100) : "",
      violenceReview: Math.round(thresholds.violence.review * 100),
      violenceReject: thresholds.violence.reject != null ? Math.round(thresholds.violence.reject * 100) : "",
    });
    setDirty(false);
  }, [thresholds]);

  const sexualError =
    typeof local.sexualReject === "number" &&
    typeof local.sexualReview === "number" &&
    local.sexualReview > local.sexualReject;
  const violenceError =
    typeof local.violenceReject === "number" &&
    typeof local.violenceReview === "number" &&
    local.violenceReview > local.violenceReject;
  const hasError = sexualError || violenceError;

  const update = (field: keyof typeof local, raw: string) => {
    if (raw === "") {
      setLocal((prev) => ({ ...prev, [field]: "" }));
      setDirty(true);
      return;
    }
    const num = parseInt(raw, 10);
    if (isNaN(num)) return;
    const clamped = Math.max(0, Math.min(100, num));
    setLocal((prev) => ({ ...prev, [field]: clamped }));
    setDirty(true);
  };

  const save = async () => {
    if (hasError) return;
    const sexualReview = typeof local.sexualReview === "number" ? local.sexualReview : 90;
    const violenceReview = typeof local.violenceReview === "number" ? local.violenceReview : 90;
    await updateSettings({
      sexual: {
        review: sexualReview / 100,
        reject: typeof local.sexualReject === "number" ? local.sexualReject / 100 : undefined,
      },
      violence: {
        review: violenceReview / 100,
        reject: typeof local.violenceReject === "number" ? local.violenceReject / 100 : undefined,
      },
    });
    setDirty(false);
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
        Thresholds
      </h3>
      <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-2">
        Scores 0–100.{" "}
        <span className="text-yellow-600 dark:text-yellow-400">Review</span>
        {" = needs human review. "}
        <span className="text-red-600 dark:text-red-400">Reject</span>
        {" = auto-reject (leave blank to disable)."}
      </p>

      <div className="space-y-4">
        <DimensionInputs
          label="Sexual"
          review={local.sexualReview}
          reject={local.sexualReject}
          error={sexualError}
          onReviewChangeAction={(v) => update("sexualReview", v)}
          onRejectChangeAction={(v) => update("sexualReject", v)}
        />
        <DimensionInputs
          label="Violence"
          review={local.violenceReview}
          reject={local.violenceReject}
          error={violenceError}
          onReviewChangeAction={(v) => update("violenceReview", v)}
          onRejectChangeAction={(v) => update("violenceReject", v)}
        />
      </div>

      {hasError && (
        <p className="text-xs text-red-500 mt-3">
          Review threshold must be less than or equal to reject threshold.
        </p>
      )}

      <button
        onClick={save}
        disabled={!dirty || hasError}
        className="mt-3 px-4 py-1.5 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-lg text-xs font-medium hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
      >
        {dirty ? "Save Thresholds" : "Saved"}
      </button>
    </div>
  );
}

function DimensionInputs({
  label,
  review,
  reject,
  error,
  onReviewChangeAction,
  onRejectChangeAction,
}: {
  label: string;
  review: string | number;
  reject: string | number;
  error: boolean;
  onReviewChangeAction: (v: string) => void;
  onRejectChangeAction: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
        {label}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-yellow-600 dark:text-yellow-400 mb-1 block">
            Review
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={review}
            placeholder="90"
            onChange={(e) => onReviewChangeAction(e.target.value)}
            className={`w-full px-3 py-1.5 text-sm font-mono rounded-lg border bg-white dark:bg-zinc-800 transition-colors ${
              error
                ? "border-red-300 dark:border-red-700 focus:ring-red-500"
                : "border-zinc-200 dark:border-zinc-700 focus:ring-zinc-400"
            } focus:outline-none focus:ring-2`}
          />
        </div>
        <div>
          <label className="text-xs text-red-600 dark:text-red-400 mb-1 block">
            Reject <span className="text-zinc-400 font-normal">(optional)</span>
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={reject}
            placeholder="—"
            onChange={(e) => onRejectChangeAction(e.target.value)}
            className={`w-full px-3 py-1.5 text-sm font-mono rounded-lg border bg-white dark:bg-zinc-800 transition-colors ${
              error
                ? "border-red-300 dark:border-red-700 focus:ring-red-500"
                : "border-zinc-200 dark:border-zinc-700 focus:ring-zinc-400"
            } focus:outline-none focus:ring-2`}
          />
        </div>
      </div>
    </div>
  );
}
