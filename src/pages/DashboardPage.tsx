import { FileText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getDashboard, listSpots, listTransactions, listVehicles } from "../api/parking";
import { AlertCard } from "../components/dashboard/AlertCard";
import { FilterChip } from "../components/dashboard/FilterChip";
import { Panel } from "../components/dashboard/Panel";
import { PlateBadge } from "../components/dashboard/PlateBadge";
import { RecordItem } from "../components/dashboard/RecordItem";
import { StatBlock } from "../components/dashboard/StatBlock";
import { Topbar } from "../components/dashboard/Topbar";
import { VehicleItem } from "../components/dashboard/VehicleItem";
import { CCTVCanvas } from "../components/dashboard/canvas/CCTVCanvas";
import { ParkingMapCanvas, type SpotData, type SpotStatus as CanvasSpotStatus } from "../components/dashboard/canvas/ParkingMapCanvas";
import { useCameras } from "../hooks/useCameraView";
import { useDetections } from "../hooks/useDetections";
import type { DashboardState, EntryExit, ParkingSpot, Vehicle } from "../types";
import type { TrackedVehicle, VehicleRoute } from "../types/cv";

const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:8000/ws/dashboard/";

// pose 가 이 시간 이상 끊기면 "옛 위치"로 표시한다. 파이프라인이 죽었는데 차가
// 지도에 그대로 떠 있으면 실제보다 상황이 좋아 보여서 시연 중 오판하기 쉽다.
const POSE_STALE_MS = 2500;
// 이 시간까지 소식이 없으면 지도에서 지운다.
const POSE_DROP_MS = 15000;
// 백엔드를 재시작해도 화면이 알아서 다시 붙도록 재접속한다.
const WS_RECONNECT_MS = 2000;

// ───────────────────────────────────────────────────────────────────────────
// Mock fallback — 백엔드 없을 때 UI가 뼈대만 보여주는 게 아니라 디자인 그대로 보이도록.
// ───────────────────────────────────────────────────────────────────────────






/**
 * 정상 흐름은 useCameraView 훅에서 카메라 메타를 가져온다.
 */

