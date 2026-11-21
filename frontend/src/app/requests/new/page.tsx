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

  return (
    <div className="space-y-5">
      <Link href="/requests" className="text-sm text-blue-700 underline">
        ← Back to requests
      </Link>
      <h1 className="text-2xl font-semibold">New service request</h1>

      <form onSubmit={onSubmit} noValidate className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
        {formError && <Alert>{formError}</Alert>}

        <div>
          <label htmlFor="title" className="mb-1 block text-sm font-medium">
            Title <span className="text-gray-500">(3–100 characters)</span>
          </label>
          <input
            id="title"
            className="input"
            maxLength={100}
            value={fields.title}
            onChange={(e) => set("title", e.target.value)}
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? "title-error" : undefined}
          />
          {errors.title && <p id="title-error" className="mt-1 text-sm text-red-700">{errors.title}</p>}
        </div>

        <div>
          <label htmlFor="description" className="mb-1 block text-sm font-medium">
            Description <span className="text-gray-500">(10–500 characters)</span>
          </label>
          <textarea
            id="description"
            rows={5}
            className="input"
            maxLength={500}
            value={fields.description}
            onChange={(e) => set("description", e.target.value)}
            aria-invalid={!!errors.description}
            aria-describedby={`description-count${errors.description ? " description-error" : ""}`}
          />
          <p id="description-count" className="mt-1 text-xs text-gray-500">
            {fields.description.trim().length}/500
          </p>
          {errors.description && <p id="description-error" className="mt-1 text-sm text-red-700">{errors.description}</p>}
        </div>

        <div>
          <label htmlFor="priority" className="mb-1 block text-sm font-medium">
            Priority
          </label>
          <select
            id="priority"
            className="input"
            value={fields.priority}
            onChange={(e) => set("priority", e.target.value as Priority)}
            aria-invalid={!!errors.priority}
            aria-describedby={errors.priority ? "priority-error" : undefined}
          >
            <option value="">Select priority…</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {priorityLabel(p)}
              </option>
            ))}
          </select>
          {errors.priority && <p id="priority-error" className="mt-1 text-sm text-red-700">{errors.priority}</p>}
        </div>

        <div className="flex gap-2">
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? "Creating…" : "Create request"}
          </button>
          <Link href="/requests" className="btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
