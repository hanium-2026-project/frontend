import { FileText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getDashboard, listSpots, listVehicles } from "../api/parking";
import { AlertCard } from "../components/dashboard/AlertCard";
import { FilterChip } from "../components/dashboard/FilterChip";
import { Panel } from "../components/dashboard/Panel";
import { PlateBadge } from "../components/dashboard/PlateBadge";
import { RecordItem } from "../components/dashboard/RecordItem";
import { StatBlock } from "../components/dashboard/StatBlock";
import { Timeline } from "../components/dashboard/Timeline";
import { Topbar } from "../components/dashboard/Topbar";
import { VehicleItem } from "../components/dashboard/VehicleItem";
import { CCTVCanvas } from "../components/dashboard/canvas/CCTVCanvas";
import { ParkingMapCanvas, type SpotData } from "../components/dashboard/canvas/ParkingMapCanvas";
import { TrackMapCanvas } from "../components/dashboard/canvas/TrackMapCanvas";
import { listAvailableCameras, useCameraView } from "../hooks/useCameraView";
import { useDetections } from "../hooks/useDetections";
import type { DashboardState, ParkingSpot, Vehicle } from "../types";

const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:8000/ws/dashboard/";

// ───────────────────────────────────────────────────────────────────────────
// Mock fallback — 백엔드 없을 때 UI가 뼈대만 보여주는 게 아니라 디자인 그대로 보이도록.
// ───────────────────────────────────────────────────────────────────────────
const MOCK_SPOTS: SpotData[] = [
  { id: "A1", status: "parked",   plate: "12가3456" },
  { id: "A2", status: "empty" },
  { id: "A3", status: "entering", plate: "90마1234" },
  { id: "A4", status: "parked",   plate: "67사8901" },
  { id: "B1", status: "exiting",  plate: "45자6789" },
  { id: "B2", status: "parked",   plate: "89차0123" },
  { id: "B3", status: "empty" },
  { id: "B4", status: "parked",   plate: "56타7890" },
];

const MOCK_VEHICLES = [
  { plate: "12가3456", loc: "B1 · A1", color: "#4ade80" },
  { plate: "78나9012", loc: "B1 · A2", color: "#9ca3af" },
  { plate: "56라7890", loc: "B1 · B2", color: "#9ca3af" },
  { plate: "90마1234", loc: "입차 중",  color: "#f5d020" },
];

const MOCK_RECORDS: Array<{ plate: string; time: string; type: "in" | "out" }> = [
  { plate: "12가3456", time: "14:32", type: "in" },
  { plate: "34다5678", time: "14:28", type: "out" },
  { plate: "78나9012", time: "14:15", type: "in" },
  { plate: "56라7890", time: "13:55", type: "in" },
  { plate: "90마1234", time: "13:40", type: "out" },
  { plate: "11바2345", time: "13:22", type: "in" },
  { plate: "67사8901", time: "12:58", type: "in" },
  { plate: "23아4567", time: "12:44", type: "out" },
  { plate: "45자6789", time: "12:31", type: "in" },
  { plate: "89차0123", time: "12:10", type: "out" },
  { plate: "34카5678", time: "11:52", type: "in" },
  { plate: "56타7890", time: "11:30", type: "in" },
];

const RECENT_SEARCHES: Array<{ plate: string; loc: string }> = [
  { plate: "12가3456", loc: "A1" },
  { plate: "78나9012", loc: "B3" },
  { plate: "34다5678", loc: "출차" },
];

const FILES = ["2024-01 로그.csv", "2024-02 로그.csv"];

const FLOORS = ["B1", "B2", "1F"] as const;

/**
 * 기존 CAMS 상수는 fallback용. listAvailableCameras() 가 비어있을 때를 위해 유지.
 * 정상 흐름은 useCameraView 훅에서 카메라 메타를 가져온다.
 */
const CAMS: Array<{ id: number; label: string; loc: string }> = [
  { id: 1, label: "CAM-01", loc: "입구" },
  { id: 2, label: "CAM-02", loc: "출구" },
  { id: 3, label: "CAM-03", loc: "내부" },
];

