"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";

const SessionContext = createContext<string | null>(null);

export function useSessionToken(): string {
  const token = useContext(SessionContext);
  if (!token) throw new Error("No session token — are you logged in?");
  return token;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    fetch("/api/session")
      .then((res) => (res.ok ? res.json() : { token: null }))
      .then((data) => {
        setToken(data.token);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!loading && !token && pathname !== "/login") {
      router.replace("/login");
    }
  }, [loading, token, pathname, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-zinc-400">Loading...</p>
      </div>
    );
  }

  // On the login page, render without a token
  if (pathname === "/login") {
    return (
      <SessionContext.Provider value={token}>{children}</SessionContext.Provider>
    );
  }

  // No token and not on login — redirect is in progress
  if (!token) {
    return null;
  }

  return (
    <SessionContext.Provider value={token}>{children}</SessionContext.Provider>
  );
}
