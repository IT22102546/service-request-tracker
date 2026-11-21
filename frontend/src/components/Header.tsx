"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

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
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/requests" className="font-semibold text-gray-900">
          Service Request Tracker
        </Link>
        {state.status === "authenticated" && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-600">
              Signed in as <strong className="text-gray-900">{state.user.name}</strong>
            </span>
            <button
              type="button"
              onClick={onLogout}
              disabled={busy}
              className="rounded border border-gray-300 px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
            >
              {busy ? "Signing out…" : "Sign out"}
            </button>
          </div>
        )}
      </div>
      {error && <p role="alert" className="mx-auto max-w-4xl px-4 pb-2 text-sm text-red-700">{error}</p>}
    </header>
  );
}
