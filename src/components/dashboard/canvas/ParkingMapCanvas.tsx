import { useEffect, useRef } from "react";
import type { ParkingSpot } from "../../../types";
import type { TrackedVehicle, VehicleRoute } from "../../../types/cv";
import { drawCar, fitCanvasToParent, rr } from "./canvas-utils";

// ─── 백엔드 좌표계 상수 (services.py와 1:1 매칭) ─────────────────────────
// backend/parking/services.py:
//   ENTRY_POINT = (150.0, 0.0)      좌측 도로 하단
//   EXIT_POINT  = (150.0, 1200.0)   좌측 도로 상단
//   AISLE_Y     = 600.0             중앙 주행로 y
// 주차면 크기 200x300mm, 라인 25mm, 주행로 550mm (services.py 주석 기준).
const ENTRY = { x: 150, y: 0 };
const EXIT = { x: 150, y: 1200 };
const AISLE_Y = 600;
const AISLE_HALF = 275; // 주행로 절반 폭 (mm)
const ROAD_HALF = 150;  // 좌측 도로 절반 폭 (mm) — ENTRY.x 중심
const SPOT_MM = { w: 200, h: 300 };
const CAR_MM = { l: 250, w: 150 };  // 표시용 차량 크기 (실측 표시 목적, 대략)

// ─── SpotData (호환) ────────────────────────────────────────────────────
// 기존 호출자가 status 기반의 표시 정보(id, status, plate)로 넘기던 형식은 유지.
// 새로 spot의 실좌표를 사용하려면 spots(ParkingSpot[]) prop을 넘기면 된다.
export type SpotStatus = "parked" | "empty" | "entering" | "exiting";
export interface SpotData {
  id: string;
  status: SpotStatus;
  plate?: string;
}

interface ParkingMapCanvasProps {
  /** 백엔드 응답의 ParkingSpot[] — coord_x/coord_y (mm) 실측. 지정되면 이걸 우선 사용. */
  spots?: ParkingSpot[];
  /** 백엔드 lot dimensions (mm). 지정되면 실측 스케일링 모드. */
  lot?: { width: number; height: number };
  /** 각 spot의 표시 상태(색상)를 위한 보조 데이터. spot_id → status 매핑. */
  spotStatus?: Record<number, SpotStatus>;
  /** 각 spot에 표시할 차량 plate. spot_id → plate 매핑. */
  spotPlates?: Record<number, string>;
  /** 실시간 차량 오버레이 (다음 사이클 telemetry 연결용). 없으면 미표시. */
  vehicles?: TrackedVehicle[];
  /** 배정된 슬롯까지의 계획 경로. 차량이 어디로 갈지 보여준다. */
  routes?: VehicleRoute[];

  /** === legacy 호환 (실측 데이터 없을 때 하드코딩 배치로 폴백) ============ */
  legacySpots?: SpotData[];
  ratio?: number;
}

const STATUS_COLORS: Record<SpotStatus, { fill: string; border: string; car: string | null }> = {
  parked:   { fill: "#1e2025", border: "#2c2f36", car: "#3f4451" },
  empty:    { fill: "#161719", border: "#222428", car: null },
  entering: { fill: "#0d1f12", border: "#4ade80", car: "#4ade80" },
  exiting:  { fill: "#1f0d0d", border: "#f87171", car: "#f87171" },
};

/**
 * 주차장 실측 좌표 기반 렌더러.
 *
 * 백엔드가 요청한 스펙(SpotMap 스케일):
 *   - lot_width/lot_height (mm) 를 캔버스 크기에 정확히 매핑
 *   - 각 spot을 spot.coord_x/coord_y 실측 좌표에 배치
 *   - 도로/입출구도 backend services.py 상수 그대로
 *
 * 이렇게 하면 vehicle.telemetry의 pos(mm)를 그대로 얹기만 하면 되므로
 * 실시간 차량 표시(다음 사이클)에 좌표 변환 이슈가 없다.
 *
 * legacy(하드코딩 8칸) 모드는 lot/spots 미지정 시 폴백으로 유지.
 */
