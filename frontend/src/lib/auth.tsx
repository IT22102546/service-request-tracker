"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch, ensureCsrfCookie, jsonBody, UNAUTHENTICATED_EVENT } from "./api";
import type { User } from "./types";

type AuthState =
  | { status: "loading"; user: null }
  | { status: "authenticated"; user: User }
  | { status: "guest"; user: null; expired?: boolean };

interface AuthContextValue {
  state: AuthState;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading", user: null });

  // Restore the session on first load: the HttpOnly cookie is invisible to
  // JS, so /me is the source of truth for "am I signed in?".
  useEffect(() => {
    let cancelled = false;
    apiFetch<{ data: User }>("/api/auth/me")
      .then((res) => !cancelled && setState({ status: "authenticated", user: res.data }))
      .catch(() => !cancelled && setState({ status: "guest", user: null }));
    return () => {
      cancelled = true;
    };
  }, []);

  // Any 401 from the API signs the user out locally. If they were signed in a
  // moment ago, the server-side session expired (or was cleared), so remember
  // that to explain it on the login page. Later 401s from parallel requests keep the flag.
  useEffect(() => {
    const onUnauthenticated = () =>
      setState((prev) =>
        prev.status === "guest" ? prev : { status: "guest", user: null, expired: prev.status === "authenticated" },
      );
    window.addEventListener(UNAUTHENTICATED_EVENT, onUnauthenticated);
    return () => window.removeEventListener(UNAUTHENTICATED_EVENT, onUnauthenticated);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await ensureCsrfCookie(true);
    const res = await apiFetch<{ data: User }>("/api/auth/login", {
      method: "POST",
      body: jsonBody({ email, password }),
    });
    setState({ status: "authenticated", user: res.data });
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      // Already logged out server-side is fine; anything else is surfaced.
      if (!(e instanceof ApiError && e.status === 401)) throw e;
    } finally {
      setState({ status: "guest", user: null });
    }
  }, []);

  const value = useMemo(() => ({ state, login, logout }), [state, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
