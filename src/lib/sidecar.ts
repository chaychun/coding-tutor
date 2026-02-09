// Sidecar connection state — populated on app startup via Tauri invoke()
let sidecarPort: number | null = null;
let authToken: string | null = null;

/**
 * Initialize sidecar connection info from Tauri.
 * Called once on app startup.
 */
export async function initSidecar(): Promise<void> {
  // In development (Vite dev server without Tauri), use defaults
  if (!window.__TAURI_INTERNALS__) {
    sidecarPort = 3001;
    authToken = process.env.AUTH_TOKEN || "";
    return;
  }

  const { invoke } = await import("@tauri-apps/api/core");
  const info = await invoke<{ port: number; auth_token: string }>("get_sidecar_info");
  sidecarPort = info.port;
  authToken = info.auth_token;
}

/**
 * Get the base URL for sidecar API requests.
 */
export function getSidecarBaseUrl(): string {
  if (sidecarPort === null) {
    throw new Error("Sidecar not initialized. Call initSidecar() first.");
  }
  return `http://127.0.0.1:${sidecarPort}`;
}

/**
 * Fetch wrapper that injects sidecar port and auth token.
 * Drop-in replacement for window.fetch with relative URLs.
 */
export async function sidecarFetch(path: string, init?: RequestInit): Promise<Response> {
  const baseUrl = getSidecarBaseUrl();
  const url = `${baseUrl}${path}`;

  const headers = new Headers(init?.headers);
  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  return fetch(url, {
    ...init,
    headers,
  });
}
