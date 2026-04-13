"use client";

import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCallback, useRef, useState } from "react";

export function UploadForm() {
  const createUploadUrl = useAction(api.uploads.createUploadUrl);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      setProgress(0);

      try {
        const { uploadUrl } = await createUploadUrl({
          corsOrigin: window.location.origin,
        });

        const xhr = new XMLHttpRequest();
        await new Promise<void>((resolve, reject) => {
          xhr.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable) {
              setProgress(Math.round((event.loaded / event.total) * 100));
            }
          });
          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`Upload failed: ${xhr.status}`));
          });
          xhr.addEventListener("error", () => reject(new Error("Upload failed")));
          xhr.open("PUT", uploadUrl);
          xhr.send(file);
        });

        setTimeout(() => {
          setUploading(false);
          setProgress(0);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }, 1500);
      } catch {
        setUploading(false);
      }
    },
    [createUploadUrl]
  );

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,audio/*"
        disabled={uploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
        }}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
      />
      <button
        disabled={uploading}
        className="px-3 py-2 text-sm font-medium bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
      >
        {uploading ? `Uploading ${progress}%` : "Upload Video"}
      </button>
    </div>
  );
}
