"use client";

import { useQuery, useMutation, useAction } from "convex/react";
import { useSessionToken } from "./session";
import type { FunctionReference } from "convex/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunc = FunctionReference<any, "public", any, any>;

export function useAuthQuery<F extends AnyFunc>(
  func: F,
  args: Omit<F["_args"], "sessionToken"> | "skip"
) {
  const token = useSessionToken();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return useQuery(func as any, args === "skip" ? "skip" : { ...args, sessionToken: token }) as
    F["_returnType"] | undefined;
}

export function useAuthMutation<F extends AnyFunc>(func: F) {
  const token = useSessionToken();
  const mutate = useMutation(func);
  return (args: Omit<F["_args"], "sessionToken">) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutate({ ...args, sessionToken: token } as any);
}

export function useAuthAction<F extends AnyFunc>(func: F) {
  const token = useSessionToken();
  const act = useAction(func);
  return (args: Omit<F["_args"], "sessionToken">) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    act({ ...args, sessionToken: token } as any);
}
