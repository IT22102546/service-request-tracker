"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Alert, Spinner } from "@/components/Alert";
import { PriorityBadge, StatusBadge } from "@/components/Badges";
import { ApiError, apiFetch, jsonBody } from "@/lib/api";
import { formatDate, statusLabel } from "@/lib/format";
import type { ServiceRequest, StatusHistory } from "@/lib/types";

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
    <Link href="/requests" className="text-sm text-blue-700 underline">
      ← Back to requests
    </Link>
  );

  if (loading && !request && !loadError) return <Spinner label="Loading request…" />;

  if (loadError) {
    return (
      <div className="space-y-4">
        {back}
        {loadError.status === 404 || loadError.status === 403 ? (
          <Alert>This request does not exist or you do not have access to it.</Alert>
        ) : (
          <Alert>
            {loadError.message}{" "}
            <button type="button" className="underline" onClick={load}>
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

      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-5" aria-busy={loading}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold break-words">{request.title}</h1>
          <div className="flex gap-2">
            <PriorityBadge priority={request.priority} />
            <StatusBadge status={request.status} />
          </div>
        </div>
        <p className="whitespace-pre-wrap text-gray-800">{request.description}</p>
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-gray-500">Request</dt>
            <dd>#{request.id}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Version</dt>
            <dd data-testid="version">{request.version}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Created</dt>
            <dd>{formatDate(request.created_at)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Updated</dt>
            <dd>{formatDate(request.updated_at)}</dd>
          </div>
        </dl>
      </section>

      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-5" aria-labelledby="status-heading">
        <h2 id="status-heading" className="text-lg font-semibold">
          Update status
        </h2>
        <div aria-live="polite">{notice && <Alert kind={notice.kind}>{notice.message}</Alert>}</div>

        {next ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              changeStatus();
            }}
            className="space-y-3"
          >
            <div>
              <label htmlFor="remark" className="mb-1 block text-sm font-medium">
                Remark <span className="text-gray-500">(optional, max 255 characters)</span>
              </label>
              <input
                id="remark"
                className="input"
                maxLength={255}
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                aria-invalid={!!remarkError}
                aria-describedby={remarkError ? "remark-error" : undefined}
              />
              {remarkError && <p id="remark-error" className="mt-1 text-sm text-red-700">{remarkError}</p>}
            </div>
            <button type="submit" disabled={submitting || loading} className="btn-primary">
              {submitting ? "Saving…" : `Move to ${statusLabel(next)}`}
            </button>
          </form>
        ) : (
          <p className="text-sm text-gray-600">This request is resolved. No further status changes are allowed.</p>
        )}
      </section>

      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-5" aria-labelledby="history-heading">
        <h2 id="history-heading" className="text-lg font-semibold">
          Status history
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-gray-600">No status changes yet.</p>
        ) : (
          <ol className="space-y-3">
            {history.map((h) => (
              <li key={h.id} className="border-l-2 border-blue-300 pl-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={h.from_status} />
                  <span aria-label="to">→</span>
                  <StatusBadge status={h.to_status} />
                </div>
                <p className="mt-1 text-gray-600">
                  {h.actor.name ?? `User #${h.actor.id}`} · {formatDate(h.created_at)}
                </p>
                {h.remark && <p className="mt-1 text-gray-800">“{h.remark}”</p>}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
