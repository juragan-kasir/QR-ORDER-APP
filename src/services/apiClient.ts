import axios from "axios";

export class ApiError extends Error {
  status: number;
  // DR-11: backend machine code (e.g. 'PRICE_CHANGED'). Undefined for
  // legacy/network errors — never guessed, only carried from the response.
  code?: string;
  // DR-11: raw backend response body (e.g. the PRICE_CHANGED `items`
  // array). Customer-facing UI must pick explicit fields from it, never
  // render it wholesale.
  data?: unknown;
  constructor(message: string, status: number, details?: { code?: string; data?: unknown }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = details?.code;
    this.data = details?.data;
  }
}

// Dev keeps a localhost convenience fallback; production must never silently
// fall back to localhost (the deployed app would call the developer's machine).
// If a production build is somehow shipped without VITE_API_BASE_URL this
// throws loudly at load instead of talking to localhost.
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "http://localhost:5001" : "");

if (!API_BASE_URL) {
  throw new Error(
    "VITE_API_BASE_URL is required in production. Set it in CI / Vercel environment variables (e.g. VITE_API_BASE_URL=https://api-bisa-nota.vercel.app)."
  );
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Maps an axios-style failure to an ApiError. Extracted (pure) so the
// mapping is unit-testable; the interceptor below delegates to it and its
// observable behavior is unchanged.
export function toApiError(error: {
  response?: { status?: number; data?: { message?: string; code?: string } & Record<string, unknown> };
  code?: string;
  message?: string;
}): ApiError {
  if (error.response) {
    const status: number = error.response.status ?? 0;
    const message =
      error.response.data?.message ||
      (status === 401
        ? "Sesi telah berakhir. Silakan muat ulang halaman."
        : status === 403
          ? "Kamu tidak memiliki akses untuk melakukan ini."
          : status === 404
            ? "Data tidak ditemukan."
            : status === 429
              ? "Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi."
              : status >= 500
                ? "Terjadi kesalahan pada server. Coba lagi nanti."
                : "Terjadi kesalahan");
    const code =
      typeof error.response.data?.code === "string"
        ? error.response.data.code
        : undefined;
    return new ApiError(message, status, { code, data: error.response.data });
  }
  if (error.code === "ECONNABORTED") {
    return new ApiError("Koneksi timeout. Periksa jaringan dan coba lagi.", 0);
  }
  return new ApiError(error.message || "Tidak dapat terhubung ke server.", 0);
}

apiClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(toApiError(error)),
);

export default apiClient;
