import { Activity, Camera, CarFront, CircleParking, Clock3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getDashboard } from "../api/parking";
import { StatCard } from "../components/StatCard";
import { StatusPill } from "../components/StatusPill";
import type { DashboardState } from "../types";

const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:8000/ws/dashboard/";

export function DashboardPage() {
  const [state, setState] = useState<DashboardState | null>(null);
  const [liveEvent, setLiveEvent] = useState<string>("대기 중");

  useEffect(() => {
    getDashboard().then(setState).catch((error) => setLiveEvent(error.message));
  }, []);

  useEffect(() => {
    const socket = new WebSocket(WS_URL);
    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data) as { type: string; payload?: { event?: string; license_plate?: string } };
      if (payload.payload?.event) {
        setLiveEvent(`${payload.payload.event}: ${payload.payload.license_plate ?? ""}`);
        getDashboard().then(setState).catch(() => undefined);
      }
    };
    socket.onerror = () => setLiveEvent("WebSocket 연결 대기");
    return () => socket.close();
  }, []);

  const summary = state?.summary;
  const activeRate = useMemo(() => {
    if (!summary || summary.total_spots === 0) return "0%";
    return `${Math.round((summary.occupied / summary.total_spots) * 100)}%`;
  }, [summary]);

  if (!state || !summary) {
    return <div className="page-loading">대시보드 데이터를 불러오는 중입니다.</div>;
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <h1>주차 관제 대시보드</h1>
          <p>전체 주차장 상태와 카메라 헬스체크, 최근 입출차 흐름을 확인합니다.</p>
        </div>
        <span className="live-chip">
          <Activity size={16} aria-hidden="true" />
          {liveEvent}
        </span>
      </header>

      <section className="stat-grid">
        <StatCard label="전체 주차 칸" value={summary.total_spots} icon={CircleParking} />
        <StatCard label="빈자리" value={summary.vacant} icon={CircleParking} tone="good" />
        <StatCard label="점유" value={summary.occupied} icon={CarFront} tone="warn" />
        <StatCard label="예약" value={summary.reserved} icon={Clock3} />
        <StatCard label="카메라 온라인" value={summary.cameras_online} icon={Camera} tone="good" />
        <StatCard label="점유율" value={activeRate} icon={Activity} tone="neutral" />
      </section>

      <section className="content-grid two">
        <div className="panel">
          <div className="panel-heading">
            <h2>주차장 현황</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>주차장</th>
                  <th>빈자리</th>
                  <th>점유</th>
                  <th>예약</th>
                  <th>총량</th>
                </tr>
              </thead>
              <tbody>
                {state.lots.map((lot) => (
                  <tr key={lot.lot_id}>
                    <td>{lot.name}</td>
                    <td>{lot.vacant_count}</td>
                    <td>{lot.occupied_count}</td>
                    <td>{lot.reserved_count}</td>
                    <td>{lot.total_capacity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <h2>카메라 상태</h2>
          </div>
          <div className="camera-list">
            {state.cameras.map((camera) => (
              <div key={camera.camera_id} className="camera-row">
                <div>
                  <strong>CAM-{camera.camera_id}</strong>
                  <span>{camera.location_desc}</span>
                </div>
                <StatusPill status={camera.status} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>최근 입출차 기록</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>차량 번호</th>
                <th>주차 칸</th>
                <th>입차</th>
                <th>출차</th>
              </tr>
            </thead>
            <tbody>
              {state.recent_transactions.map((item) => (
                <tr key={item.transaction_id}>
                  <td>{item.license_plate}</td>
                  <td>{item.spot_id}</td>
                  <td>{new Date(item.entry_time).toLocaleString()}</td>
                  <td>{item.exit_time ? new Date(item.exit_time).toLocaleString() : "진행 중"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
