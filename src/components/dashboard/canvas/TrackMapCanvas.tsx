import { useEffect, useRef } from "react";
import { rr } from "./canvas-utils";

interface TrackMapCanvasProps {
  /** 추적 중인 차량이 도달한 스팟 인덱스 (0..3 = A1..A4) — default 0 (A1) */
  highlightSpotIndex?: number;
  width?: number;
  height?: number;
  /**
   * row+index로 A/B열 모두 지정 (기능 #1에서 추가).
   * 지정되면 highlightSpotIndex보다 우선한다. 미지정이면 기존 동작 유지.
   */
  highlightSpot?: { row: "A" | "B"; index: number };
}

/**
 * 차량 추적 미니맵 — 풀 사이즈 ParkingMap의 축소판.
 * 시작점에서 목표 스팟까지의 경로를 점선으로, 끝점에서 펄스 애니메이션.
 */
export function TrackMapCanvas({
  highlightSpotIndex = 0,
  highlightSpot,
  width = 140,
  height = 150,
}: TrackMapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let rafId = 0;
    // 새 prop이 우선. 미지정 시 기존 동작(A행 highlightSpotIndex) 유지.
    const effectiveRow: "A" | "B" = highlightSpot?.row ?? "A";
    const effectiveIndex = highlightSpot?.index ?? highlightSpotIndex;

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const W = canvas.width;
      const H = canvas.height;

      ctx.fillStyle = "#111214";
      ctx.fillRect(0, 0, W, H);

      const roadW = 22;
      const pad2 = 8;
      const midY = H / 2;

      ctx.fillStyle = "#1a1d22";
      ctx.fillRect(pad2, pad2, roadW, H - pad2 * 2);
      ctx.fillRect(pad2, midY - roadW / 2, W - pad2 * 2, roadW);

      ctx.strokeStyle = "#f5d02060";
      ctx.lineWidth = 0.8;
      ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(pad2 + roadW / 2, pad2 + 6); ctx.lineTo(pad2 + roadW / 2, midY - roadW / 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pad2 + roadW / 2, midY + roadW / 2); ctx.lineTo(pad2 + roadW / 2, H - pad2 - 6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pad2 + roadW + 4, midY); ctx.lineTo(W - pad2 - 4, midY); ctx.stroke();
      ctx.setLineDash([]);

      const sw = (W - pad2 - roadW - pad2 - 6) / 4;
      const sh = 18;

      // 물리 배치: A행 = 하단 / B행 = 상단
      // (backend services.py의 _A_Y/_B_Y 스왑에 맞춤)

      // A row (bottom)
      for (let i = 0; i < 4; i++) {
        const sx = pad2 + roadW + 2 + i * (sw + 2);
        const isHighlighted = effectiveRow === "A" && i === effectiveIndex;
        ctx.fillStyle = isHighlighted ? "#1e2e1e" : "#1e2025";
        rr(ctx, sx, H - pad2 - sh, sw, sh, 2); ctx.fill();
        ctx.strokeStyle = isHighlighted ? "#4ade80" : "#2c2f36";
        ctx.lineWidth = 0.5;
        rr(ctx, sx, H - pad2 - sh, sw, sh, 2); ctx.stroke();
        ctx.fillStyle = "#4b5563";
        ctx.font = "7px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`A${i + 1}`, sx + sw / 2, H - pad2 - sh / 2 + 3);
      }

      // B row (top)
      for (let i = 0; i < 4; i++) {
        const sx = pad2 + roadW + 2 + i * (sw + 2);
        const isHighlighted = effectiveRow === "B" && i === effectiveIndex;
        ctx.fillStyle = isHighlighted ? "#1e2e1e" : "#1e2025";
        rr(ctx, sx, pad2, sw, sh, 2); ctx.fill();
        ctx.strokeStyle = isHighlighted ? "#4ade80" : "#2c2f36";
        ctx.lineWidth = 0.5;
        rr(ctx, sx, pad2, sw, sh, 2); ctx.stroke();
        ctx.fillStyle = "#4b5563";
        ctx.font = "7px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`B${i + 1}`, sx + sw / 2, pad2 + sh / 2 + 3);
      }
      ctx.textAlign = "left";

      // Track path (entry → aisle → spot) — A/B 행 모두 지원
      // A는 하단(y = H - pad2 - sh), B는 상단(y = pad2 + sh)
      const targetX = pad2 + roadW + 2 + effectiveIndex * (sw + 2) + sw / 2;
      const targetY = effectiveRow === "A" ? H - pad2 - sh : pad2 + sh;
      const path = [
        { x: pad2 + roadW / 2, y: H - pad2 - 10 },
        { x: pad2 + roadW / 2, y: midY },
        { x: targetX, y: midY },
        { x: targetX, y: targetY },
      ];
      ctx.strokeStyle = "#6b7280"; ctx.lineWidth = 1.5; ctx.setLineDash([5, 3]);
      ctx.beginPath();
      path.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
      ctx.setLineDash([]);

      // Start dot
      ctx.fillStyle = "#f87171";
      ctx.beginPath(); ctx.arc(path[0].x, path[0].y, 3, 0, Math.PI * 2); ctx.fill();

      // Pulse at target
      const t2 = Date.now() / 1000;
      const pulse = 0.65 + Math.sin(t2 * 3) * 0.35;
      ctx.fillStyle = "#4ade80";
      ctx.globalAlpha = pulse;
      ctx.beginPath(); ctx.arc(path[3].x, path[3].y, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#4ade80"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(path[3].x, path[3].y, 6, 0, Math.PI * 2); ctx.stroke();

      rafId = requestAnimationFrame(draw);
    };
    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [highlightSpotIndex, highlightSpot?.row, highlightSpot?.index, width, height]);

  return <canvas ref={canvasRef} style={{ borderRadius: 8, background: "#111214" }} />;
}
