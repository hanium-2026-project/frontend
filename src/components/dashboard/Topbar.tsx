import { CircleParking } from "lucide-react";
import React, { useEffect, useState } from "react";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatTime(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

interface TopbarProps {
  title?: string;
  /** 시스템 상태(좌측 dot 색상이 자동으로 따라옴: ok=초록, warn=노랑, err=빨강) */
  systemStatus?: { label: string; tone?: "ok" | "warn" | "err" };
}

export function Topbar({ title = "ParkView 모니터링", systemStatus }: TopbarProps) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const status = systemStatus ?? { label: "시스템 정상", tone: "ok" as const };
  const dotColor =
    status.tone === "err" ? "var(--red)" : status.tone === "warn" ? "var(--yellow)" : "var(--green)";

  return (
    <div className="topbar">
      <div className="topbar-brand">
        <div className="topbar-brand-icon">
          <CircleParking size={13} aria-hidden="true" />
        </div>
        <span className="topbar-title">{title}</span>
      </div>
      <div className="topbar-right">
        <span className="clock">{formatTime(now)}</span>
        <span
          className="status-indicator"
          style={{ "--dot-color": dotColor } as React.CSSProperties}
        >
          {status.label}
        </span>
      </div>
    </div>
  );
}
