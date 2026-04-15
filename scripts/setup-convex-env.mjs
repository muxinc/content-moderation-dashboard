/**
 * Pushes Mux environment variables from Vercel → Convex.
 *
 * Runs during the Vercel build (before `npx convex deploy`).
 * Requires CONVEX_DEPLOY_KEY to be set by the Convex Vercel integration.
 */

import { execFileSync } from "node:child_process";

const ENV_VARS = ["MUX_TOKEN_ID", "MUX_TOKEN_SECRET", "MUX_WEBHOOK_SECRET"];

for (const name of ENV_VARS) {
  const value = process.env[name];
  if (!value) {
    console.log(`[setup-convex-env] ${name} not set, skipping`);
    continue;
  }
  console.log(`[setup-convex-env] Setting ${name} in Convex...`);
  execFileSync("npx", ["convex", "env", "set", name, value], {
    stdio: "inherit",
  });
}
