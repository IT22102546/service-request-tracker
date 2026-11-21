"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Spinner } from "./Alert";

/**
 * Client-side guard: protected views redirect to /login when signed out.
 * If the session expired mid-use, the login page is told so and gets the
 * current page (including any search/filters) to return to afterwards.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { state } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (state.status !== "guest") return;
    if (state.expired) {
      const next = window.location.pathname + window.location.search;
      router.replace(`/login?expired=1&next=${encodeURIComponent(next)}`);
    } else {
      router.replace("/login");
    }
  }, [state, router]);

  if (state.status !== "authenticated") return <Spinner label="Checking your session…" />;
  return <>{children}</>;
}
