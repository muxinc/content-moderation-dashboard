"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuthQuery } from "@/lib/convex-auth";
import { api } from "../../../convex/_generated/api";

export default function WebhooksPage() {
  const logs = useAuthQuery(api.moderation.listWebhookLogs, { limit: 100 });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Webhook Logs</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Delivery history for rejected webhooks
            </p>
          </div>
          <Link
            href="/"
            className="px-3 py-2 text-sm font-medium rounded-lg border bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6">
        {logs === undefined ? (
          <div className="text-sm text-zinc-400 py-8 text-center">
            Loading...
          </div>
        ) : logs.length === 0 ? (
          <div className="text-sm text-zinc-400 py-8 text-center">
            No webhook deliveries yet. Configure a webhook URL in{" "}
            <Link href="/" className="underline hover:text-zinc-600">
              Configuration
            </Link>{" "}
            to get started.
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => {
              const isExpanded = expandedId === log._id;
              const isSuccess =
                log.httpStatus !== undefined &&
                log.httpStatus >= 200 &&
                log.httpStatus < 300;
              const isError = !!log.error || (log.httpStatus !== undefined && log.httpStatus >= 400);

              return (
                <div
                  key={log._id}
                  className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() =>
                      setExpandedId(isExpanded ? null : log._id)
                    }
                    className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <span
                      className={`inline-flex w-2 h-2 rounded-full flex-shrink-0 ${
                        isError
                          ? "bg-red-500"
                          : isSuccess
                            ? "bg-emerald-500"
                            : "bg-yellow-500"
                      }`}
                    />
                    <span className="text-sm font-mono text-zinc-700 dark:text-zinc-300 flex-1 truncate">
                      {log.muxAssetId}
                    </span>
                    <span
                      className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        log.trigger === "manual"
                          ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                          : log.trigger === "rule"
                            ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400"
                            : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                      }`}
                    >
                      {log.trigger}
                    </span>
                    {log.httpStatus !== undefined && (
                      <span
                        className={`text-xs font-mono ${
                          isSuccess
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {log.httpStatus}
                      </span>
                    )}
                    {log.error && !log.httpStatus && (
                      <span className="text-xs text-red-500">
                        Failed
                      </span>
                    )}
                    <span className="text-xs text-zinc-400 tabular-nums flex-shrink-0">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                    <svg
                      className={`w-4 h-4 text-zinc-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-3 space-y-3 bg-zinc-50 dark:bg-zinc-900/50">
                      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                        <span className="text-zinc-400">URL</span>
                        <span className="font-mono text-zinc-600 dark:text-zinc-400 break-all">
                          {log.webhookUrl}
                        </span>
                        <span className="text-zinc-400">Event</span>
                        <span className="text-zinc-600 dark:text-zinc-400">
                          {log.event}
                        </span>
                        <span className="text-zinc-400">Trigger</span>
                        <span className="text-zinc-600 dark:text-zinc-400">
                          {log.trigger}
                        </span>
                        {log.httpStatus !== undefined && (
                          <>
                            <span className="text-zinc-400">Status</span>
                            <span
                              className={`font-mono ${
                                isSuccess
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-red-600 dark:text-red-400"
                              }`}
                            >
                              {log.httpStatus}
                            </span>
                          </>
                        )}
                        {log.error && (
                          <>
                            <span className="text-zinc-400">Error</span>
                            <span className="text-red-600 dark:text-red-400">
                              {log.error}
                            </span>
                          </>
                        )}
                      </div>

                      {log.requestBody && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                            Request Body
                          </p>
                          <pre className="text-xs font-mono bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3 overflow-x-auto text-zinc-700 dark:text-zinc-300 max-h-80">
                            {formatJson(log.requestBody)}
                          </pre>
                        </div>
                      )}

                      {log.responseBody && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                            Response Body
                          </p>
                          <pre className="text-xs font-mono bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3 overflow-x-auto text-zinc-700 dark:text-zinc-300 max-h-40">
                            {formatJson(log.responseBody)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function formatJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
}