// ───────────────────────────────────────────────────────────────────────────
// 백엔드 응답 → 캔버스 SpotData 매핑.
// 백엔드는 4 standard 스팟만 시드돼있으므로(이슈 #21 참고) 부족한 슬롯은
// MOCK_SPOTS로 채워서 디자인이 깨지지 않게 한다.
// ───────────────────────────────────────────────────────────────────────────
function mapBackendSpotsToCanvas(spots: ParkingSpot[]): SpotData[] {
  if (spots.length === 0) return MOCK_SPOTS;
  const result: SpotData[] = MOCK_SPOTS.map((m) => ({ ...m }));
  spots.forEach((s, i) => {
    if (i >= result.length) return;
    const status: SpotData["status"] =
      s.status === "occupied" ? "parked" :
      s.status === "vacant" ? "empty" :
      s.status === "reserved" ? "entering" : "empty";
    result[i] = { id: s.section || result[i].id, status };
  });
  return result;
}

function deriveVehicleListFromBackend(vs: Vehicle[]): typeof MOCK_VEHICLES {
  if (vs.length === 0) return MOCK_VEHICLES;
  return vs.slice(0, 6).map((v) => ({
    plate: v.license_plate,
    loc: v.is_registered ? "등록 차량" : "임시",
    color: v.vehicle_type === "ev" ? "#4ade80" : v.vehicle_type === "compact" ? "#f5d020" : "#9ca3af",
  }));
}

// ───────────────────────────────────────────────────────────────────────────
// 기능 #1 — 차량 추적
// 선택된 차량의 loc 문자열("B1 · A1", "입차 중" 등)에서 spot을 추출하고,
// backend의 recent_transactions에서 같은 license_plate의 entry_time을 찾아
// 주차 시간을 계산한다. 매칭 실패 시 mock 폴백.
// ───────────────────────────────────────────────────────────────────────────
interface TrackingSpot {
  /** 표시용 라벨 (예: "A1") — 매칭 못 하면 "—" */
  section: string;
  /** 미니맵 highlight (A/B 행 + 0..3 인덱스) — 매칭 못 하면 undefined */
  highlight?: { row: "A" | "B"; index: number };
}

/** "B1 · A1", "B1 · B3", "입차 중" 등에서 마지막 토큰의 spot 정보 추출 */
function parseTrackingSpot(loc: string): TrackingSpot {
  if (!loc) return { section: "—" };
  const tokens = loc.split("·").map((t) => t.trim());
  const last = tokens[tokens.length - 1] ?? "";
  // "A1" ~ "A4" 또는 "B1" ~ "B4" 형식 검사
  const m = /^([AB])([1-4])$/.exec(last);
  if (!m) return { section: last || "—" };
  const row = m[1] as "A" | "B";
  const index = Number(m[2]) - 1;
  return { section: last, highlight: { row, index } };
}

/** 분 단위 차이를 "1h 23m" 또는 "32m"로 포맷 (음수면 0m) */
function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** dash.recent_transactions에서 plate 매칭 → entry_time → 현재까지의 주차시간 */
function findTrackingDuration(
  plate: string | undefined,
  txs: DashboardState["recent_transactions"] | undefined,
  now: Date,
): string {
  if (!plate || !txs) return "—";
  const tx = txs.find((t) => t.license_plate === plate);
  if (!tx) return "—";
  const entryMs = new Date(tx.entry_time).getTime();
  if (Number.isNaN(entryMs)) return "—";
  return formatDuration(now.getTime() - entryMs);
}

