import type { Priority, Status } from "./types";

export function statusLabel(status: Status) {
  return status === "IN_PROGRESS" ? "In progress" : status.charAt(0) + status.slice(1).toLowerCase();
}

export function priorityLabel(priority: Priority) {
  return priority.charAt(0) + priority.slice(1).toLowerCase();
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
