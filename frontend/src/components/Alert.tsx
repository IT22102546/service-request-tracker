export function Alert({
  kind = "error",
  children,
}: {
  kind?: "error" | "warning" | "info" | "success";
  children: React.ReactNode;
}) {
  const styles = {
    error: "border-red-300 bg-red-50 text-red-800",
    warning: "border-amber-300 bg-amber-50 text-amber-900",
    info: "border-blue-300 bg-blue-50 text-blue-800",
    success: "border-green-300 bg-green-50 text-green-800",
  }[kind];

  return (
    <div role={kind === "error" || kind === "warning" ? "alert" : "status"} className={`rounded border px-4 py-3 text-sm ${styles}`}>
      {children}
    </div>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <p role="status" aria-live="polite" className="py-8 text-center text-sm text-gray-500">
      {label}
    </p>
  );
}
