"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Alert, Spinner } from "@/components/Alert";
import { PriorityBadge, StatusBadge } from "@/components/Badges";
import { ApiError, apiFetch, jsonBody } from "@/lib/api";
import { formatDate, statusLabel } from "@/lib/format";
import type { ServiceRequest, Status, StatusHistory } from "@/lib/types";

type Notice = { kind: "error" | "warning" | "success"; message: string } | null;

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [history, setHistory] = useState<StatusHistory[]>([]);
  const [loadError, setLoadError] = useState<{ status: number; message: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const [remark, setRemark] = useState("");
  const [remarkError, setRemarkError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  // Fetches request + history; callers set the loading flag first when needed.
  const fetchAll = useCallback(async () => {
    try {
      const [req, hist] = await Promise.all([
        apiFetch<{ data: ServiceRequest }>(`/api/requests/${id}`),
        apiFetch<{ data: StatusHistory[] }>(`/api/requests/${id}/history`),
      ]);
      setRequest(req.data);
      setHistory(hist.data);
      setLoadError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return; // auth guard redirects
      setLoadError({
        status: err instanceof ApiError ? err.status : 0,
        message: err instanceof Error ? err.message : "Could not load the request.",
      });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // Initial load; promise callbacks (not the effect body) update state.
    Promise.resolve().then(fetchAll);
  }, [fetchAll]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    await fetchAll();
  }, [fetchAll]);

  async function changeStatus() {
    if (!request?.allowed_next_status) return;
    setSubmitting(true);
    setNotice(null);
    setRemarkError(null);
    const target = request.allowed_next_status;

    try {
      const res = await apiFetch<{ data: ServiceRequest }>(`/api/requests/${request.id}/status`, {
        method: "PATCH",
        // expected_version is the version this screen is showing: if someone
        // else changed the request since, the server rejects with 409.
        body: jsonBody({ status: target, expected_version: request.version, remark: remark.trim() || null }),
      });
      setRequest(res.data);
      setRemark("");
      setNotice({ kind: "success", message: `Status changed to ${statusLabel(res.data.status)}.` });
      const hist = await apiFetch<{ data: StatusHistory[] }>(`/api/requests/${request.id}/history`);
      setHistory(hist.data);
    } catch (err) {
      if (!(err instanceof ApiError)) {
        setNotice({ kind: "error", message: "Something went wrong. Please try again." });
      } else if (err.status === 409 && err.code === "STALE_VERSION") {
        // Show the latest state the server sent back and let the user decide again.
        if (err.body.current) setRequest(err.body.current);
        await load();
        setNotice({
          kind: "warning",
          message:
            "This request was updated elsewhere while you were viewing it. The latest version is now shown — review it and try again if still needed.",
        });
      } else if (err.status === 409) {
        await load();
        setNotice({ kind: "warning", message: err.message });
      } else if (err.status === 422) {
        const fields = err.fieldErrors();
        setRemarkError(fields.remark ?? null);
        setNotice({ kind: "error", message: fields.status ?? fields.expected_version ?? err.message });
      } else if (err.status === 404 || err.status === 403) {
        setLoadError({ status: err.status, message: err.message });
      } else if (err.status !== 401) {
        setNotice({ kind: "error", message: err.message });
      }
    } finally {
      setSubmitting(false);
    }
  }

  const back = (
    <Link href="/requests" className="link text-sm">
      ← Back to requests
    </Link>
  );

  if (loading && !request && !loadError) return <Spinner label="Loading request…" />;

  if (loadError) {
    const notFound = loadError.status === 404 || loadError.status === 403;
    return (
      <div className="space-y-6">
        {back}
        {notFound ? (
          <div className="card flex flex-col items-center px-6 py-14 text-center" role="alert">
            <span aria-hidden="true" className="grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-500">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-6 w-6">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
            </span>
            <h1 className="mt-4 text-lg font-bold text-brand-900">Request not available</h1>
            <p className="mt-1 text-sm text-slate-500">This request does not exist or you do not have access to it.</p>
            <Link href="/requests" className="btn-secondary mt-5">
              Go to my requests
            </Link>
          </div>
        ) : (
          <Alert>
            {loadError.message}{" "}
            <button type="button" className="font-medium underline" onClick={load}>
              Retry
            </button>
          </Alert>
        )}
      </div>
    );
  }

  if (!request) return null;
  const next = request.allowed_next_status;

  return (
    <div className="space-y-6">
      {back}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="card min-w-0 p-6 lg:col-start-1" aria-busy={loading}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-slate-400">#{request.id}</span>
              <PriorityBadge priority={request.priority} />
              <StatusBadge status={request.status} />
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight break-words text-brand-900">{request.title}</h1>
            <p className="mt-3 leading-relaxed whitespace-pre-wrap break-words text-slate-700">{request.description}</p>

            <WorkflowSteps status={request.status} />

            <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-5 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs font-medium tracking-wide text-slate-400 uppercase">Version</dt>
                <dd data-testid="version" className="mt-1 font-mono text-slate-900">
                  {request.version}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-slate-400 uppercase">Created</dt>
                <dd className="mt-1 text-slate-900">{formatDate(request.created_at)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-slate-400 uppercase">Last updated</dt>
                <dd className="mt-1 text-slate-900">{formatDate(request.updated_at)}</dd>
              </div>
            </dl>
          </section>

          <aside className="lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
            <section className="card p-6" aria-labelledby="status-heading">
              <h2 id="status-heading" className="font-bold text-brand-900">
                Update status
              </h2>
              <div aria-live="polite" className={notice ? "mt-4" : undefined}>
                {notice && <Alert kind={notice.kind}>{notice.message}</Alert>}
              </div>

              {next ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    changeStatus();
                  }}
                  className="mt-4 space-y-4"
                >
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <StatusBadge status={request.status} />
                    <span aria-hidden="true">→</span>
                    <StatusBadge status={next} />
                  </div>
                  <div>
                    <label htmlFor="remark" className="label">
                      Remark <span className="hint">(optional)</span>
                    </label>
                    <textarea
                      id="remark"
                      rows={3}
                      className="input resize-y"
                      maxLength={255}
                      placeholder="e.g. Technician assigned"
                      value={remark}
                      onChange={(e) => setRemark(e.target.value)}
                      aria-invalid={!!remarkError}
                      aria-describedby={`remark-count${remarkError ? " remark-error" : ""}`}
                    />
                    <p id="remark-count" className="mt-1 text-right text-xs text-slate-400 tabular-nums">
                      {remark.length}/255
                    </p>
                    {remarkError && (
                      <p id="remark-error" className="field-error">
                        {remarkError}
                      </p>
                    )}
                  </div>
                  <button type="submit" disabled={submitting || loading} className="btn-primary w-full">
                    {submitting && (
                      <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    )}
                    {submitting ? "Saving…" : `Move to ${statusLabel(next)}`}
                  </button>
                  <p className="text-xs text-slate-400">
                    You are editing version {request.version}. If someone else changes it first, you will be asked to review the latest version.
                  </p>
                </form>
              ) : (
                <div className="mt-4 flex gap-3 rounded-lg bg-leaf-50 px-4 py-3 text-sm text-leaf-800 ring-1 ring-leaf-200">
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 h-4 w-4 shrink-0 text-leaf-600">
                    <path d="m9 12 2 2 4-4m7 2a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" />
                  </svg>
                  This request is resolved. No further status changes are allowed.
                </div>
              )}
            </section>
          </aside>

          <section className="card min-w-0 p-6 lg:col-start-1" aria-labelledby="history-heading">
            <h2 id="history-heading" className="font-bold text-brand-900">
              Status history
            </h2>
            {history.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No status changes yet. The request was created as Open.</p>
            ) : (
              <ol className="mt-5">
                {history.map((h, i) => (
                  <li key={h.id} className="relative flex gap-4 pb-6 last:pb-0">
                    {i < history.length - 1 && (
                      <span aria-hidden="true" className="absolute top-6 bottom-0 left-[11px] w-px bg-slate-200" />
                    )}
                    <span
                      aria-hidden="true"
                      className="relative grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-50 ring-1 ring-brand-200"
                    >
                      <span className="h-2 w-2 rounded-full bg-brand-600" />
                    </span>
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={h.from_status} />
                        <span aria-label="to" className="text-slate-400">
                          →
                        </span>
                        <StatusBadge status={h.to_status} />
                      </div>
                      <p className="mt-1.5 text-slate-500">
                        <span className="font-medium text-slate-700">{h.actor.name ?? `User #${h.actor.id}`}</span> ·{" "}
                        {formatDate(h.created_at)}
                      </p>
                      {h.remark && (
                        <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 break-words text-slate-700">{h.remark}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
      </div>
    </div>
  );
}

const WORKFLOW: Status[] = ["OPEN", "IN_PROGRESS", "RESOLVED"];

function WorkflowSteps({ status }: { status: Status }) {
  const current = WORKFLOW.indexOf(status);
  return (
    <ol aria-label="Workflow progress" className="mt-6 flex items-center">
      {WORKFLOW.map((step, i) => {
        const done = i < current || status === "RESOLVED";
        const active = i === current;
        return (
          <li key={step} className={`flex items-center ${i < WORKFLOW.length - 1 ? "flex-1" : ""}`}>
            <span className="flex items-center gap-2" aria-current={active ? "step" : undefined}>
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                  done
                    ? "bg-leaf-500 text-white"
                    : active
                      ? "bg-white text-brand-700 ring-2 ring-brand-700"
                      : "bg-white text-slate-400 ring-1 ring-slate-300"
                }`}
              >
                {done ? (
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                    <path d="m5 12 5 5L20 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              <span className={`text-xs font-medium whitespace-nowrap sm:text-sm ${active || done ? "text-slate-900" : "text-slate-400"}`}>
                {statusLabel(step)}
              </span>
            </span>
            {i < WORKFLOW.length - 1 && (
              <span aria-hidden="true" className={`mx-2 h-0.5 min-w-4 flex-1 rounded-full sm:mx-3 ${i < current ? "bg-leaf-500" : "bg-slate-200"}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
