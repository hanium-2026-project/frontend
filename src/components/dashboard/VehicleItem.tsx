interface VehicleItemProps {
  plate: string;
  location: string;
  /** 좌측 점 색상 (차량 유형/상태 표시) */
  color?: string;
  selected?: boolean;
  onClick?: () => void;
}

/**
 * 차량 목록 항목 — 좌측 색상 점 + 번호판 + 위치
 */
export function VehicleItem({ plate, location, color = "#9ca3af", selected, onClick }: VehicleItemProps) {
  return (
    <button type="button" className={`vi ${selected ? "s" : ""}`} onClick={onClick}>
      <div className="vd" style={{ background: color }} />
      <div>
        <div className="vp">{plate}</div>
        <div className="vl">{location}</div>
      </div>
    </button>
  );
}
