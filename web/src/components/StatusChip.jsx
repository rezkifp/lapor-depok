import { STATUS_LABELS } from "../lib/format";

const TONES = {
  diterima: "bg-status-diterima-bg text-status-diterima-fg",
  diverifikasi: "bg-status-diverifikasi-bg text-status-diverifikasi-fg",
  diproses: "bg-status-diproses-bg text-status-diproses-fg",
  selesai: "bg-status-selesai-bg text-status-selesai-fg",
  ditolak: "bg-status-ditolak-bg text-status-ditolak-fg",
};

export default function StatusChip({ status, className = "" }) {
  return (
    <span className={`chip ${TONES[status] ?? "bg-surface text-muted"} ${className}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
