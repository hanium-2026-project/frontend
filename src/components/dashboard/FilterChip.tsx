import type { ReactNode } from "react";

interface FilterChipProps {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}

/**
 * 작은 필터 칩 — B1/B2/1F, CAM-01/02/03 같은 토글식 선택지.
 */
export function FilterChip({ active, onClick, children }: FilterChipProps) {
  return (
    <button type="button" className={`fb ${active ? "act" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}
