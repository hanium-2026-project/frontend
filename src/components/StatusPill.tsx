import type { SpotStatus } from "../types";

const labels: Record<SpotStatus | "online" | "offline" | "maintenance", string> = {
  vacant: "빈자리",
  occupied: "점유",
  reserved: "예약",
  disabled: "사용중지",
  online: "온라인",
  offline: "오프라인",
  maintenance: "점검"
};

interface StatusPillProps {
  status: SpotStatus | "online" | "offline" | "maintenance";
}

export function StatusPill({ status }: StatusPillProps) {
  return <span className={`status-pill status-${status}`}>{labels[status]}</span>;
}
