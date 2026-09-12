interface AlertCardProps {
  type: "in" | "out";
  plate: string;
  cam: string;
  time: string;
}

/** CCTV 좌측 하단 감지 알림 (입차/출차) */
export function AlertCard({ type, plate, cam, time }: AlertCardProps) {
  return (
    <div className={`alert ${type === "in" ? "green" : "red"}`}>
      <div className="alert-title">{type === "in" ? "입차 감지" : "출차 감지"}</div>
      <div className="alert-sub">
        {plate} · {cam} · {time}
      </div>
    </div>
  );
}
