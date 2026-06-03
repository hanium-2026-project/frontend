type Tone = "green" | "gray" | "red";

interface SubStat {
  value: number | string;
  label: string;
  tone?: Tone;
}

interface StatBlockProps {
  value: number | string;
  label: string;
  sub?: SubStat[];
}

/**
 * 큰 숫자 1개 + 보조 통계(주차중/빈자리 등)를 보여주는 통계 블록.
 */
export function StatBlock({ value, label, sub }: StatBlockProps) {
  return (
    <div className="stat-block">
      <div className="stat-main">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && sub.length > 0 && (
        <div className="stat-row">
          {sub.map((s, i) => (
            <div key={i} className="stat-cell">
              <div className={`stat-cell-val ${s.tone ?? ""}`.trim()}>{s.value}</div>
              <div className="stat-cell-label">{s.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
