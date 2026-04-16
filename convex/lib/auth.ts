import {
  query,
  mutation,
  action,
  QueryCtx,
  MutationCtx,
  ActionCtx,
} from "../_generated/server";
import { internal } from "../_generated/api";
import { v, PropertyValidators } from "convex/values";

async function validateSession(
  ctx: QueryCtx | MutationCtx,
  token: string
) {
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .first();
  if (!session) throw new Error("Invalid session");
  if (session.expiresAt < Date.now()) throw new Error("Session expired");
}

async function validateSessionFromAction(
  ctx: ActionCtx,
  token: string
) {
  const valid: boolean = await ctx.runQuery(
    internal.sessions.validate,
    { token }
  );
  if (!valid) throw new Error("Invalid or expired session");
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export function authenticatedQuery<R>(config: {
  args: PropertyValidators;
  handler: (ctx: QueryCtx, args: any) => R;
}) {
  return query({
    args: { ...config.args, sessionToken: v.string() },
    handler: async (ctx, args): Promise<Awaited<R>> => {
      const { sessionToken, ...rest } = args;
      await validateSession(ctx, sessionToken);
      return config.handler(ctx, rest) as Awaited<R>;
    },
  });
}

export function authenticatedMutation<R>(config: {
  args: PropertyValidators;
  handler: (ctx: MutationCtx, args: any) => R;
}) {
  return mutation({
    args: { ...config.args, sessionToken: v.string() },
    handler: async (ctx, args): Promise<Awaited<R>> => {
      const { sessionToken, ...rest } = args;
      await validateSession(ctx, sessionToken);
      return config.handler(ctx, rest) as Awaited<R>;
    },
  });
}

export function authenticatedAction<R>(config: {
  args: PropertyValidators;
  handler: (ctx: ActionCtx, args: any) => R;
}) {
  return action({
    args: { ...config.args, sessionToken: v.string() },
    handler: async (ctx, args): Promise<Awaited<R>> => {
      const { sessionToken, ...rest } = args;
      await validateSessionFromAction(ctx, sessionToken);
      return config.handler(ctx, rest) as Awaited<R>;
    },
  });
}
