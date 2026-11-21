"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Spinner } from "./Alert";

/** Client-side guard: protected views redirect to /login when signed out. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { state } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (state.status === "guest") router.replace("/login");
  }, [state.status, router]);

  if (state.status !== "authenticated") return <Spinner label="Checking your session…" />;
  return <>{children}</>;
}
