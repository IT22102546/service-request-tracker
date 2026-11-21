"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

export function Logo({ className = "", inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <span
        aria-hidden="true"
        className={`relative grid h-9 w-9 place-items-center overflow-hidden rounded-lg shadow-sm ${inverted ? "bg-white/10 ring-1 ring-white/20" : "bg-brand-700"}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px] text-white">
          <path d="M9 11l3 3 8-8" />
          <path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" />
        </svg>
        <span className="absolute right-0 bottom-0 h-2.5 w-2.5 rounded-tl-md bg-leaf-500" />
      </span>
      <span className="leading-tight">
        <span className={`block font-display text-[15px] font-bold tracking-tight ${inverted ? "text-white" : "text-brand-700"}`}>
          Service Desk
        </span>
        <span className={`block text-[11px] font-medium tracking-wide ${inverted ? "text-brand-200/80" : "text-ink"}`}>
          Service Request Tracker
        </span>
      </span>
    </span>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function Header() {
  const { state, logout } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onLogout() {
    setBusy(true);
    setError(null);
    try {
      await logout();
      router.replace("/login");
    } catch {
      setError("Sign out failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div aria-hidden="true" className="h-[3px] bg-gradient-to-r from-brand-700 via-brand-400 to-leaf-500" />
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <Link href="/requests" className="rounded-lg focus-visible:ring-4 focus-visible:ring-brand-400/30 focus-visible:outline-none">
          <Logo />
        </Link>
        {state.status === "authenticated" && (
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="grid h-8 w-8 place-items-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700 ring-1 ring-brand-200"
              >
                {initials(state.user.name)}
              </span>
              <span className="hidden leading-tight sm:block">
                <span className="block font-medium text-slate-900">{state.user.name}</span>
                <span className="block text-xs text-slate-500">{state.user.email}</span>
              </span>
            </div>
            <button type="button" onClick={onLogout} disabled={busy} className="btn-secondary px-3! py-1.5!">
              {busy ? "Signing out…" : "Sign out"}
            </button>
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="mx-auto max-w-5xl px-4 pb-2 text-sm text-red-600 sm:px-6">
          {error}
        </p>
      )}
    </header>
  );
}
