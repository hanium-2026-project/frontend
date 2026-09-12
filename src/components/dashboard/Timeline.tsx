import { useState, type MouseEvent } from "react";

export interface TimelineBlock {
  /** 0..100 (%) */
  position: number;
  /** % width */
  width: number;
  type: "in" | "out" | "neutral";
}

interface TimelineProps {
  blocks?: TimelineBlock[];
  /** 0..100 — 초기 커서 위치 */
  initialPosition?: number;
}

const defaultBlocks: TimelineBlock[] = [
  { position: 8, width: 3, type: "in" },
  { position: 15, width: 2, type: "out" },
  { position: 25, width: 4, type: "in" },
  { position: 36, width: 2, type: "out" },
  { position: 44, width: 5, type: "in" },
  { position: 56, width: 3, type: "out" },
  { position: 66, width: 6, type: "neutral" },
  { position: 79, width: 4, type: "in" },
];

const ticks = [0, 3, 6, 9, 12, 15, 18, 21, 24];

/**
 * 풀폭 24시간 타임라인. 클릭하면 커서/라벨이 그 시각으로 이동.
 */
export function Timeline({ blocks = defaultBlocks, initialPosition = 37 }: TimelineProps) {
  const [pos, setPos] = useState(initialPosition);
  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    setPos(pct);
  };
  const h = Math.floor((pos / 100) * 24);
  const m = Math.floor(((pos / 100) * 24 - h) * 60);
  const label = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

  return (
    <div className="panel" style={{ padding: "7px 10px", marginTop: 7 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
        <div className="ptitle" style={{ margin: 0 }}>타임라인</div>
        <span style={{ fontSize: 10, color: "var(--text-2)" }}>{label}</span>
      </div>
      <div className="timeline" onClick={handleClick}>
        {blocks.map((b, i) => (
          <div
            key={i}
            className={`timeline-block ${b.type === "in" ? "green" : b.type === "out" ? "red" : "gray"}`}
            style={{ left: `${b.position}%`, width: `${b.width}%` }}
          />
        ))}
        <div className="timeline-cursor" style={{ left: `${pos}%` }} />
      </div>
      <div className="timeline-axis">
        {ticks.map((t) => (
          <span key={t}>{String(t).padStart(2, "0")}:00</span>
        ))}
      </div>
    </div>
  );
}
