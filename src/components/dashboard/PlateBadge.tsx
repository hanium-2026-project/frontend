import type { ReactNode } from "react";

/** 차량 번호판 라벨 (.pl) */
export function PlateBadge({ children }: { children: ReactNode }) {
  return <span className="pl">{children}</span>;
}
