import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { listLots, listSpots, updateSpotStatus } from "../api/parking";
import { SpotMap } from "../components/SpotMap";
import { StatusPill } from "../components/StatusPill";
import type { ParkingLot, ParkingSpot, SpotStatus } from "../types";

export function ParkingMapPage() {
  const [lots, setLots] = useState<ParkingLot[]>([]);
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [selected, setSelected] = useState<ParkingSpot | null>(null);
  const [message, setMessage] = useState("");

  const refresh = () => {
    Promise.all([listLots(), listSpots()])
      .then(([lotData, spotData]) => {
        setLots(lotData);
        setSpots(spotData);
        if (selected) {
          setSelected(spotData.find((spot) => spot.spot_id === selected.spot_id) ?? null);
        }
      })
      .catch((error) => setMessage(error.message));
  };

  useEffect(refresh, []);

  const changeStatus = (status: SpotStatus) => {
    if (!selected) return;
    updateSpotStatus(selected.spot_id, status)
      .then((spot) => {
        setSelected(spot);
        refresh();
      })
      .catch((error) => setMessage(error.message));
  };

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <h1>주차장 지도</h1>
          <p>좌표 기반 맵에서 주차 칸 상태를 확인하고 운영 상태를 조정합니다.</p>
        </div>
        <button className="icon-button" onClick={refresh} title="새로고침">
          <RefreshCw size={18} aria-hidden="true" />
        </button>
      </header>

      <div className="content-grid map-layout">
        <section className="panel map-panel">
          <SpotMap spots={spots} selectedSpotId={selected?.spot_id} onSelectSpot={setSelected} />
        </section>
        <aside className="panel detail-panel">
          <h2>상세 정보</h2>
          {selected ? (
            <div className="detail-list">
              <p>
                <span>구역</span>
                <strong>{selected.section}</strong>
              </p>
              <p>
                <span>유형</span>
                <strong>{selected.spot_type}</strong>
              </p>
              <p>
                <span>상태</span>
                <StatusPill status={selected.status} />
              </p>
              <p>
                <span>좌표</span>
                <strong>
                  {selected.coord_x}, {selected.coord_y}
                </strong>
              </p>
              <div className="segmented">
                {(["vacant", "occupied", "reserved", "disabled"] as SpotStatus[]).map((status) => (
                  <button key={status} className={selected.status === status ? "active" : ""} onClick={() => changeStatus(status)}>
                    {status}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="muted">지도에서 주차 칸을 선택하세요.</p>
          )}
          <div className="lot-mini-list">
            {lots.map((lot) => (
              <div key={lot.lot_id}>
                <strong>{lot.name}</strong>
                <span>
                  {lot.vacant_count} / {lot.total_capacity} 빈자리
                </span>
              </div>
            ))}
          </div>
          {message && <p className="form-message">{message}</p>}
        </aside>
      </div>
    </div>
  );
}
