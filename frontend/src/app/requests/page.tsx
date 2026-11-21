"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Alert, Spinner } from "@/components/Alert";
import { PriorityBadge, StatusBadge } from "@/components/Badges";
import { ApiError, apiFetch } from "@/lib/api";
import { formatDate, priorityLabel, statusLabel } from "@/lib/format";
import { PRIORITIES, STATUSES, type Paginated, type ServiceRequest } from "@/lib/types";

const PER_PAGE = 10;

export default function RequestsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <RequestList />
    </Suspense>
  );
}

function RequestList() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // The URL is the single source of truth for filters, so they survive
  // refreshes and back/forward navigation.
  const search = params.get("search") ?? "";
  const status = params.get("status") ?? "";
  const priority = params.get("priority") ?? "";
  const page = Math.max(1, Number(params.get("page")) || 1);

  const [reloadKey, setReloadKey] = useState(0);

  const query = new URLSearchParams({ page: String(page), per_page: String(PER_PAGE) });
  if (search) query.set("search", search);
  if (status) query.set("status", status);
  if (priority) query.set("priority", priority);
  const requestKey = `${query}#${reloadKey}`;

  // Each response is stored with the key it was fetched for; while the
  // latest key has no response yet, the list is "loading".
  const [response, setResponse] = useState<{
    key: string;
    result?: Paginated<ServiceRequest>;
    error?: string;
  } | null>(null);
  const [lastResult, setLastResult] = useState<Paginated<ServiceRequest> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const qs = requestKey.split("#")[0];
    apiFetch<Paginated<ServiceRequest>>(`/api/requests?${qs}`)
      .then((res) => {
        if (cancelled) return;
        setResponse({ key: requestKey, result: res });
        setLastResult(res);
      })
      .catch((err) => {
        if (cancelled || (err instanceof ApiError && err.status === 401)) return;
        setResponse({ key: requestKey, error: err instanceof Error ? err.message : "Could not load requests." });
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  const loading = response?.key !== requestKey;
  const error = !loading ? (response?.error ?? null) : null;
  const result = loading ? lastResult : (response?.result ?? null);

  function updateQuery(changes: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    // Changing a filter always goes back to page 1.
    if (!("page" in changes)) next.delete("page");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const hasFilters = !!(search || status || priority);
  const meta = result?.meta;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">My service requests</h1>
        <Link href="/requests/new" className="btn-primary">
          New request
        </Link>
      </div>

      <FilterForm
        key={search}
        initialSearch={search}
        status={status}
        priority={priority}
        hasFilters={hasFilters}
        onSearch={(value) => updateQuery({ search: value })}
        onChange={updateQuery}
        onClear={() => router.push(pathname)}
      />

      {error && (
        <Alert>
          {error}{" "}
          <button type="button" className="underline" onClick={() => setReloadKey((k) => k + 1)}>
            Retry
          </button>
        </Alert>
      )}

      {loading && !result ? (
        <Spinner label="Loading requests…" />
      ) : result && result.data.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600">
          {hasFilters ? (
            <>No requests match these filters.</>
          ) : (
            <>
              You have no service requests yet.{" "}
              <Link href="/requests/new" className="text-blue-700 underline">
                Create your first request
              </Link>
              .
            </>
          )}
        </div>
      ) : result ? (
        <div aria-busy={loading} className={loading ? "opacity-60" : undefined}>
          <ul className="divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200 bg-white">
            {result.data.map((r) => (
              <li key={r.id}>
                <Link href={`/requests/${r.id}`} className="block px-4 py-3 hover:bg-gray-50">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-gray-900">{r.title}</span>
                    <span className="flex gap-2">
                      <PriorityBadge priority={r.priority} />
                      <StatusBadge status={r.status} />
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    #{r.id} · created {formatDate(r.created_at)} · v{r.version}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          {meta && (
            <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="text-gray-600">
                Showing {meta.from}–{meta.to} of {meta.total}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={meta.current_page <= 1 || loading}
                  onClick={() => updateQuery({ page: String(meta.current_page - 1) })}
                >
                  Previous
                </button>
                <span aria-current="page">
                  Page {meta.current_page} of {meta.last_page}
                </span>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={meta.current_page >= meta.last_page || loading}
                  onClick={() => updateQuery({ page: String(meta.current_page + 1) })}
                >
                  Next
                </button>
              </div>
            </nav>
          )}
        </div>
      ) : null}
    </div>
  );
}

function FilterForm({
  initialSearch,
  status,
  priority,
  hasFilters,
  onSearch,
  onChange,
  onClear,
}: {
  initialSearch: string;
  status: string;
  priority: string;
  hasFilters: boolean;
  onSearch: (value: string) => void;
  onChange: (changes: Record<string, string>) => void;
  onClear: () => void;
}) {
  const [searchInput, setSearchInput] = useState(initialSearch);

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(searchInput.trim());
      }}
      className="grid gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end"
    >
      <div>
        <label htmlFor="search" className="mb-1 block text-sm font-medium">
          Search by title
        </label>
        <input
          id="search"
          type="search"
          maxLength={100}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="e.g. printer"
          className="input"
        />
      </div>
      <div>
        <label htmlFor="status" className="mb-1 block text-sm font-medium">
          Status
        </label>
        <select id="status" value={status} onChange={(e) => onChange({ status: e.target.value })} className="input">
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="priority" className="mb-1 block text-sm font-medium">
          Priority
        </label>
        <select id="priority" value={priority} onChange={(e) => onChange({ priority: e.target.value })} className="input">
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {priorityLabel(p)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary">
          Search
        </button>
        {hasFilters && (
          <button type="button" className="btn-secondary" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
    </form>
  );
}
