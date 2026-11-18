const TOKEN_KEY = "lapor-depok.token";

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // localStorage bisa diblokir; sesi tetap jalan sampai halaman ditutup.
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // abaikan
  }
}

export async function apiRequest(path, { method = "GET", body, headers = {} } = {}) {
  const options = { method, headers: { ...headers } };

  if (body !== undefined) {
    if (body instanceof FormData) {
      options.body = body;
    } else {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }
  }

  const token = getToken();
  if (token) options.headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`/api${path}`, options);
  } catch {
    throw new ApiError(0, "network_error", "Tidak dapat terhubung ke server. Periksa koneksi Anda.");
  }

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    if (response.status === 401) {
      clearToken();
      window.dispatchEvent(new Event("lapor:unauthorized"));
    }

    const detail = data?.detail;
    let message = "Terjadi kesalahan. Silakan coba lagi.";
    let code = "error";

    if (typeof detail === "string") {
      message = detail;
    } else if (Array.isArray(detail)) {
      message = "Data yang dikirim belum lengkap atau tidak valid.";
      code = "validation_error";
    } else if (detail && typeof detail === "object") {
      if (typeof detail.message === "string") message = detail.message;
      if (typeof detail.code === "string") code = detail.code;
    }

    throw new ApiError(response.status, code, message);
  }

  return data;
}

export const api = {
  get: (path) => apiRequest(path),
  post: (path, body) => apiRequest(path, { method: "POST", body }),
  patch: (path, body) => apiRequest(path, { method: "PATCH", body }),
  delete: (path) => apiRequest(path, { method: "DELETE" }),
  download: async (path, filename) => {
    const token = getToken();
    const response = await fetch(`/api${path}`, {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const blob = await response.blob();
    if (!response.ok) {
      let message = "Gagal mengunduh berkas.";
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await response.json();
        if (data?.detail?.message) message = data.detail.message;
      }
      throw new ApiError(response.status, "export_failed", message);
    }
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
    return blob;
  },
};
