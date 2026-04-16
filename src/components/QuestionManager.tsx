"use client";

import { useState } from "react";
import { useAuthQuery, useAuthMutation } from "@/lib/convex-auth";
import { api } from "../../convex/_generated/api";

export function QuestionManager() {
  const questions = useAuthQuery(api.questions.list, {});
  const addQuestion = useAuthMutation(api.questions.add);
  const removeQuestion = useAuthMutation(api.questions.remove);
  const [newQuestion, setNewQuestion] = useState("");

  const handleAdd = async () => {
    const trimmed = newQuestion.trim();
    if (!trimmed) return;
    await addQuestion({ question: trimmed });
    setNewQuestion("");
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
        Q&A Questions
      </h3>
      <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-3">
        Asked about every video via Mux Robots. Answers are yes/no.
      </p>

      {/* Existing questions */}
      {questions && questions.length > 0 && (
        <div className="space-y-2 mb-4">
          {questions.map((q) => (
            <div
              key={q._id}
              className="flex items-center gap-2 text-sm bg-zinc-50 dark:bg-zinc-800/50 rounded-lg px-3 py-2"
            >
              <span className="flex-1 text-zinc-700 dark:text-zinc-300">
                {q.question}
              </span>
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

      {/* Add new */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newQuestion}
          onChange={(e) => setNewQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="e.g. Is this an animated video?"
          className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400 transition-colors"
        />
        <button
          onClick={handleAdd}
          disabled={!newQuestion.trim()}
          className="px-3 py-1.5 text-sm font-medium bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-lg hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
        >
          Add
        </button>
      </div>
    </div>
  );
}