// ───────────────────────────────────────────────────────────────────────────
// Page
// ───────────────────────────────────────────────────────────────────────────
export function DashboardPage() {
  const [dash, setDash] = useState<DashboardState | null>(null);
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [floor, setFloor] = useState<(typeof FLOORS)[number]>("B1");
  const [cam, setCam] = useState<number>(1);
  const [selectedVehicle, setSelectedVehicle] = useState(0);
  const [systemOnline, setSystemOnline] = useState(false);

  // 초기 fetch
  useEffect(() => {
    (async () => {
      try {
        const [d, s, v] = await Promise.all([
          getDashboard(),
          listSpots(),
          listVehicles(),
        ]);
        setDash(d);
        setSpots(s);
        setVehicles(v);
        setSystemOnline(true);
      } catch {
        setSystemOnline(false);
      }
    })();
  }, []);

  // WebSocket 라이브 갱신
  useEffect(() => {
    let socket: WebSocket | null = null;
    try {
      socket = new WebSocket(WS_URL);
      socket.onmessage = () => {
        // 입출차 이벤트가 오면 dashboard만 다시 가져옴
        getDashboard().then(setDash).catch(() => undefined);
        listSpots().then(setSpots).catch(() => undefined);
      };
      socket.onopen = () => setSystemOnline(true);
      socket.onerror = () => setSystemOnline(false);
    } catch {
      // 연결 실패 무시 — mock 폴백
    }
    return () => socket?.close();
  }, []);

  const spotData = useMemo(() => mapBackendSpotsToCanvas(spots), [spots]);
  const vehicleList = useMemo(() => deriveVehicleListFromBackend(vehicles), [vehicles]);

  const summary = dash?.summary;
  const totalToday = dash?.recent_transactions.length ?? 247;
  const parking = summary?.occupied ?? 38;
  const vacant = summary?.vacant ?? 12;

  // 기능 #2 — 카메라 메타 + Detection을 hook으로
  // listAvailableCameras()는 미래에 GET /api/cameras/ 로 교체되며,
  // useCameraView/useDetections는 WebSocket 또는 polling으로 교체된다.
  const availableCameras = useMemo(() => listAvailableCameras(), []);
  const cameraView = useCameraView(cam);
  const cameraDetections = useDetections(cam);

  // hook 미응답 시 기존 CAMS 상수로 안전 폴백
  const fallbackCam = CAMS.find((c) => c.id === cam) ?? CAMS[0];
  const currentCam = {
    id: cameraView?.id ?? fallbackCam.id,
    label: cameraView?.label ?? fallbackCam.label,
    loc: cameraView?.location ?? fallbackCam.loc,
  };

  const trackedPlate = vehicleList[selectedVehicle]?.plate ?? "12가3456";
  const trackedLoc = vehicleList[selectedVehicle]?.loc ?? "B1 · A1";

  // 기능 #1 — 차량 추적: 선택된 차량 정보 동적 계산
  const trackingSpot = useMemo(() => parseTrackingSpot(trackedLoc), [trackedLoc]);
  const [trackingNow, setTrackingNow] = useState(() => new Date());
  useEffect(() => {
    // 주차 시간 라벨이 1분 단위로 자연스럽게 갱신되도록 30초마다 tick
    const id = setInterval(() => setTrackingNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const trackingDuration = useMemo(
    () => findTrackingDuration(vehicleList[selectedVehicle]?.plate, dash?.recent_transactions, trackingNow),
    [vehicleList, selectedVehicle, dash, trackingNow],
  );

  return (
    <div className="dashboard-shell">
      <Topbar
        title="ParkView 모니터링"
        systemStatus={{
          label: systemOnline ? "시스템 정상" : "연결 끊김",
          tone: systemOnline ? "ok" : "err",
        }}
      />

      <div className="dash">
        {/* ─── 좌측: 검색 + 통계 + 차량 목록 (grid-row 1/3) ─────────── */}
        <Panel title="검색" style={{ gridRow: "1 / 3", overflow: "auto" }}>
          <input type="text" placeholder="차량번호 검색..." />

          <div className="section-label">최근 검색</div>
          {RECENT_SEARCHES.map((s, i) => (
            <div key={s.plate} className={`sr ${i === 0 ? "a" : ""}`}>
              <PlateBadge>{s.plate}</PlateBadge>
              <span style={{ fontSize: 10, color: "var(--text-2)" }}>{s.loc}</span>
            </div>
          ))}

          <div className="section-label">파일</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {FILES.map((f) => (
              <div key={f} className="file-row">
                <FileText size={12} />
                <span>{f}</span>
              </div>
            ))}
          </div>

          <div className="section-label">통계</div>
          <StatBlock
            value={totalToday}
            label="오늘 총 입차"
            sub={[
              { value: parking, label: "주차 중", tone: "green" },
              { value: vacant, label: "빈 자리", tone: "gray" },
            ]}
          />

          <div className="section-label">차량 목록</div>
          <div>
            {vehicleList.map((v, i) => (
              <VehicleItem
                key={v.plate}
                plate={v.plate}
                location={v.loc}
                color={v.color}
                selected={i === selectedVehicle}
                onClick={() => setSelectedVehicle(i)}
              />
            ))}
          </div>
        </Panel>

        {/* ─── 중앙 좌측: 주차장 맵 (grid-row 1/2) ─────────────────── */}
        <Panel
          title="전체 플로우"
          padding={8}
          actions={
            <div style={{ display: "flex", gap: 4 }}>
              {FLOORS.map((f) => (
                <FilterChip key={f} active={floor === f} onClick={() => setFloor(f)}>
                  {f}
                </FilterChip>
              ))}
            </div>
          }
        >
          <ParkingMapCanvas spots={spotData} />
          <div className="legend-row">
            <span className="legend-item"><span className="legend-dot" style={{ background: "#4ade80" }} />입차</span>
            <span className="legend-item"><span className="legend-dot" style={{ background: "#f87171" }} />출차</span>
            <span className="legend-item"><span className="legend-sq" style={{ background: "#3f4451" }} />주차 중</span>
            <span className="legend-item"><span className="legend-sq" style={{ background: "#222428" }} />빈 자리</span>
          </div>
        </Panel>

        {/* ─── 중앙 우측: CCTV (grid-row 1/2) ─────────────────────── */}
        <Panel
          title="CCTV 실시간"
          padding={8}
          actions={
            <div style={{ display: "flex", gap: 3 }}>
              {availableCameras.map((c) => (
                <FilterChip key={c.id} active={cam === c.id} onClick={() => setCam(c.id)}>
                  {c.label}
                </FilterChip>
              ))}
            </div>
          }
        >
          <div className="cctv-frame">
            <CCTVCanvas camId={cam} detections={cameraDetections} />
            <div className="live-badge">LIVE</div>
            <div className="cctv-meta">
              {currentCam.label} · {currentCam.loc}
            </div>
            <CCTVClock />
          </div>
          <div style={{ marginTop: 7 }}>
            <div className="section-label" style={{ marginTop: 0 }}>감지 알림</div>
            <AlertCard type="in" plate="12가3456" cam="CAM-01" time={recentTime(2)} />
            <AlertCard type="out" plate="34다5678" cam="CAM-02" time={recentTime(5)} />
          </div>
        </Panel>

        {/* ─── 우측: 출입차 기록 (grid-row 1/3) ─────────────────────── */}
        <Panel title="출입차 기록" style={{ gridRow: "1 / 3" }}>
          <div style={{ overflowY: "auto", maxHeight: 500 }}>
            {MOCK_RECORDS.map((r) => (
              <RecordItem key={r.plate + r.time} plate={r.plate} time={r.time} type={r.type} />
            ))}
          </div>
        </Panel>

        {/* ─── 하단 좌: 차량 선택 (grid-column 2/3) ────────────────── */}
        <Panel title="차량 선택" style={{ gridColumn: "2 / 3" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {vehicleList.map((v, i) => (
              <VehicleItem
                key={v.plate}
                plate={v.plate}
                location={v.loc}
                color={v.color}
                selected={i === selectedVehicle}
                onClick={() => setSelectedVehicle(i)}
              />
            ))}
          </div>
        </Panel>

        {/* ─── 하단 우: 차량 추적 (grid-column 3/4) ────────────────── */}
        <Panel style={{ gridColumn: "3 / 4" }}>
          <div style={{ display: "flex", gap: 8, height: "100%" }}>
            <div style={{ flex: 1 }}>
              <div className="ptitle">차량 추적</div>
              <div className="track-info">
                <div className="track-info-label">추적 중</div>
                <div className="track-info-plate">{trackedPlate}</div>
                <div className="track-info-loc">{trackedLoc}</div>
              </div>
              <div style={{ display: "flex", gap: 5 }}>
                <div className="track-stat">
                  <div className="track-stat-val">{trackingDuration}</div>
                  <div className="track-stat-label">주차 시간</div>
                </div>
                <div className="track-stat">
                  <div className="track-stat-val">{trackingSpot.section}</div>
                  <div className="track-stat-label">구역</div>
                </div>
              </div>
            </div>
            <TrackMapCanvas highlightSpot={trackingSpot.highlight} />
          </div>
        </Panel>
      </div>

      {/* 타임라인 (그리드 밖, 풀폭) */}
      <Timeline />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 작은 시계 — CCTV 우상단 라이브 타임 표시
// ──────────────────────────────────────────────────────────────────────────
function CCTVClock() {
  const [t, setT] = useState(formatHMS(new Date()));
  useEffect(() => {
    const id = setInterval(() => setT(formatHMS(new Date())), 1000);
    return () => clearInterval(id);
  }, []);
  return <div className="cctv-time">{t}</div>;
}

function formatHMS(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function recentTime(minutesAgo: number) {
  const n = new Date();
  const total = n.getHours() * 60 + n.getMinutes() - minutesAgo;
  const h = Math.floor(Math.max(0, total) / 60);
  const m = Math.max(0, total) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
