export type RecordType = "in" | "out";

interface RecordItemProps {
  plate: string;
  time: string;
  type: RecordType;
}

/** 출입차 기록 한 줄 (.ri) */
export function RecordItem({ plate, time, type }: RecordItemProps) {
  return (
    <div className="ri">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="rp">{plate}</span>
        <span className={`rtag ${type === "in" ? "in_" : "out_"}`}>{type === "in" ? "입차" : "출차"}</span>
      </div>
      <div className="rt">{time}</div>
    </div>
  );
}
