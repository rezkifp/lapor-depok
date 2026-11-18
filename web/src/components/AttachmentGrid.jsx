import { useEffect, useState } from "react";

import { getToken } from "../lib/api";
import { formatFileSize } from "../lib/format";

/**
 * Menampilkan daftar lampiran terautentikasi (fetch + Bearer -> Blob URL)
 * dengan preview modal lightbox untuk gambar.
 */
export default function AttachmentGrid({ fetchUrlPrefix, attachments }) {
  const [items, setItems] = useState(() =>
    attachments.map((item) => ({ ...item, url: "", loading: true, error: false })),
  );
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    let active = true;
    const urls = [];
    const token = getToken();
    setItems(attachments.map((item) => ({ ...item, url: "", loading: true, error: false })));

    attachments.forEach((attachment) => {
      fetch(`${fetchUrlPrefix}/${attachment.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((response) => {
          if (!response.ok) throw new Error("Gagal memuat");
          return response.blob();
        })
        .then((blob) => {
          const url = window.URL.createObjectURL(blob);
          urls.push(url);
          if (!active) return;
          setItems((current) =>
            current.map((item) =>
              item.id === attachment.id ? { ...item, url, loading: false } : item,
            ),
          );
        })
        .catch(() => {
          if (!active) return;
          setItems((current) =>
            current.map((item) =>
              item.id === attachment.id ? { ...item, loading: false, error: true } : item,
            ),
          );
        });
    });

    return () => {
      active = false;
      urls.forEach((url) => window.URL.revokeObjectURL(url));
    };
  }, [fetchUrlPrefix, attachments]);

  useEffect(() => {
    if (!preview) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setPreview(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [preview]);

  if (attachments.length === 0) return null;

  return (
    <>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="overflow-hidden rounded-btn border border-line bg-surface"
          >
            {item.loading ? (
              <div className="flex h-36 items-center justify-center">
                <span className="text-xs text-muted">Memuat lampiran...</span>
              </div>
            ) : null}

            {!item.loading && item.error ? (
              <div className="flex h-36 items-center justify-center px-3 text-center">
                <span className="text-xs text-status-ditolak-fg">Gagal memuat lampiran</span>
              </div>
            ) : null}

            {!item.loading && !item.error && item.mime === "application/pdf" ? (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="flex h-36 flex-col items-center justify-center gap-2 px-3 text-center hover:bg-white"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-9 w-9 text-status-ditolak-fg"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M6 3h8l5 5v13H6z" />
                  <path d="M14 3v5h5" />
                  <path d="M9 13h6M9 17h4" />
                </svg>
                <span className="text-sm font-semibold text-navy">Buka PDF</span>
              </a>
            ) : null}

            {!item.loading && !item.error && item.mime !== "application/pdf" ? (
              <button
                type="button"
                onClick={() => setPreview(item)}
                className="group relative block w-full cursor-zoom-in text-left"
                aria-label={`Perbesar lampiran ${item.name}`}
              >
                <img
                  src={item.url}
                  alt={`Lampiran ${item.name}`}
                  className="h-36 w-full object-cover transition group-hover:brightness-95"
                />
              </button>
            ) : null}

            <div className="flex items-center justify-between gap-2 border-t border-line bg-white px-3 py-2">
              <p className="truncate text-xs font-medium text-ink" title={item.name}>
                {item.name}
              </p>
              <span className="shrink-0 text-[11px] text-muted">{formatFileSize(item.size)}</span>
            </div>
          </div>
        ))}
      </div>

      {preview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Preview ${preview.name}`}
          onClick={() => setPreview(null)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-card bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <p className="truncate text-sm font-bold text-navy">{preview.name}</p>
              <div className="flex items-center gap-2">
                <a
                  href={preview.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-control items-center rounded-btn border border-line px-3 text-xs font-semibold text-navy hover:border-blue hover:text-blue"
                >
                  Tab Baru
                </a>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="inline-flex min-h-control items-center rounded-btn bg-navy px-4 text-xs font-bold text-white hover:bg-blue"
                >
                  Tutup
                </button>
              </div>
            </div>
            <div className="flex max-h-[75vh] items-center justify-center bg-surface p-4">
              <img
                src={preview.url}
                alt={`Lampiran ${preview.name}`}
                className="max-h-[70vh] max-w-full rounded-btn object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
