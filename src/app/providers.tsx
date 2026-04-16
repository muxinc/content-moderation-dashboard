"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { Component, ReactNode } from "react";
import { SessionProvider } from "@/lib/session";

const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL as string
);

class AuthErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    if (
      error.message?.includes("Invalid session") ||
      error.message?.includes("Session expired")
    ) {
      return { hasError: true };
    }
    throw error;
  }

  componentDidCatch() {
    // Clear the cookie and redirect to login
    document.cookie = "admin_session=; path=/; max-age=0";
    window.location.href = "/login";
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ConvexProvider client={convex}>
      <SessionProvider>
        <AuthErrorBoundary>{children}</AuthErrorBoundary>
      </SessionProvider>
    </ConvexProvider>
  );
}
