"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, Spinner } from "@/components/Alert";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

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

  if (state.status !== "guest") return <Spinner label="Checking your session…" />;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold">Sign in</h1>
        <p className="mb-6 text-sm text-gray-600">Service Request Tracker</p>

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {error && <Alert>{error}</Alert>}

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? "email-error" : undefined}
              className="input"
            />
            {fieldErrors.email && <p id="email-error" className="mt-1 text-sm text-red-700">{fieldErrors.email}</p>}
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!fieldErrors.password}
              aria-describedby={fieldErrors.password ? "password-error" : undefined}
              className="input"
            />
            {fieldErrors.password && <p id="password-error" className="mt-1 text-sm text-red-700">{fieldErrors.password}</p>}
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-xs text-gray-500">
          Demo accounts: alice@example.com / bob@example.com (password: <code>password</code>)
        </p>
      </div>
    </main>
  );
}
