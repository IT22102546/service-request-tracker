"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, Spinner } from "@/components/Alert";
import { Logo } from "@/components/Header";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const DEMO_ACCOUNTS = [
  { name: "Alice", email: "alice@example.com" },
  { name: "Bob", email: "bob@example.com" },
];

export default function LoginPage() {
  const { state, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Already signed in → go straight to the app.
  useEffect(() => {
    if (state.status === "authenticated") router.replace("/requests");
  }, [state.status, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      await login(email, password);
      router.replace("/requests");
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const fields = err.fieldErrors();
        // Wrong credentials come back on "email"; show them as a form-level message.
        if (fields.email && !fields.password && email && password) setError(fields.email);
        else setFieldErrors(fields);
      } else if (err instanceof ApiError && err.status === 429) {
        setError("Too many sign-in attempts. Please wait a minute and try again.");
      } else {
        setError(err instanceof Error ? err.message : "Sign in failed.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function fillDemo(demoEmail: string) {
    setEmail(demoEmail);
    setPassword("password");
    setError(null);
    setFieldErrors({});
  }

  if (state.status !== "guest") return <Spinner label="Checking your session…" />;

  return (
    <main className="grid flex-1 lg:grid-cols-2">
      {/* Brand panel (desktop only) */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-brand-900 to-brand-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-brand-400/30 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-leaf-500/15 blur-3xl"
        />
        <Logo inverted className="relative" />
        <div className="relative max-w-md space-y-6">
          <p className="eyebrow text-leaf-300!">Internal service management</p>
          <h2 className="text-3xl leading-tight font-bold tracking-tight xl:text-4xl">
            Raise, track and resolve internal service requests.
          </h2>
          <ul className="space-y-3 text-sm text-brand-100/90">
            {[
              "A clear workflow: Open → In progress → Resolved",
              "Every status change is recorded with who and when",
              "Conflicting edits are detected, never silently overwritten",
            ].map((item) => (
              <li key={item} className="flex gap-3">
                <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-leaf-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-brand-200/60">Internal use only</p>
      </aside>

      {/* Form */}
      <div className="flex items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-sm">
          <Logo className="mb-10 lg:hidden" />
          <h1 className="text-2xl font-bold tracking-tight text-brand-900">Welcome back</h1>
          <p className="mt-1 mb-8 text-sm text-slate-500">Sign in to manage your service requests.</p>

          <form onSubmit={onSubmit} noValidate className="space-y-5">
            {error && <Alert>{error}</Alert>}

            <div>
              <label htmlFor="email" className="label">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? "email-error" : undefined}
                className="input"
              />
              {fieldErrors.email && (
                <p id="email-error" className="field-error">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!fieldErrors.password}
                aria-describedby={fieldErrors.password ? "password-error" : undefined}
                className="input"
              />
              {fieldErrors.password && (
                <p id="password-error" className="field-error">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <button type="submit" disabled={submitting} className="btn-primary w-full py-2.5!">
              {submitting && (
                <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              )}
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white/60 p-4">
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Demo accounts</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => fillDemo(a.email)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm shadow-sm transition hover:border-brand-300 hover:bg-brand-50/60"
                >
                  <span className="block font-medium text-slate-900">{a.name}</span>
                  <span className="block truncate text-xs text-slate-500">{a.email}</span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Password for both: <code className="rounded bg-slate-100 px-1 py-0.5 text-slate-700">password</code>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
