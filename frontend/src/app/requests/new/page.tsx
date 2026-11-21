"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/Alert";
import { ApiError, apiFetch, jsonBody } from "@/lib/api";
import { priorityLabel } from "@/lib/format";
import { PRIORITIES, type Priority, type ServiceRequest } from "@/lib/types";

type Fields = { title: string; description: string; priority: Priority | "" };

/** Mirrors the server rules for instant feedback; the server stays authoritative. */
function validate(f: Fields): Record<string, string> {
  const errors: Record<string, string> = {};
  const title = f.title.trim();
  const description = f.description.trim();
  if (title.length < 3 || title.length > 100) errors.title = "Title must be between 3 and 100 characters.";
  if (description.length < 10 || description.length > 500)
    errors.description = "Description must be between 10 and 500 characters.";
  if (!f.priority) errors.priority = "Choose a priority.";
  return errors;
}

export default function NewRequestPage() {
  const router = useRouter();
  const [fields, setFields] = useState<Fields>({ title: "", description: "", priority: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const clientErrors = validate(fields);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;

    setSubmitting(true);
    try {
      const res = await apiFetch<{ data: ServiceRequest }>("/api/requests", {
        method: "POST",
        body: jsonBody({ title: fields.title.trim(), description: fields.description.trim(), priority: fields.priority }),
      });
      router.push(`/requests/${res.data.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setErrors(err.fieldErrors());
        setFormError("Please fix the highlighted fields.");
      } else if (!(err instanceof ApiError && err.status === 401)) {
        setFormError(err instanceof Error ? err.message : "Could not create the request.");
      }
      setSubmitting(false);
    }
  }

  const descLength = fields.description.trim().length;
  const titleLength = fields.title.trim().length;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/requests" className="link text-sm">
          ← Back to requests
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-brand-900">New service request</h1>
        <p className="mt-1 text-sm text-slate-500">Describe the problem. New requests start as Open.</p>
      </div>

      <form onSubmit={onSubmit} noValidate className="card space-y-6 p-6">
        {formError && <Alert>{formError}</Alert>}

        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="title" className="label">
              Title <span className="hint">(3–100 characters)</span>
            </label>
            <span className="text-xs text-slate-400 tabular-nums">{titleLength}/100</span>
          </div>
          <input
            id="title"
            className="input"
            maxLength={100}
            placeholder="e.g. Printer not working"
            value={fields.title}
            onChange={(e) => set("title", e.target.value)}
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? "title-error" : undefined}
          />
          {errors.title && (
            <p id="title-error" className="field-error">
              {errors.title}
            </p>
          )}
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="description" className="label">
              Description <span className="hint">(10–500 characters)</span>
            </label>
            <span id="description-count" className="text-xs text-slate-400 tabular-nums">
              {descLength}/500
            </span>
          </div>
          <textarea
            id="description"
            rows={5}
            className="input resize-y"
            maxLength={500}
            placeholder="What happened, where, and since when?"
            value={fields.description}
            onChange={(e) => set("description", e.target.value)}
            aria-invalid={!!errors.description}
            aria-describedby={`description-count${errors.description ? " description-error" : ""}`}
          />
          {errors.description && (
            <p id="description-error" className="field-error">
              {errors.description}
            </p>
          )}
        </div>

        <fieldset aria-describedby={errors.priority ? "priority-error" : undefined}>
          <legend className="label">Priority</legend>
          <div className="grid grid-cols-3 gap-2">
            {PRIORITIES.map((p) => {
              const selected = fields.priority === p;
              return (
                <label
                  key={p}
                  className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium shadow-sm transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand-400/25 ${
                    selected
                      ? "border-brand-700 bg-brand-700 text-white shadow-brand-900/20"
                      : errors.priority
                        ? "border-red-300 bg-white text-slate-700 hover:bg-slate-50"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="priority"
                    value={p}
                    checked={selected}
                    onChange={() => set("priority", p)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 rounded-full ${p === "HIGH" ? "bg-red-500" : p === "MEDIUM" ? "bg-amber-500" : "bg-slate-400"}`}
                  />
                  {priorityLabel(p)}
                </label>
              );
            })}
          </div>
          {errors.priority && (
            <p id="priority-error" className="field-error">
              {errors.priority}
            </p>
          )}
        </fieldset>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
          <Link href="/requests" className="btn-secondary">
            Cancel
          </Link>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting && (
              <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            )}
            {submitting ? "Creating…" : "Create request"}
          </button>
        </div>
      </form>
    </div>
  );
}
