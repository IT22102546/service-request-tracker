"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Alert, Spinner } from "@/components/Alert";
import { PriorityBadge, StatusBadge } from "@/components/Badges";
import { ApiError, apiFetch } from "@/lib/api";
import { formatDate, priorityLabel, statusLabel } from "@/lib/format";
import { PRIORITIES, STATUSES, type Paginated, type ServiceRequest, type Status } from "@/lib/types";

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

  // Per-status totals for the summary tiles (one tiny request per status).
  const [counts, setCounts] = useState<Record<Status, number> | null>(null);
  useEffect(() => {
    let cancelled = false;
    Promise.all(STATUSES.map((st) => apiFetch<Paginated<ServiceRequest>>(`/api/requests?status=${st}&per_page=1`)))
      .then((res) => {
        if (cancelled) return;
        setCounts(Object.fromEntries(STATUSES.map((st, i) => [st, res[i].meta.total])) as Record<Status, number>);
      })
      .catch(() => {
        /* tiles are optional; the list shows its own errors */
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

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
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-brand-900">My service requests</h1>
          <p className="mt-1 text-sm text-slate-500">
            {meta
              ? hasFilters
                ? `${meta.total} ${meta.total === 1 ? "request matches" : "requests match"} your filters`
                : `${meta.total} ${meta.total === 1 ? "request" : "requests"} in total`
              : "Track and update the requests you have raised."}
          </p>
        </div>
        <Link href="/requests/new" className="btn-primary">
          <PlusIcon />
          New request
        </Link>
      </div>

      <StatusTiles counts={counts} active={status} onSelect={(st) => updateQuery({ status: st === status ? "" : st })} />

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
          <button type="button" className="font-medium underline" onClick={() => setReloadKey((k) => k + 1)}>
            Retry
          </button>
        </Alert>
      )}

      {loading && !result ? (
        <Spinner label="Loading requests…" />
      ) : result && result.data.length === 0 ? (
        <div className="card flex flex-col items-center px-6 py-14 text-center">
          <span aria-hidden="true" className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
              <path d="M9 12h6m-6 4h6M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
            </svg>
          </span>
          {hasFilters ? (
            <>
              <h2 className="mt-4 text-lg font-bold text-brand-900">No matching requests</h2>
              <p className="mt-1 text-sm text-slate-500">Try a different search term or clear the filters.</p>
              <button type="button" className="btn-secondary mt-5" onClick={() => router.push(pathname)}>
                Clear filters
              </button>
            </>
          ) : (
            <>
              <h2 className="mt-4 text-lg font-bold text-brand-900">No service requests yet</h2>
              <p className="mt-1 text-sm text-slate-500">When you raise a request, it will show up here.</p>
              <Link href="/requests/new" className="btn-primary mt-5">
                <PlusIcon />
                Create your first request
              </Link>
            </>
          )}
        </div>
      ) : result ? (
        <div aria-busy={loading} className={`transition-opacity ${loading ? "opacity-60" : ""}`}>
          <ul className="card divide-y divide-slate-100 overflow-hidden">
            {result.data.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/requests/${r.id}`}
                  className="group flex items-center gap-4 px-5 py-4 transition hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="truncate font-medium text-slate-900 group-hover:text-brand-700">{r.title}</span>
                    </div>
                    <p className="mt-1 line-clamp-1 text-sm text-slate-500">{r.description}</p>
                    <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-slate-400">
                      <span className="font-mono">#{r.id}</span>
                      <span aria-hidden="true">·</span>
                      <span>Created {formatDate(r.created_at)}</span>
                      <span aria-hidden="true">·</span>
                      <span>v{r.version}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
                    <PriorityBadge priority={r.priority} />
                    <StatusBadge status={r.status} />
                  </div>
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="hidden h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500 sm:block">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>

          {meta && (
            <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="text-slate-500">
                Showing <span className="font-medium text-slate-700">{meta.from}–{meta.to}</span> of{" "}
                <span className="font-medium text-slate-700">{meta.total}</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn-secondary px-3!"
                  disabled={meta.current_page <= 1 || loading}
                  onClick={() => updateQuery({ page: String(meta.current_page - 1) })}
                >
                  ← Previous
                </button>
                <span aria-current="page" className="px-2 text-slate-600">
                  Page {meta.current_page} of {meta.last_page}
                </span>
                <button
                  type="button"
                  className="btn-secondary px-3!"
                  disabled={meta.current_page >= meta.last_page || loading}
                  onClick={() => updateQuery({ page: String(meta.current_page + 1) })}
                >
                  Next →
                </button>
              </div>
            </nav>
          )}
        </div>
      ) : null}
    </div>
  );
}

const TILE_STYLES: Record<Status, { bar: string; ring: string }> = {
  OPEN: { bar: "bg-brand-400", ring: "ring-brand-400" },
  IN_PROGRESS: { bar: "bg-amber-500", ring: "ring-amber-500" },
  RESOLVED: { bar: "bg-leaf-500", ring: "ring-leaf-500" },
};

function StatusTiles({
  counts,
  active,
  onSelect,
}: {
  counts: Record<Status, number> | null;
  active: string;
  onSelect: (status: Status) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {STATUSES.map((st) => {
        const selected = active === st;
        return (
          <button
            key={st}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(st)}
            className={`card group relative min-w-0 overflow-hidden p-3 text-left sm:p-4 transition hover:-translate-y-px hover:shadow-md focus-visible:ring-4 focus-visible:ring-brand-400/30 focus-visible:outline-none ${
              selected ? `ring-2 ${TILE_STYLES[st].ring}` : ""
            }`}
          >
            <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 ${TILE_STYLES[st].bar}`} />
            <span className="eyebrow block truncate">{statusLabel(st)}</span>
            <span className="mt-1.5 block font-display text-2xl font-bold text-brand-900 tabular-nums sm:text-3xl">
              {counts ? counts[st] : <span className="inline-block h-7 w-8 animate-pulse rounded bg-slate-100 align-middle" />}
            </span>
            <span className="mt-0.5 hidden text-xs text-slate-400 sm:block">{selected ? "Showing only these · click to clear" : "Click to filter"}</span>
          </button>
        );
      })}
    </div>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className="h-4 w-4">
      <path d="M12 5v14M5 12h14" />
    </svg>
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
      className="card grid gap-3 p-4 sm:grid-cols-[1fr_10rem_10rem_auto] sm:items-end"
    >
      <div>
        <label htmlFor="search" className="label">
          Search by title
        </label>
        <div className="relative">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
          id="search"
          type="search"
          maxLength={100}
          value={searchInput}
          onChange={(e) => {
            const value = e.target.value;
            setSearchInput(value);
            // Emptying the box (typing it away or the browser's ✕ button) clears the
            // applied search straight away, so the full list comes back without pressing Clear.
            if (value === "" && initialSearch !== "") onSearch("");
          }}
          placeholder="e.g. printer"
          className="input pl-9!"
        />
        </div>
      </div>
      <div>
        <label htmlFor="status" className="label">
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
        <label htmlFor="priority" className="label">
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
