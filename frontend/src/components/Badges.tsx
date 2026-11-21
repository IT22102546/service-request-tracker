import { priorityLabel, statusLabel } from "@/lib/format";
import type { Priority, Status } from "@/lib/types";

const statusStyles: Record<Status, string> = {
  OPEN: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  RESOLVED: "bg-green-100 text-green-800",
};

const priorityStyles: Record<Priority, string> = {
  LOW: "bg-gray-100 text-gray-700",
  MEDIUM: "bg-indigo-100 text-indigo-800",
  HIGH: "bg-red-100 text-red-800",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${statusStyles[status]}`}>
      {statusLabel(status)}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${priorityStyles[priority]}`}>
      {priorityLabel(priority)}
    </span>
  );
}
