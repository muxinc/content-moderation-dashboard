"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Thresholds } from "@/app/page";

export function ConfigurationModal({
  thresholds,
  onCloseAction,
}: {
  thresholds: Thresholds;
  onCloseAction: () => void;
}) {
  const settings = useQuery(api.settings.get);
  const updateSettings = useMutation(api.settings.update);
  const questions = useQuery(api.questions.list);
  const addQuestion = useMutation(api.questions.add);
  const removeQuestion = useMutation(api.questions.remove);

  const [newQuestion, setNewQuestion] = useState("");

  // Local threshold state
  const [local, setLocal] = useState({
    sexualReview: Math.round(thresholds.sexual.review * 100),
    sexualReject: thresholds.sexual.reject != null ? Math.round(thresholds.sexual.reject * 100) : ("" as string | number),
    violenceReview: Math.round(thresholds.violence.review * 100),
    violenceReject: thresholds.violence.reject != null ? Math.round(thresholds.violence.reject * 100) : ("" as string | number),
  });
  const [autoRejectEnabled, setAutoRejectEnabled] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [rejectionRules, setRejectionRules] = useState<{ question: string; answer: string }[]>([]);
  const [bypassRules, setBypassRules] = useState<{ question: string; answer: string }[]>([]);
  const [dirty, setDirty] = useState(false);

  // New rule inputs
  const [newRejectionQuestion, setNewRejectionQuestion] = useState("");
  const [newRejectionAnswer, setNewRejectionAnswer] = useState("yes");
  const [newBypassQuestion, setNewBypassQuestion] = useState("");
  const [newBypassAnswer, setNewBypassAnswer] = useState("yes");

  // Sync from server
  useEffect(() => {
    if (!settings) return;
    setLocal({
      sexualReview: Math.round(settings.sexual.review * 100),
      sexualReject: settings.sexual.reject != null ? Math.round(settings.sexual.reject * 100) : "",
      violenceReview: Math.round(settings.violence.review * 100),
      violenceReject: settings.violence.reject != null ? Math.round(settings.violence.reject * 100) : "",
    });
    setAutoRejectEnabled(settings.autoRejectEnabled);
    setWebhookUrl(settings.rejectedWebhookUrl);
    setRejectionRules(settings.rejectionRules);
    setBypassRules(settings.bypassRules);
    setDirty(false);
  }, [settings]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseAction();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onCloseAction]);

  const sexualError =
    typeof local.sexualReject === "number" &&
    typeof local.sexualReview === "number" &&
    local.sexualReview > local.sexualReject;
  const violenceError =
    typeof local.violenceReject === "number" &&
    typeof local.violenceReview === "number" &&
    local.violenceReview > local.violenceReject;
  const hasError = sexualError || violenceError;

  const updateField = (field: keyof typeof local, raw: string) => {
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
      autoRejectEnabled,
      rejectedWebhookUrl: webhookUrl || undefined,
      rejectionRules,
      bypassRules,
    });
    setDirty(false);
  };

  const handleAddQuestion = async () => {
    const trimmed = newQuestion.trim();
    if (!trimmed) return;
    await addQuestion({ question: trimmed });
    setNewQuestion("");
  };

  const addRejectionRule = () => {
    if (!newRejectionQuestion) return;
    setRejectionRules((prev) => [...prev, { question: newRejectionQuestion, answer: newRejectionAnswer }]);
    setNewRejectionQuestion("");
    setDirty(true);
  };

  const removeRejectionRule = (i: number) => {
    setRejectionRules((prev) => prev.filter((_, idx) => idx !== i));
    setDirty(true);
  };

  const addBypassRule = () => {
    if (!newBypassQuestion) return;
    setBypassRules((prev) => [...prev, { question: newBypassQuestion, answer: newBypassAnswer }]);
    setNewBypassQuestion("");
    setDirty(true);
  };

  const removeBypassRule = (i: number) => {
    setBypassRules((prev) => prev.filter((_, idx) => idx !== i));
    setDirty(true);
  };

  const questionTexts = questions?.map((q) => q.question) ?? [];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onCloseAction} />

      {/* Modal */}
      <div className="fixed inset-4 md:inset-8 lg:inset-y-8 lg:inset-x-16 xl:inset-y-12 xl:inset-x-32 bg-white dark:bg-zinc-900 rounded-2xl z-50 overflow-y-auto shadow-2xl border border-zinc-200 dark:border-zinc-800">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-8 py-5 flex items-center justify-between z-10 rounded-t-2xl">
          <h2 className="text-lg font-semibold">Configuration</h2>
          <div className="flex items-center gap-3">
            {dirty && (
              <button
                onClick={save}
                disabled={hasError}
                className="px-4 py-1.5 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-lg text-sm font-medium hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
              >
                Save Changes
              </button>
            )}
            <button
              onClick={onCloseAction}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-xl leading-none px-2"
            >
              &times;
            </button>
          </div>
        </div>

        <div className="p-8 space-y-10 max-w-4xl mx-auto">
          {/* ── Section: Thresholds ── */}
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
              Thresholds
            </h3>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-4">
              Scores 0–100.{" "}
              <span className="text-yellow-600 dark:text-yellow-400">Review</span>
              {" = needs human review. "}
              <span className="text-red-600 dark:text-red-400">Reject</span>
              {" = auto-reject threshold (leave blank to disable)."}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <DimensionInputs
                label="Sexual"
                review={local.sexualReview}
                reject={local.sexualReject}
                error={sexualError}
                onReviewChange={(v) => updateField("sexualReview", v)}
                onRejectChange={(v) => updateField("sexualReject", v)}
              />
              <DimensionInputs
                label="Violence"
                review={local.violenceReview}
                reject={local.violenceReject}
                error={violenceError}
                onReviewChange={(v) => updateField("violenceReview", v)}
                onRejectChange={(v) => updateField("violenceReject", v)}
              />
            </div>
            {hasError && (
              <p className="text-xs text-red-500 mt-3">
                Review threshold must be less than or equal to reject threshold.
              </p>
            )}
          </section>

          {/* ── Section: Auto-Reject ── */}
          <section>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Auto-Reject
              </h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-zinc-500">{autoRejectEnabled ? "Enabled" : "Disabled"}</span>
                <button
                  onClick={() => { setAutoRejectEnabled(!autoRejectEnabled); setDirty(true); }}
                  className={`relative w-9 h-5 rounded-full transition-colors ${
                    autoRejectEnabled ? "bg-red-500" : "bg-zinc-300 dark:bg-zinc-600"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      autoRejectEnabled ? "translate-x-4" : ""
                    }`}
                  />
                </button>
              </label>
            </div>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-4">
              When enabled, assets scoring above the reject threshold are automatically rejected.
              Set reject thresholds above to define the trigger point.
            </p>
          </section>

          {/* ── Section: Q&A Questions ── */}
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
              Q&A Questions
            </h3>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-4">
              Asked about every video via Mux Robots. Answers are yes/no.
              Used for rejection rules and bypass rules below.
            </p>

            {questions && questions.length > 0 && (
              <div className="space-y-2 mb-4">
                {questions.map((q) => (
                  <div
                    key={q._id}
                    className="flex items-center gap-2 text-sm bg-zinc-50 dark:bg-zinc-800/50 rounded-lg px-3 py-2"
                  >
                    <span className="flex-1 text-zinc-700 dark:text-zinc-300">{q.question}</span>
                    <button
                      onClick={() => removeQuestion({ id: q._id })}
                      className="text-zinc-400 hover:text-red-500 text-xs flex-shrink-0 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddQuestion()}
                placeholder="e.g. Is this an animated video?"
                className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              />
              <button
                onClick={handleAddQuestion}
                disabled={!newQuestion.trim()}
                className="px-3 py-1.5 text-sm font-medium bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-lg hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
              >
                Add
              </button>
            </div>
          </section>

          {/* ── Section: Rejection Rules ── */}
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
              Rejection Rules
            </h3>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-4">
              Reject an asset based on Q&A answers, independent of score thresholds.
              For example: &quot;Reject if &apos;Is this a professional sports broadcast?&apos; is YES.&quot;
            </p>

            {rejectionRules.length > 0 && (
              <div className="space-y-2 mb-4">
                {rejectionRules.map((rule, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 rounded-lg px-3 py-2">
                    <span className="flex-1 text-zinc-700 dark:text-zinc-300">
                      Reject if &quot;{rule.question}&quot; is <strong>{rule.answer}</strong>
                    </span>
                    <button
                      onClick={() => removeRejectionRule(i)}
                      className="text-zinc-400 hover:text-red-500 text-xs flex-shrink-0 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            {questionTexts.length > 0 ? (
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="text-xs text-zinc-400 mb-1 block">Question</label>
                  <select
                    value={newRejectionQuestion}
                    onChange={(e) => setNewRejectionQuestion(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  >
                    <option value="">Select a question...</option>
                    {questionTexts.map((q) => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                  </select>
                </div>
                <div className="w-24">
                  <label className="text-xs text-zinc-400 mb-1 block">Answer</label>
                  <select
                    value={newRejectionAnswer}
                    onChange={(e) => setNewRejectionAnswer(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  >
                    <option value="yes">yes</option>
                    <option value="no">no</option>
                  </select>
                </div>
                <button
                  onClick={addRejectionRule}
                  disabled={!newRejectionQuestion}
                  className="px-3 py-1.5 text-sm font-medium bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-lg hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
                >
                  Add
                </button>
              </div>
            ) : (
              <p className="text-xs text-zinc-400 italic">Add Q&A questions above to create rejection rules.</p>
            )}
          </section>

          {/* ── Section: Bypass Rules ── */}
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
              Auto-Reject Bypass Rules
            </h3>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-4">
              Exceptions to score-based auto-reject. If a bypass rule matches, the asset won&apos;t be auto-rejected even if it exceeds the threshold.
              For example: &quot;Don&apos;t auto-reject if &apos;Is this a person doing exercise?&apos; is YES.&quot;
            </p>

            {bypassRules.length > 0 && (
              <div className="space-y-2 mb-4">
                {bypassRules.map((rule, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800/50 rounded-lg px-3 py-2">
                    <span className="flex-1 text-zinc-700 dark:text-zinc-300">
                      Don&apos;t auto-reject if &quot;{rule.question}&quot; is <strong>{rule.answer}</strong>
                    </span>
                    <button
                      onClick={() => removeBypassRule(i)}
                      className="text-zinc-400 hover:text-red-500 text-xs flex-shrink-0 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            {questionTexts.length > 0 ? (
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="text-xs text-zinc-400 mb-1 block">Question</label>
                  <select
                    value={newBypassQuestion}
                    onChange={(e) => setNewBypassQuestion(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  >
                    <option value="">Select a question...</option>
                    {questionTexts.map((q) => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                  </select>
                </div>
                <div className="w-24">
                  <label className="text-xs text-zinc-400 mb-1 block">Answer</label>
                  <select
                    value={newBypassAnswer}
                    onChange={(e) => setNewBypassAnswer(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  >
                    <option value="yes">yes</option>
                    <option value="no">no</option>
                  </select>
                </div>
                <button
                  onClick={addBypassRule}
                  disabled={!newBypassQuestion}
                  className="px-3 py-1.5 text-sm font-medium bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-lg hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
                >
                  Add
                </button>
              </div>
            ) : (
              <p className="text-xs text-zinc-400 italic">Add Q&A questions above to create bypass rules.</p>
            )}
          </section>

          {/* ── Section: Webhook ── */}
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
              Rejected Webhook
            </h3>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-4">
              When an asset is rejected (auto-reject, rule-based, or manual), send a POST request to this URL.
              The body includes the asset ID, trigger type, and timestamp.
            </p>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => { setWebhookUrl(e.target.value); setDirty(true); }}
              placeholder="https://example.com/webhooks/rejected"
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400 font-mono"
            />
          </section>

          {/* Save bar at bottom */}
          {dirty && (
            <div className="sticky bottom-0 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 -mx-8 px-8 py-4 flex items-center justify-between">
              <p className="text-xs text-zinc-400">You have unsaved changes.</p>
              <button
                onClick={save}
                disabled={hasError}
                className="px-6 py-2 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-lg text-sm font-medium hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
              >
                Save Changes
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function DimensionInputs({
  label,
  review,
  reject,
  error,
  onReviewChange,
  onRejectChange,
}: {
  label: string;
  review: string | number;
  reject: string | number;
  error: boolean;
  onReviewChange: (v: string) => void;
  onRejectChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
        {label}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-yellow-600 dark:text-yellow-400 mb-1 block">Review</label>
          <input
            type="number"
            min={0}
            max={100}
            value={review}
            placeholder="90"
            onChange={(e) => onReviewChange(e.target.value)}
            className={`w-full px-3 py-1.5 text-sm font-mono rounded-lg border bg-white dark:bg-zinc-800 transition-colors ${
              error ? "border-red-300 dark:border-red-700" : "border-zinc-200 dark:border-zinc-700"
            } focus:outline-none focus:ring-2 focus:ring-zinc-400`}
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
            onChange={(e) => onRejectChange(e.target.value)}
            className={`w-full px-3 py-1.5 text-sm font-mono rounded-lg border bg-white dark:bg-zinc-800 transition-colors ${
              error ? "border-red-300 dark:border-red-700" : "border-zinc-200 dark:border-zinc-700"
            } focus:outline-none focus:ring-2 focus:ring-zinc-400`}
          />
        </div>
      </div>
    </div>
  );
}
