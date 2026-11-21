const styles = {
  error: { box: "border-red-200 bg-red-50 text-red-800", icon: "text-red-500" },
  warning: { box: "border-amber-200 bg-amber-50 text-amber-900", icon: "text-amber-500" },
  info: { box: "border-brand-200 bg-brand-50 text-brand-900", icon: "text-brand-500" },
  success: { box: "border-leaf-200 bg-leaf-50 text-leaf-800", icon: "text-leaf-600" },
};

const icons = {
  error: "M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z",
  warning: "M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z",
  info: "M12 16v-4m0-4h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  success: "m9 12 2 2 4-4m7 2a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
};

export function Alert({
  kind = "error",
  children,
}: {
  kind?: "error" | "warning" | "info" | "success";
  children: React.ReactNode;
}) {
  const s = styles[kind];
  return (
    <div
      role={kind === "error" || kind === "warning" ? "alert" : "status"}
      className={`flex gap-3 rounded-lg border px-4 py-3 text-sm ${s.box}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`mt-0.5 h-4 w-4 shrink-0 ${s.icon}`}
      >
        <path d={icons[kind]} />
      </svg>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-slate-500">
      <span aria-hidden="true" className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-brand-700" />
      {label}
    </div>
  );
}
