export type Priority = "LOW" | "MEDIUM" | "HIGH";
export type Status = "OPEN" | "IN_PROGRESS" | "RESOLVED";

export const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH"];
export const STATUSES: Status[] = ["OPEN", "IN_PROGRESS", "RESOLVED"];

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface ServiceRequest {
  id: number;
  title: string;
  description: string;
  priority: Priority;
  status: Status;
  version: number;
  allowed_next_status: Status | null;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface StatusHistory {
  id: number;
  service_request_id: number;
  from_status: Status;
  to_status: Status;
  remark: string | null;
  actor: { id: number; name?: string };
  created_at: string;
}

export interface PaginationMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

/** Error envelope returned by the Laravel API. */
export interface ApiErrorBody {
  message: string;
  code?: string;
  errors?: Record<string, string[]>;
  current?: ServiceRequest;
  current_version?: number;
  current_status?: Status;
  allowed_next_status?: Status | null;
}