export function ParkingMapCanvas({
  spots,
  lot,
  spotStatus,
  spotPlates,
  vehicles,
  routes,
  legacySpots,
  ratio,
}: ParkingMapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let rafId = 0;
    const useReal = !!lot && !!spots && spots.length > 0;
    const effectiveRatio = ratio ?? (useReal ? lot!.height / lot!.width : 0.62);

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { W, H } = fitCanvasToParent(canvas, effectiveRatio);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // 배경
      ctx.fillStyle = "#111214";
      rr(ctx, 0, 0, W, H, 8);
      ctx.fill();

      if (useReal) {
        drawRealScale(ctx, W, H, lot!, spots!, spotStatus, spotPlates, vehicles, routes);
      } else {
        drawLegacy(ctx, W, H, legacySpots ?? []);
      }

      rafId = requestAnimationFrame(draw);
    };
    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [spots, lot, spotStatus, spotPlates, vehicles, routes, legacySpots, ratio]);

  return <canvas ref={canvasRef} style={{ width: "100%", display: "block", borderRadius: 8 }} />;
}

// ─────────────────────────────────────────────────────────────────────────
// 실측 좌표 렌더러 — 좌표계: 백엔드 mm → 캔버스 px
// ─────────────────────────────────────────────────────────────────────────
function drawRealScale(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  lot: { width: number; height: number },
  spots: ParkingSpot[],
  spotStatus: Record<number, SpotStatus> | undefined,
  spotPlates: Record<number, string> | undefined,
  vehicles: TrackedVehicle[] | undefined,
  routes: VehicleRoute[] | undefined,
) {
  const pad = 12;
  const innerW = W - pad * 2;
  const innerH = H - pad * 2;
  // 종횡비 유지 스케일 (letterbox)
  const scale = Math.min(innerW / lot.width, innerH / lot.height);
  const offX = pad + (innerW - lot.width * scale) / 2;
  const offY = pad + (innerH - lot.height * scale) / 2;

  // 백엔드 좌표계는 y가 위로 증가(하단 = 0). 캔버스는 y가 아래로 증가.
  // → mm → px 변환에서 y 뒤집기.
  const mmToPx = (mx: number, my: number) => ({
    x: offX + mx * scale,
    y: offY + (lot.height - my) * scale,
  });
  const mmSize = (n: number) => n * scale;

  // ── 좌측 도로 (ENTRY.x ± ROAD_HALF, 세로 풀) ─────────────────────────
  const roadLeft = mmToPx(ENTRY.x - ROAD_HALF, lot.height);
  const roadRight = mmToPx(ENTRY.x + ROAD_HALF, 0);
  ctx.fillStyle = "#1a1d22";
  ctx.fillRect(roadLeft.x, roadLeft.y, roadRight.x - roadLeft.x, roadRight.y - roadLeft.y);

  // ── 중앙 주행로 (AISLE_Y ± AISLE_HALF, 가로 풀) ──────────────────────
  const aisleTL = mmToPx(0, AISLE_Y + AISLE_HALF);
  const aisleBR = mmToPx(lot.width, AISLE_Y - AISLE_HALF);
  ctx.fillStyle = "#1a1d22";
  ctx.fillRect(aisleTL.x, aisleTL.y, aisleBR.x - aisleTL.x, aisleBR.y - aisleTL.y);

  // ── 노란 중앙선 (점선) ────────────────────────────────────────────────
  ctx.strokeStyle = "#f5d020";
  ctx.lineWidth = 1;
  ctx.setLineDash([8, 6]);
  const vCenter = mmToPx(ENTRY.x, 0);
  const vTop = mmToPx(ENTRY.x, lot.height);
  const aisleTop = mmToPx(ENTRY.x, AISLE_Y + AISLE_HALF);
  const aisleBot = mmToPx(ENTRY.x, AISLE_Y - AISLE_HALF);
  ctx.beginPath();
  ctx.moveTo(vCenter.x, vCenter.y - 8);
  ctx.lineTo(vCenter.x, aisleBot.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(vTop.x, vTop.y + 8);
  ctx.lineTo(vTop.x, aisleTop.y);
  ctx.stroke();
  const hL = mmToPx(ENTRY.x + ROAD_HALF, AISLE_Y);
  const hR = mmToPx(lot.width, AISLE_Y);
  ctx.beginPath();
  ctx.moveTo(hL.x + 8, hL.y);
  ctx.lineTo(hR.x - 8, hR.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // ── 각 spot ──────────────────────────────────────────────────────────
  const spotW = mmSize(SPOT_MM.w);
  const spotH = mmSize(SPOT_MM.h);
  for (const s of spots) {
    const c = mmToPx(s.coord_x, s.coord_y);
    const status: SpotStatus = spotStatus?.[s.spot_id] ??
      (s.status === "occupied" ? "parked" : "empty");
    const sc = STATUS_COLORS[status];
    const x = c.x - spotW / 2;
    const y = c.y - spotH / 2;

    ctx.fillStyle = sc.fill;
    rr(ctx, x, y, spotW, spotH, 5);
    ctx.fill();
    ctx.strokeStyle = sc.border;
    ctx.lineWidth = status === "entering" || status === "exiting" ? 1.6 : 0.6;
    rr(ctx, x, y, spotW, spotH, 5);
    ctx.stroke();

    // 라벨 (section) - 작게, 상단
    ctx.fillStyle = "#6b7280";
    ctx.font = `${Math.max(8, Math.min(11, spotW * 0.13))}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(s.section, c.x, y + 3);
    ctx.textBaseline = "alphabetic";

    // 주차 차량 표시
    if (sc.car) {
      drawCar(ctx, c.x, c.y, sc.car, Math.min(spotW * 0.7, mmSize(CAR_MM.w)), Math.min(spotH * 0.55, mmSize(CAR_MM.l)));
      const plate = spotPlates?.[s.spot_id];
      if (plate) {
        ctx.fillStyle = status === "parked" ? "#4b5563" : "#d1d5db";
        ctx.font = `${Math.max(7, Math.min(9, spotW * 0.11))}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(plate, c.x, y + spotH - 4);
      }
    }
  }
  ctx.textAlign = "left";

  // ── ENTRY / EXIT 마커 ────────────────────────────────────────────────
  const entryPx = mmToPx(ENTRY.x, ENTRY.y);
  ctx.fillStyle = "#4ade80";
  ctx.font = "bold 9px sans-serif";
  ctx.fillText("입구", entryPx.x - 30, entryPx.y - 4);
  ctx.strokeStyle = "#4ade80";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(entryPx.x, entryPx.y - 14);
  ctx.lineTo(entryPx.x, aisleBot.y + 8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(entryPx.x - 4, aisleBot.y + 14);
  ctx.lineTo(entryPx.x, aisleBot.y + 6);
  ctx.lineTo(entryPx.x + 4, aisleBot.y + 14);
  ctx.stroke();

  const exitPx = mmToPx(EXIT.x, EXIT.y);
  ctx.fillStyle = "#f87171";
  ctx.font = "bold 9px sans-serif";
  ctx.fillText("출구", exitPx.x - 30, exitPx.y + 12);
  ctx.strokeStyle = "#f87171";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(exitPx.x, exitPx.y + 14);
  ctx.lineTo(exitPx.x, aisleTop.y - 8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(exitPx.x - 4, exitPx.y + 14);
  ctx.lineTo(exitPx.x, exitPx.y + 6);
  ctx.lineTo(exitPx.x + 4, exitPx.y + 14);
  ctx.stroke();

  // ── 계획 경로 ────────────────────────────────────────────────────────
  // 차량보다 먼저 그린다 — 나중에 그리면 선이 차량을 덮어 위치를 가린다.
  if (routes && routes.length > 0) {
    for (const r of routes) {
      const pts = r.waypoints.map((w) => mmToPx(w.x, w.y));
      if (pts.length < 2) continue;
      ctx.save();
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.setLineDash([]);
      // 경유점 — 마지막 점(인계 지점)만 크게. 거기서 HW 주차 동작이 시작된다.
      pts.forEach((p, i) => {
        const last = i === pts.length - 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, last ? 3.5 : 1.8, 0, Math.PI * 2);
        ctx.fillStyle = last ? "#f472b6" : "#38bdf8";
        ctx.fill();
      });
      const end = pts[pts.length - 1];
      if (r.slot) {
        ctx.fillStyle = "#f472b6";
        ctx.font = "9px ui-monospace";
        ctx.fillText(`→ ${r.slot}`, end.x + 6, end.y - 5);
      }
      ctx.restore();
    }
  }

  // ── 실시간 차량 오버레이 (기능 #10 — vehicle.telemetry 연결) ─────────
  // headingDeg (backend 계약: 0~360°, 우 0°/상 90°) → 라디안. 캔버스 y 뒤집힘 반영.
  //   backend 각도: 반시계 방향 + (수학 표준)
  //   캔버스 rotate: 시계 방향 + (y 아래로 증가)
  //   → rotate 각도 = -radian
  if (vehicles && vehicles.length > 0) {
    const carW = mmSize(CAR_MM.w);
    const carL = mmSize(CAR_MM.l);
    for (const v of vehicles) {
      const p = mmToPx(v.position.x, v.position.y);
      const angle = typeof v.headingDeg === "number" ? -(v.headingDeg * Math.PI) / 180 : 0;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(angle);
      // 몸체 — pose 가 끊긴 차량은 흐리게 그려 "지금 값이 아님"을 드러낸다.
      if (v.stale) ctx.globalAlpha = 0.35;
      // 바인딩 전 차량은 회색 + 점선 테두리. 카메라는 보고 있지만 아직 제어
      // 대상이 아니라는 뜻이라, 주행 중인 차와 한눈에 구분돼야 한다.
      const unbound = v.bound === false;
      if (unbound) ctx.setLineDash([3, 2]);
      ctx.fillStyle = unbound ? "#6b7280" : "#facc15";
      ctx.strokeStyle = "#0d1117";
      ctx.lineWidth = 1.2;
      rr(ctx, -carL / 2, -carW / 2, carL, carW, 3);
      ctx.fill();
      ctx.stroke();
      // 헤드라이트 (전방 = +x)
      ctx.fillStyle = "#fff7c2";
      ctx.fillRect(carL / 2 - 3, -carW / 2 + 1.5, 2, 2);
      ctx.fillRect(carL / 2 - 3, carW / 2 - 3.5, 2, 2);
      ctx.setLineDash([]);
      ctx.restore();

      // 라벨 (plate + parkingPhase 뱃지)
      const labelY = p.y - 6;
      if (v.plate) {
        ctx.fillStyle = "#e6edf3";
        ctx.font = "9px ui-monospace";
        ctx.fillText(v.plate, p.x + carL / 2 + 4, labelY);
      }
      if (v.parkingPhase) {
        ctx.fillStyle = "#9ca3af";
        ctx.font = "8px ui-monospace";
        ctx.fillText(v.parkingPhase, p.x + carL / 2 + 4, labelY + 10);
      }
      if (unbound) {
        ctx.fillStyle = "#9ca3af";
        ctx.font = "8px ui-monospace";
        ctx.fillText("미바인딩", p.x + carL / 2 + 4, labelY + 10);
      }
      // heading 출처 — FRONT_CUSHION 이면 초록, 과거값으로 버티는 중이면 주황.
      // 마커 인식이 끊기는 순간을 화면에서 바로 알아채기 위한 표시다.
      if (v.headingSource) {
        ctx.fillStyle = v.headingSource === "FRONT_CUSHION" ? "#4ade80" : "#fb923c";
        ctx.font = "8px ui-monospace";
        ctx.fillText(v.headingSource, p.x + carL / 2 + 4, labelY + 20);
      }
      if (v.stale) {
        ctx.fillStyle = "#f87171";
        ctx.font = "8px ui-monospace";
        ctx.fillText("STALE", p.x + carL / 2 + 4, labelY + 30);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Legacy 렌더러 — 하드코딩 ㅏ자 도로 + 8칸 (lot 미지정 시 폴백)
// ─────────────────────────────────────────────────────────────────────────
function drawLegacy(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  spots: SpotData[],
) {
  const roadW = Math.round(W * 0.18);
  const roadH = Math.round(H * 0.22);
  const pad = 10;
  const midY = Math.round(H * 0.5);
  const hRoadTop = midY - roadH / 2;
  const hRoadBot = midY + roadH / 2;
  const vRoadLeft = pad;
  const vRoadRight = pad + roadW;

  ctx.fillStyle = "#1a1d22";
  ctx.fillRect(vRoadLeft, pad, roadW, H - pad * 2);
  ctx.fillRect(vRoadLeft, hRoadTop, W - pad - vRoadLeft, roadH);

  ctx.strokeStyle = "#f5d020";
  ctx.lineWidth = 1;
  ctx.setLineDash([8, 6]);
  const vCx = vRoadLeft + roadW / 2;
  ctx.beginPath();
  ctx.moveTo(vCx, pad + 8);
  ctx.lineTo(vCx, hRoadTop);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(vCx, hRoadBot);
  ctx.lineTo(vCx, H - pad - 8);
  ctx.stroke();
  const hCy = midY;
  ctx.beginPath();
  ctx.moveTo(vRoadRight + 8, hCy);
  ctx.lineTo(W - pad - 8, hCy);
  ctx.stroke();
  ctx.setLineDash([]);

  const spotAreaW = W - pad - vRoadRight;
  const spotW = Math.floor((spotAreaW - 5 * 4) / 4);
  const spotY_A = pad + 16;

  const drawSpot = (s: SpotData, sx: number, sy: number, sh: number, labelOnTop: boolean) => {
    const sc = STATUS_COLORS[s.status];
    ctx.fillStyle = sc.fill;
    rr(ctx, sx, sy, spotW, sh, 5);
    ctx.fill();
    ctx.strokeStyle = sc.border;
    ctx.lineWidth = s.status === "entering" || s.status === "exiting" ? 1.5 : 0.5;
    rr(ctx, sx, sy, spotW, sh, 5);
    ctx.stroke();
    ctx.fillStyle = "#6b7280";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(s.id, sx + spotW / 2, labelOnTop ? sy + 10 : sy + sh - 2);
    if (sc.car) {
      drawCar(ctx, sx + spotW / 2, sy + sh / 2, sc.car, Math.min(spotW * 0.5, 24), Math.min(sh * 0.35, 14));
      if (s.plate) {
        ctx.fillStyle = s.status === "parked" ? "#4b5563" : "#d1d5db";
        ctx.font = "7px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(s.plate, sx + spotW / 2, labelOnTop ? sy + sh - 6 : sy + 8);
      }
    }
  };

  for (let i = 0; i < 4; i++) {
    const s = spots[i] ?? { id: `A${i + 1}`, status: "empty" as SpotStatus };
    const sx = vRoadRight + 4 + i * (spotW + 4);
    const sy = spotY_A;
    const sh = hRoadTop - spotY_A;
    drawSpot(s, sx, sy, sh, true);
  }
  for (let i = 0; i < 4; i++) {
    const s = spots[4 + i] ?? { id: `B${i + 1}`, status: "empty" as SpotStatus };
    const sx = vRoadRight + 4 + i * (spotW + 4);
    const sy = hRoadBot;
    const sh = H - pad - hRoadBot - 16;
    drawSpot(s, sx, sy, sh, false);
  }
  ctx.textAlign = "left";
}
