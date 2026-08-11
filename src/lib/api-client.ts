export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    credentials: "same-origin",
  });
  const contentType = res.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    throw new ApiError(
      res.ok ? "Unexpected response from server" : `Request failed (${res.status})`,
      res.status
    );
  }

  const data = await res.json();

  if (!res.ok) {
    throw new ApiError(
      (data as { error?: string })?.error ?? `Request failed (${res.status})`,
      res.status
    );
  }

  return data as T;
}

export function connectEventSource(
  url: string,
  onMessage: () => void,
  onError?: (err: Event) => void
): EventSource {
  const es = new EventSource(url);

  es.onmessage = (event) => {
    if (event.data) onMessage();
  };

  es.onerror = (err) => {
    onError?.(err);
    es.close();
  };

  return es;
}
