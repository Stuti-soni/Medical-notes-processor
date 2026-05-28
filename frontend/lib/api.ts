const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)access_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

export const api = {
  register: (name: string, email: string, password: string) =>
    apiFetch<{ access_token: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),

  login: (email: string, password: string) =>
    apiFetch<{ access_token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  uploadFile: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiFetch<{ upload_id: string; status: string }>("/upload", {
      method: "POST",
      body: form,
    });
  },

  listUploads: () =>
    apiFetch<Array<{ upload_id: string; file_name: string; status: string; created_at: string }>>("/uploads"),

  getStatus: (id: string) =>
    apiFetch<{ upload_id: string; status: string; retry_count: number; updated_at: string }>(`/status/${id}`),

  getResults: (id: string) =>
    apiFetch<{ upload_id: string; tasks: Array<{ task_type: string; task_name: string; confidence_score: number }> }>(`/results/${id}`),

  getTimeline: (id: string) =>
    apiFetch<{ upload_id: string; events: Array<{ event_type: string; message: string; created_at: string }> }>(`/timeline/${id}`),
};
