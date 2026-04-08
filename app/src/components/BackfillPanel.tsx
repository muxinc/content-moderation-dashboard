"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";

export function BackfillPanel() {
  const backfillMux = useAction(api.migrations.backfillMux);
  const [running, setRunning] = useState(false);

  const handleBackfill = async () => {
    setRunning(true);
    try {
      await backfillMux({ includeVideoMetadata: true, runModeration: true });
    } catch {
      // ignore
    }
    setTimeout(() => setRunning(false), 2000);
  };

  return (
    <button
      onClick={handleBackfill}
      disabled={running}
      className="px-3 py-2 text-sm font-medium bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
    >
      {running ? "Importing..." : "Import Assets"}
    </button>
  );
}
