import { useEffect, useRef } from "react";
import { drawCar, fitCanvasToParent, rr } from "./canvas-utils";

export type SpotStatus = "parked" | "empty" | "entering" | "exiting";

export interface SpotData {
  id: string;            // A1, A2, ..., B4
  status: SpotStatus;
  plate?: string;
}

interface ParkingMapCanvasProps {
  spots: SpotData[];
  /** 캔버스 높이/너비 비율 (default 0.62) */
  ratio?: number;
}

const SPOT_COLORS: Record<SpotStatus, { fill: string; border: string; car: string | null }> = {
  parked:   { fill: "#1e2025", border: "#2c2f36", car: "#3f4451" },
  empty:    { fill: "#161719", border: "#222428", car: null },
  entering: { fill: "#0d1f12", border: "#4ade80", car: "#4ade80" },
  exiting:  { fill: "#1f0d0d", border: "#f87171", car: "#f87171" },
};

/**
 * 주차장 전체 플로우 — `ㅏ`자 도로 + A열(상단) / B열(하단) 8개 주차칸
 * + 입구(아래)·출구(위) 화살표 + 애니메이션 차량 2대
 *
 * 첨부 디자인 HTML의 drawParkMap 로직을 그대로 TS 컴포넌트로 옮겼다.
 * spotData만 props로 받으므로 백엔드 ParkingSpot[]을 SpotData[]로 매핑해 넣으면 된다.
 */
export function ParkingMapCanvas({ spots, ratio = 0.62 }: ParkingMapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let rafId = 0;
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { W, H } = fitCanvasToParent(canvas, ratio);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Background
      ctx.fillStyle = "#111214";
      rr(ctx, 0, 0, W, H, 8);
      ctx.fill();

      // Dimensions
      const roadW = Math.round(W * 0.18);
      const roadH = Math.round(H * 0.22);
      const pad = 10;
      const midY = Math.round(H * 0.5);
      const hRoadTop = midY - roadH / 2;
      const hRoadBot = midY + roadH / 2;
      const vRoadLeft = pad;
      const vRoadRight = pad + roadW;

      // Roads
      ctx.fillStyle = "#1a1d22";
      ctx.fillRect(vRoadLeft, pad, roadW, H - pad * 2);
      ctx.fillRect(vRoadLeft, hRoadTop, W - pad - vRoadLeft, roadH);

      ctx.strokeStyle = "#2c2f36";
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(vRoadLeft, pad); ctx.lineTo(vRoadLeft, H - pad); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(vRoadRight, pad); ctx.lineTo(vRoadRight, hRoadTop); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(vRoadRight, hRoadBot); ctx.lineTo(vRoadRight, H - pad); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(vRoadRight, hRoadTop); ctx.lineTo(W - pad, hRoadTop); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(vRoadRight, hRoadBot); ctx.lineTo(W - pad, hRoadBot); ctx.stroke();

      // Center dashes (yellow)
      ctx.strokeStyle = "#f5d020";
      ctx.lineWidth = 1;
      ctx.setLineDash([8, 6]);
      const vCx = vRoadLeft + roadW / 2;
      ctx.beginPath(); ctx.moveTo(vCx, pad + 8); ctx.lineTo(vCx, hRoadTop); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(vCx, hRoadBot); ctx.lineTo(vCx, H - pad - 8); ctx.stroke();
      const hCy = midY;
      ctx.beginPath(); ctx.moveTo(vRoadRight + 8, hCy); ctx.lineTo(W - pad - 8, hCy); ctx.stroke();
      ctx.setLineDash([]);

      // Spots layout
      const spotAreaW = W - pad - vRoadRight;
      const spotW = Math.floor((spotAreaW - 5 * 4) / 4);
      const spotY_A = pad + 16;

      const drawSpot = (s: SpotData, sx: number, sy: number, sh: number, labelOnTop: boolean) => {
        const sc = SPOT_COLORS[s.status];
        ctx.fillStyle = sc.fill;
        rr(ctx, sx, sy, spotW, sh, 5);
        ctx.fill();
        ctx.strokeStyle = sc.border;
        ctx.lineWidth = s.status === "entering" || s.status === "exiting" ? 1.5 : 0.5;
        rr(ctx, sx, sy, spotW, sh, 5);
        ctx.stroke();

        // Label
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

      // A row (top, label on top)
      for (let i = 0; i < 4; i++) {
        const s = spots[i] ?? { id: `A${i + 1}`, status: "empty" as SpotStatus };
        const sx = vRoadRight + 4 + i * (spotW + 4);
        const sy = spotY_A;
        const sh = hRoadTop - spotY_A;
        drawSpot(s, sx, sy, sh, true);

        if (i > 0) {
          ctx.strokeStyle = "#f5d020";
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy + sh); ctx.stroke();
        }
      }

      // B row (bottom, label on bottom)
      for (let i = 0; i < 4; i++) {
        const s = spots[4 + i] ?? { id: `B${i + 1}`, status: "empty" as SpotStatus };
        const sx = vRoadRight + 4 + i * (spotW + 4);
        const sy = hRoadBot;
        const sh = H - pad - hRoadBot - 16;
        drawSpot(s, sx, sy, sh, false);

        if (i > 0) {
          ctx.strokeStyle = "#f5d020";
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy + sh); ctx.stroke();
        }
      }
      ctx.textAlign = "left";

      // Entrance (bottom)
      ctx.fillStyle = "#4ade80";
      ctx.font = "bold 8px sans-serif";
      ctx.fillText("입구", vRoadLeft + 2, H - pad - 2);
      ctx.strokeStyle = "#4ade80";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(vCx, H - pad - 14); ctx.lineTo(vCx, hRoadBot + 8); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(vCx - 4, hRoadBot + 14);
      ctx.lineTo(vCx, hRoadBot + 6);
      ctx.lineTo(vCx + 4, hRoadBot + 14);
      ctx.stroke();

      // Exit (top)
      ctx.fillStyle = "#f87171";
      ctx.font = "bold 8px sans-serif";
      ctx.fillText("출구", vRoadLeft + 2, pad + 10);
      ctx.strokeStyle = "#f87171";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(vCx, pad + 14); ctx.lineTo(vCx, hRoadTop - 8); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(vCx - 4, pad + 14);
      ctx.lineTo(vCx, pad + 6);
      ctx.lineTo(vCx + 4, pad + 14);
      ctx.stroke();

      // Direction arrows on horizontal road
      ctx.fillStyle = "#3f4451";
      for (let ax = vRoadRight + 20; ax < W - pad - 40; ax += 60) {
        ctx.strokeStyle = "#3f4451";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(ax, hCy); ctx.lineTo(ax + 30, hCy); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ax + 26, hCy - 3);
        ctx.lineTo(ax + 30, hCy);
        ctx.lineTo(ax + 26, hCy + 3);
        ctx.closePath();
        ctx.fill();
      }

      // Animated cars
      const t = Date.now() / 1000;
      const hCarX = vRoadRight + 20 + ((t * 40) % (W - pad - vRoadRight - 60));
      drawCar(ctx, hCarX, hCy - 6, "#9ca3af", 18, 10);

      const vProgress = (t * 0.15) % 1;
      if (vProgress > 0.05 && vProgress < 0.7) {
        const vy = H - pad - 20 - vProgress * (H - pad - hRoadBot - 20);
        drawCar(ctx, vCx, vy, "#4ade80", 12, 8);
      }

      rafId = requestAnimationFrame(draw);
    };
    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [spots, ratio]);

  return <canvas ref={canvasRef} style={{ width: "100%", display: "block", borderRadius: 8 }} />;
}