// ───────────────────────────────────────────────────────────────────────────
// 백엔드 응답 → 캔버스 SpotData 매핑.
// 백엔드는 4 standard 스팟만 시드돼있으므로(이슈 #21 참고) 부족한 슬롯은
// MOCK_SPOTS로 채워서 디자인이 깨지지 않게 한다.
// ───────────────────────────────────────────────────────────────────────────
function mapBackendSpotsToCanvas(spots: ParkingSpot[]): SpotData[] {
  if (spots.length === 0) return [];
  const result: SpotData[] = [];
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

/** 지금 주차 중인 차량의 슬롯. exit_time 이 없는 거래가 곧 "주차 중"이다. */
function openSpotByPlate(txs: EntryExit[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const t of txs) {
    if (!t.exit_time) m.set(t.license_plate, t.spot_label || `#${t.spot_id}`);
  }
  return m;
}

function deriveVehicleListFromBackend(
  vs: Vehicle[], parkedAt: Map<string, string>,
): Array<{ plate: string; loc: string; color: string }> {
  if (vs.length === 0) return [];
  return vs.slice(0, 6).map((v) => ({
    plate: v.license_plate,
    // 주차 중이면 실제 슬롯을, 아니면 상태를 보여준다. 예전에는 등록 여부를
    // loc 에 넣어서 "구역" 칸에 "등록 차량"이 뜨는 문제가 있었다.
    loc: parkedAt.get(v.license_plate) ?? (v.is_registered ? "미주차" : "임시 · 미주차"),
    color: v.vehicle_type === "ev" ? "#4ade80" : v.vehicle_type === "compact" ? "#f5d020" : "#9ca3af",
  }));
}

// ───────────────────────────────────────────────────────────────────────────
// ───────────────────────────────────────────────────────────────────────────
// 입출차 이벤트 — 출입차 기록 / 감지 알림 / 타임라인이 공유한다.
// 거래 한 건은 이벤트 두 개다: entry_time 의 입차, exit_time 이 있으면 출차.
// 셋을 각각 다른 소스로 만들면 화면끼리 숫자가 어긋나므로 하나에서 파생한다.
// ───────────────────────────────────────────────────────────────────────────
interface ParkingEvent {
  plate: string;
  spot: string;
  at: Date;
  type: "in" | "out";
}

function toParkingEvents(txs: EntryExit[]): ParkingEvent[] {
  const out: ParkingEvent[] = [];
  for (const t of txs) {
    const spot = t.spot_label || `#${t.spot_id}`;
    const entered = new Date(t.entry_time);
    if (!Number.isNaN(entered.getTime())) {
      out.push({ plate: t.license_plate, spot, at: entered, type: "in" });
    }
    if (t.exit_time) {
      const left = new Date(t.exit_time);
      if (!Number.isNaN(left.getTime())) {
        out.push({ plate: t.license_plate, spot, at: left, type: "out" });
      }
    }
  }
  return out.sort((a, b) => b.at.getTime() - a.at.getTime());   // 최신 먼저
}

/** 현재 불러온 입출차 거래를 CSV 로 내려받는다. 없는 파일을 나열하는 대신
 *  실제 데이터를 내보낸다. Excel 한글 깨짐 방지로 BOM 을 붙인다. */
function exportTransactionsCsv(txs: EntryExit[]): void {
  const header = "transaction_id,license_plate,spot,entry_time,exit_time";
  const rows = txs.map((t) => [
    t.transaction_id, t.license_plate, t.spot_label || t.spot_id,
    t.entry_time, t.exit_time ?? "",
  ].join(","));
  const blob = new Blob(["\uFEFF" + [header, ...rows].join("\n")],
                        { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `parking_transactions_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function formatHM(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

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
  // 백엔드에 층(B1/B2/1F) 개념이 없다. 있지도 않은 층을 탭으로 두면 눌러도
  // 아무 일이 없어 오해를 부르므로, 실제 주차장 목록으로 바꾼다.
  const [lotId, setLotId] = useState<number | null>(null);
  const [cam, setCam] = useState<number>(1);
  const [selectedVehicle, setSelectedVehicle] = useState(0);
  const [systemOnline, setSystemOnline] = useState(false);
  // 기능 #10 — 실시간 차량 위치 스트림 (vehicle.telemetry WS)
  // key = trackingId(=car_id). Map으로 같은 차량 재전송 시 최신값만 유지.
  const [liveVehicles, setLiveVehicles] = useState<Map<string, TrackedVehicle>>(() => new Map());
  const [txs, setTxs] = useState<EntryExit[]>([]);
  // car_id → 배정된 슬롯과 경로. 배정·재계획 때만 오므로 pose 와 달리
  // 스트림이 아니라 이벤트로 받아 캐시한다.
  const [routes, setRoutes] = useState<Map<number, VehicleRoute>>(() => new Map());
  const [search, setSearch] = useState("");
  // 최근 검색은 실제로 사용자가 검색한 것만 남긴다 (하드코딩 목록을 대체).
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // 초기 fetch
  useEffect(() => {
    (async () => {
      try {
        const [d, s, v, t] = await Promise.all([
          getDashboard(),
          listSpots(),
          listVehicles(),
          listTransactions(),
        ]);
        setDash(d);
        setSpots(s);
        setVehicles(v);
        setTxs(t);
        setSystemOnline(true);
      } catch {
        setSystemOnline(false);
      }
    })();
  }, []);

  // WebSocket 라이브 갱신
  //   - type "vehicle.telemetry" → liveVehicles Map 갱신 (ParkingMapCanvas 오버레이)
  //   - type "parking.state"     → dashboard/spots 다시 fetch
  //   - "connected" / "error"    → 무시
  useEffect(() => {
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const handleMessage = (event: MessageEvent) => {
        let msg: { type?: string; payload?: unknown } = {};
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }
        if (msg.type === "vehicle.telemetry" && msg.payload && typeof msg.payload === "object") {
          const p = msg.payload as {
            car_id?: number | null;
            track_id?: number | null;
            license_plate?: string;
            pos?: [number, number];
            status?: string;
            target_spot_id?: number | null;
            heading_deg?: number;
            heading_source?: string;
            parking_phase?: string;
          };
          if (!Array.isArray(p.pos) || p.pos.length !== 2) return;
          const bound = typeof p.car_id === "number";
          // 바인딩 전에는 track_id 가 유일한 키다. 두 키 공간을 섞으면 서로를
          // 덮어써서 한 대가 화면에서 사라진다.
          const key = bound ? `car:${p.car_id}` : `track:${p.track_id}`;
          if (!bound && typeof p.track_id !== "number") return;
          const tv: TrackedVehicle = {
            trackingId: key,
            bound,
            plate: p.license_plate,
            position: { x: p.pos[0], y: p.pos[1] },
            lastSeenAt: new Date().toISOString(),
            status: p.status,
            targetSpotId: p.target_spot_id ?? null,
            headingDeg: p.heading_deg,
            // FRONT_CUSHION / TRAJECTORY / LAST_VALID — 마커를 실제로 보고 있는지
            // 화면에서 바로 알 수 있어야 인지 문제를 현장에서 판별할 수 있다.
            headingSource: p.heading_source,
            parkingPhase: p.parking_phase,
          };
          setLiveVehicles((prev) => {
            const next = new Map(prev);
            next.set(tv.trackingId, tv);
            return next;
          });
        } else if (msg.type === "parking.state") {
          const ev = msg.payload as {
            event?: string; car_id?: number; slot?: string;
            route_id?: number | null;
            waypoints?: Array<{ waypoint_id: number; phase: string; x: number; y: number }>;
          } | undefined;
          if (ev?.event === "slot_assigned" && typeof ev.car_id === "number") {
            const carId = ev.car_id;
            setRoutes((prev) => {
              const next = new Map(prev);
              next.set(carId, {
                carId,
                slot: ev.slot ?? "",
                routeId: ev.route_id ?? null,
                waypoints: Array.isArray(ev.waypoints) ? ev.waypoints : [],
              });
              return next;
            });
          }
          getDashboard().then(setDash).catch(() => undefined);
          listSpots().then(setSpots).catch(() => undefined);
          listTransactions().then(setTxs).catch(() => undefined);
        }
    };

    const connect = () => {
      if (closed) return;
      try {
        socket = new WebSocket(WS_URL);
      } catch {
        retry = setTimeout(connect, WS_RECONNECT_MS);   // 생성 자체가 실패해도 재시도
        return;
      }
      socket.onmessage = handleMessage;
      socket.onopen = () => setSystemOnline(true);
      socket.onclose = () => {
        setSystemOnline(false);
        if (!closed) retry = setTimeout(connect, WS_RECONNECT_MS);
      };
      socket.onerror = () => socket?.close();           // close 로 넘겨 재접속 경로 일원화
    };

    connect();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      socket?.close();
    };
  }, []);

  // pose 가 안 와도 stale 표시가 갱신되도록 주기적으로 다시 계산한다.
  const [poseTick, setPoseTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPoseTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, []);

  // Map → 배열 (ParkingMapCanvas가 배열 요구). 오래된 pose 는 stale 표시 후 제거.
  const liveVehiclesArr = useMemo(() => {
    const now = Date.now();
    const out: TrackedVehicle[] = [];
    liveVehicles.forEach((v) => {
      const age = now - Date.parse(v.lastSeenAt);
      if (Number.isFinite(age) && age > POSE_DROP_MS) return;
      out.push(age > POSE_STALE_MS ? { ...v, stale: true } : v);
    });
    return out.sort((a, b) => a.trackingId.localeCompare(b.trackingId));
    // poseTick 은 시간 경과만으로 stale 이 바뀌게 하는 의존성이다.
  }, [liveVehicles, poseTick]);

  // 출입차 기록 / 감지 알림 / 타임라인이 모두 여기서 파생된다.
  const parkingEvents = useMemo(() => toParkingEvents(txs), [txs]);
  const latestIn = useMemo(() => parkingEvents.find((e) => e.type === "in"), [parkingEvents]);
  const latestOut = useMemo(() => parkingEvents.find((e) => e.type === "out"), [parkingEvents]);

  // 화면에 실제로 떠 있는 차량의 경로만 그린다 — 사라진 차의 경로가 남으면
  // 지금 유효한 계획인 것처럼 보인다.
  const activeRoutes = useMemo(() => {
    const live = new Set(
      liveVehiclesArr
        .filter((v) => v.bound !== false)
        .map((v) => Number(v.trackingId.replace("car:", ""))),
    );
    return [...routes.values()].filter((r) => live.has(r.carId));
  }, [routes, liveVehiclesArr]);

  const spotData = useMemo(() => mapBackendSpotsToCanvas(spots), [spots]);

  // 기능 #7 — 실측 좌표 기반 렌더링용 파생 데이터
  const lotDims = useMemo(() => {
    const l = dash?.lots?.[0];
    if (!l || !l.lot_width || !l.lot_height) return undefined;
    return { width: l.lot_width, height: l.lot_height };
  }, [dash]);

  const spotStatusMap = useMemo(() => {
    const m: Record<number, CanvasSpotStatus> = {};
    for (const s of spots) {
      m[s.spot_id] = s.status === "occupied" ? "parked"
        : s.status === "vacant" ? "empty"
        : s.status === "reserved" ? "entering"
        : "empty";
    }
    return m;
  }, [spots]);

  const spotPlateMap = useMemo(() => {
    const m: Record<number, string> = {};
    for (const tx of dash?.recent_transactions ?? []) {
      if (!tx.exit_time && tx.spot_id) m[tx.spot_id] = tx.license_plate;
    }
    return m;
  }, [dash]);
  const parkedAt = useMemo(() => openSpotByPlate(txs), [txs]);
  const allVehicles = useMemo(() => deriveVehicleListFromBackend(vehicles, parkedAt), [vehicles, parkedAt]);
  const vehicleList = useMemo(() => {
    const q = search.trim().replace(/\s+/g, "").toLowerCase();
    if (!q) return allVehicles;
    return allVehicles.filter((v) => v.plate.replace(/\s+/g, "").toLowerCase().includes(q));
  }, [allVehicles, search]);

  // 검색으로 목록이 줄면 선택 인덱스가 범위를 벗어날 수 있다.
  useEffect(() => {
    if (selectedVehicle >= vehicleList.length) setSelectedVehicle(0);
  }, [vehicleList.length, selectedVehicle]);

  const commitSearch = (q: string) => {
    const v = q.trim();
    if (!v) return;
    setRecentSearches((prev) => [v, ...prev.filter((x) => x !== v)].slice(0, 5));
  };

  const summary = dash?.summary;
  const totalToday = dash?.recent_transactions.length ?? 0;
  const parking = summary?.occupied ?? 38;
  const vacant = summary?.vacant ?? 12;

  // 기능 #2 — 카메라 메타 + Detection을 hook으로
  // listAvailableCameras()는 미래에 GET /api/cameras/ 로 교체되며,
  // useCameraView/useDetections는 WebSocket 또는 polling으로 교체된다.
  const availableCameras = useCameras();
  // 백엔드 목록이 오면 첫 카메라를 고른다. 하드코딩 기본값(1)이 실제로 없는
  // 카메라일 수 있기 때문.
  useEffect(() => {
    if (availableCameras.length && !availableCameras.some((c) => c.id === cam)) {
      setCam(availableCameras[0].id);
    }
  }, [availableCameras, cam]);
  const cameraView = availableCameras.find((c) => c.id === cam);
  const cameraDetections = useDetections(cam);

  const currentCam = {
    id: cameraView?.id ?? cam,
    label: cameraView?.label ?? `CAM-${String(cam).padStart(2, "0")}`,
    loc: cameraView?.location ?? "연결 확인 중",
  };

  const trackedPlate = vehicleList[selectedVehicle]?.plate ?? "—";
  const trackedLoc = vehicleList[selectedVehicle]?.loc ?? "미주차";

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
        {/* ─── 좌측: 검색 + 통계 + 차량 목록 (col 1, rows 1-2) ─────── */}
        <Panel title="검색" style={{ gridColumn: "1 / 2", gridRow: "1 / 3", overflow: "auto" }}>
          <input
            type="text"
            placeholder="차량번호 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commitSearch(search); }}
            onBlur={() => commitSearch(search)}
          />

          <div className="section-label">최근 검색</div>
          {recentSearches.length === 0 ? (
            <div className="muted" style={{ fontSize: 10, padding: "4px 2px" }}>
              검색 기록 없음
            </div>
          ) : (
            recentSearches.map((q, i) => (
              <div key={q} className={`sr ${i === 0 ? "a" : ""}`}
                   style={{ cursor: "pointer" }} onClick={() => setSearch(q)}>
                <PlateBadge>{q}</PlateBadge>
                <span style={{ fontSize: 10, color: "var(--text-2)" }}>
                  {allVehicles.some((v) => v.plate === q) ? "등록됨" : "미등록"}
                </span>
              </div>
            ))
          )}

          <div className="section-label">기록 내보내기</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div className="file-row" style={{ cursor: txs.length ? "pointer" : "default", opacity: txs.length ? 1 : 0.5 }}
                 onClick={() => txs.length && exportTransactionsCsv(txs)}>
              <FileText size={12} />
              <span>입출차 기록 CSV ({txs.length}건)</span>
            </div>
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
            {vehicleList.length === 0 && (
              <div className="muted" style={{ fontSize: 11, padding: "6px 2px" }}>
                「{search}」 검색 결과 없음
              </div>
            )}
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

        {/* ─── 중앙 좌측: 주차장 맵 (col 2, row 1) ─────────────────── */}
        <Panel
          title="전체 플로우"
          padding={8}
          style={{ gridColumn: "2 / 3", gridRow: "1 / 2" }}
          actions={
            <div style={{ display: "flex", gap: 4 }}>
              {(dash?.lots ?? []).map((l) => (
                <FilterChip
                  key={l.lot_id}
                  active={(lotId ?? dash?.lots?.[0]?.lot_id) === l.lot_id}
                  onClick={() => setLotId(l.lot_id)}
                >
                  {l.name}
                </FilterChip>
              ))}
            </div>
          }
        >
          {/* 기능 #7: lot dims + 실측 spots 넘김. 폴백으로 legacySpots(mock) 병행 전달 */}
          {spots.length === 0 && (
            <div className="muted" style={{ fontSize: 11, padding: "6px 2px" }}>
              주차 칸 데이터가 없습니다 — 백엔드 연결을 확인하세요
            </div>
          )}
          <ParkingMapCanvas
            spots={spots.length > 0 ? spots : undefined}
            lot={lotDims}
            spotStatus={spotStatusMap}
            spotPlates={spotPlateMap}
            vehicles={liveVehiclesArr}
            routes={activeRoutes}
            legacySpots={spotData}
          />
          <div className="legend-row">
            <span className="legend-item"><span className="legend-dot" style={{ background: "#4ade80" }} />입차</span>
            <span className="legend-item"><span className="legend-dot" style={{ background: "#f87171" }} />출차</span>
            <span className="legend-item"><span className="legend-sq" style={{ background: "#3f4451" }} />주차 중</span>
            <span className="legend-item"><span className="legend-sq" style={{ background: "#222428" }} />빈 자리</span>
          </div>
        </Panel>

        {/* ─── 중앙 우측: CCTV (col 3, row 1) ─────────────────────── */}
        <Panel
          title="CCTV 실시간"
          padding={8}
          style={{ gridColumn: "3 / 4", gridRow: "1 / 2" }}
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
            <CCTVCanvas
              camId={cam}
              detections={cameraDetections}
              streamUrl={cameraView?.source.kind === "mjpeg"
                ? cameraView.source.url : undefined}
              noStream={cameraView?.source.kind === "none"}
            />
            {/* 영상이 안 들어오는데 LIVE 가 떠 있으면 화면이 거짓말을 한다 */}
            {cameraView?.source.kind === "mjpeg" && <div className="live-badge">LIVE</div>}
            <div className="cctv-meta">
              {currentCam.label} · {currentCam.loc}
            </div>
            <CCTVClock />
          </div>
          <div style={{ marginTop: 7 }}>
            <div className="section-label" style={{ marginTop: 0 }}>감지 알림</div>
            {latestIn && (
              <AlertCard type="in" plate={latestIn.plate} cam={latestIn.spot}
                         time={formatHM(latestIn.at)} />
            )}
            {latestOut && (
              <AlertCard type="out" plate={latestOut.plate} cam={latestOut.spot}
                         time={formatHM(latestOut.at)} />
            )}
            {!latestIn && !latestOut && (
              <div className="muted" style={{ fontSize: 11, padding: "6px 2px" }}>
                최근 감지 없음
              </div>
            )}
          </div>
        </Panel>

        {/* ─── 우측: 출입차 기록 (col 4, rows 1-2) ─────────────────── */}
        <Panel title="출입차 기록" style={{ gridColumn: "4 / 5", gridRow: "1 / 3" }}>
          <div style={{ overflowY: "auto", maxHeight: 500 }}>
            {parkingEvents.length === 0 ? (
              <div className="muted" style={{ fontSize: 11, padding: "8px 2px" }}>
                입출차 기록이 없습니다
              </div>
            ) : (
              parkingEvents.map((e, i) => (
                <RecordItem
                  key={`${e.plate}-${e.type}-${e.at.getTime()}-${i}`}
                  plate={e.plate}
                  time={formatHM(e.at)}
                  type={e.type}
                />
              ))
            )}
          </div>
        </Panel>

        {/* ─── 하단 좌: 차량 선택 (col 2, row 2) ───────────────────── */}
        <Panel title="차량 선택" style={{ gridColumn: "2 / 3", gridRow: "2 / 3" }}>
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

        {/* ─── 하단 우: 차량 추적 (col 3, row 2) ───────────────────── */}
        <Panel style={{ gridColumn: "3 / 4", gridRow: "2 / 3" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%" }}>
            <div className="ptitle">차량 추적</div>
            <div className="track-info" style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div className="track-info-label">추적 중</div>
              <div className="track-info-plate">{trackedPlate}</div>
              <div className="track-info-loc">{trackedLoc}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
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
        </Panel>
      </div>
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

