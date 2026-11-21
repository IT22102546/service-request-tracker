import { priorityLabel, statusLabel } from "@/lib/format";
import type { Priority, Status } from "@/lib/types";

const statusStyles: Record<Status, { pill: string; dot: string }> = {
  OPEN: { pill: "bg-brand-50 text-brand-700 ring-brand-400/30", dot: "bg-brand-400" },
  IN_PROGRESS: { pill: "bg-amber-50 text-amber-800 ring-amber-500/30", dot: "bg-amber-500" },
  RESOLVED: { pill: "bg-leaf-50 text-leaf-800 ring-leaf-500/40", dot: "bg-leaf-500" },
};

// Priority stays neutral so status colour carries the meaning; only the bars are coloured.
const priorityStyles: Record<Priority, { text: string; bars: string }> = {
  LOW: { text: "text-slate-600", bars: "text-slate-400" },
  MEDIUM: { text: "text-slate-700", bars: "text-amber-500" },
  HIGH: { text: "text-red-700", bars: "text-red-500" },
};

const priorityBars: Record<Priority, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };

export function StatusBadge({ status }: { status: Status }) {
  const s = statusStyles[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${s.pill}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {statusLabel(status)}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const bars = priorityBars[priority];
  const st = priorityStyles[priority];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-0.5 text-xs font-medium ring-1 ring-slate-200 ring-inset ${st.text}`}
    >
      <span aria-hidden="true" className={`flex items-end gap-px ${st.bars}`}>
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={`w-[3px] rounded-[1px] bg-current ${i <= bars ? "" : "opacity-20"}`}
            style={{ height: `${3 + i * 2}px` }}
          />
        ))}
      </span>
      {priorityLabel(priority)}
    </span>
  );
}
