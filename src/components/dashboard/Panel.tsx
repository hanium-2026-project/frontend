import type { CSSProperties, ReactNode } from "react";

interface PanelProps {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  /** 패딩이 다른 카드와 다를 때(예: CCTV는 8px) */
  padding?: number | string;
}

/**
 * 대시보드 모든 카드의 기본 컨테이너.
 * 헤더(title + actions)가 있으면 한 줄 row로, 없으면 본문만.
 */
export function Panel({ title, actions, children, style, className = "", padding }: PanelProps) {
  const styleWithPad: CSSProperties = padding !== undefined ? { ...style, padding } : (style ?? {});
  return (
    <div className={`panel ${className}`} style={styleWithPad}>
      {(title || actions) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 6,
            gap: 8,
          }}
        >
          {title ? <div className="ptitle" style={{ margin: 0 }}>{title}</div> : <span />}
          {actions ?? null}
        </div>
      )}
      {children}
    </div>
  );
}
