"use node";

import Mux from "@mux/mux-node";
import { action } from "./_generated/server";
import { v } from "convex/values";

function requiredEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

export const createUploadUrl = action({
  args: {
    corsOrigin: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const mux = new Mux({
      tokenId: requiredEnv("MUX_TOKEN_ID", process.env.MUX_TOKEN_ID),
      tokenSecret: requiredEnv("MUX_TOKEN_SECRET", process.env.MUX_TOKEN_SECRET),
    });

    const upload = await mux.video.uploads.create({
      cors_origin: args.corsOrigin ?? "*",
      new_asset_settings: {
        playback_policy: ["public"],
      },
    });

    return {
      uploadUrl: upload.url,
      uploadId: upload.id,
    };
  },
});
