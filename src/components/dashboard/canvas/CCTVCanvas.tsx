import { VideoOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Detection } from "../../../types/cv";
import { fitCanvasToParent, pad, rr } from "./canvas-utils";

interface CCTVCanvasProps {
  camId: number;
  /** 영상 비율(높이/너비) — default 0.54 */
  ratio?: number;
  /**
   * 기존 단일 detection (호환용).
   * 기존 호출자(default mock 표시)를 위해 유지하지만, 미래에는 detections를 권장.
   */
  detection?: { label: string; plate: string; confidence: number } | null;
  /**
   * 정규화 bbox 기반 detection 배열 (기능 #2에서 추가).
   * 지정되면 detection prop과 무관하게 이 배열을 그린다.
   * 빈 배열이면 bbox 자체 표시 없음.
   */
  detections?: Detection[];
  /**
   * MJPEG 스트림 URL. 주면 시뮬레이션 대신 실제 영상을 띄운다.
   * 스트림이 안 열리면(파이프라인 미실행 등) 시뮬레이션으로 폴백한다 —
   * 화면이 검게 죽는 것보다 낫고, 무엇이 안 도는지도 배지로 알려준다.
   */
  streamUrl?: string;
  /**
   * 카메라는 등록됐는데 지금 들어오는 영상이 없는 상태.
   * 시뮬레이션으로 채우면 없는 영상을 있는 것처럼 보여주게 되므로 안내만 띄운다.
   */
  noStream?: boolean;
}

/**
 * "CCTV 실시간" 패널 영상부. YOLO 객체 인식 시뮬레이션(코너 브래킷 + 라벨 + plate).
 * 추후 실제 백엔드에서 mjpeg/hls 영상 + bbox 좌표를 받게 되면
 * 이 컴포넌트의 background drawing 부분을 <video>로 교체하고 bbox만 overlay로 남기면 된다.
 */
export function CCTVCanvas({
  camId,
  ratio = 0.54,
  detection = { label: "CAR", plate: "12가 3456", confidence: 0.97 },
  detections,
  streamUrl,
  noStream = false,
}: CCTVCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // 스트림 재시도용. 백엔드는 파이프라인이 멈추면 스트림을 끝내므로,
  // 실패해도 계속 다시 붙어야 파이프라인 재시작이 화면에 반영된다.
  const [attempt, setAttempt] = useState(0);
  const [streamDead, setStreamDead] = useState(false);

  useEffect(() => {
    // camId 가 바뀌면 폴백 상태를 초기화한다.
    setStreamDead(false);
    setAttempt(0);
  }, [camId, streamUrl]);

  useEffect(() => {
    let rafId = 0;

    const staticCars = [
      { x: 0.22, y: 0.72, w: 0.13, h: 0.18, col: "#3a3a3a" },
      { x: 0.40, y: 0.72, w: 0.14, h: 0.18, col: "#2e3540" },
      { x: 0.58, y: 0.72, w: 0.12, h: 0.18, col: "#3d3020" },
      { x: 0.75, y: 0.72, w: 0.13, h: 0.18, col: "#1e2a2a" },
      { x: 0.20, y: 0.18, w: 0.11, h: 0.15, col: "#2a2a3a" },
      { x: 0.37, y: 0.16, w: 0.13, h: 0.16, col: "#30201a" },
      { x: 0.72, y: 0.18, w: 0.12, h: 0.15, col: "#2a3530" },
    ];

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { W, H } = fitCanvasToParent(canvas, ratio);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Concrete background — perspective
      ctx.fillStyle = "#181c1f"; ctx.fillRect(0, 0, W, H * 0.4);
      ctx.fillStyle = "#1e2226"; ctx.fillRect(0, H * 0.4, W, H * 0.25);
      ctx.fillStyle = "#22272c"; ctx.fillRect(0, H * 0.65, W, H * 0.35);

      // Perspective lines
      const vp = { x: W / 2, y: H * 0.48 };
      ctx.strokeStyle = "#2a3038"; ctx.lineWidth = 0.7;
      [0, W * 0.25, W * 0.5, W * 0.75, W].forEach((px) => {
        ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(vp.x, vp.y); ctx.stroke();
      });
      [0, W * 0.2, W * 0.4, W * 0.6, W * 0.8, W].forEach((px) => {
        ctx.beginPath(); ctx.moveTo(px, H); ctx.lineTo(vp.x, vp.y); ctx.stroke();
      });

      ctx.strokeStyle = "#2c3240"; ctx.lineWidth = 0.5;
      [0.35, 0.45, 0.55, 0.65].forEach((fy) => {
        ctx.beginPath(); ctx.moveTo(0, H * fy); ctx.lineTo(W, H * fy); ctx.stroke();
      });

      // Parking line markings on floor
      ctx.strokeStyle = "#f5d02030"; ctx.lineWidth = 1;
      [0.22, 0.37, 0.52, 0.67, 0.82].forEach((fx) => {
        ctx.beginPath();
        ctx.moveTo(W * fx, H * 0.65);
        const tx = vp.x + (W * fx - vp.x) * 0.3;
        ctx.lineTo(tx, vp.y + 10);
        ctx.stroke();
      });

      // Concrete pillars
      ctx.fillStyle = "#252b32";
      ([[0.12, 0.3, 0.06, 0.5], [0.82, 0.3, 0.06, 0.5]] as const).forEach(([px, py, pw2, ph]) => {
        ctx.fillRect(W * px, H * py, W * pw2, H * ph);
        ctx.strokeStyle = "#1e2329"; ctx.lineWidth = 0.5;
        ctx.strokeRect(W * px, H * py, W * pw2, H * ph);
      });

      // Ceiling lights with flicker
      const t = Date.now() / 1000;
      [0.3, 0.5, 0.7].forEach((fx, i) => {
        const flicker = 1 - Math.max(0, Math.sin(t * 0.3 + i * 2) * 0.05);
        ctx.fillStyle = `rgba(220,230,255,${0.06 * flicker})`;
        ctx.fillRect(W * fx - W * 0.04, 0, W * 0.08, H * 0.04);
        ctx.fillStyle = `rgba(200,210,255,${0.15 * flicker})`;
        ctx.fillRect(W * fx - W * 0.02, H * 0.04, W * 0.04, H * 0.005);
        ctx.fillStyle = `rgba(200,215,255,${0.03 * flicker})`;
        ctx.beginPath();
        ctx.moveTo(W * fx - W * 0.02, H * 0.04);
        ctx.lineTo(W * fx - W * 0.12, H * 0.65);
        ctx.lineTo(W * fx + W * 0.12, H * 0.65);
        ctx.lineTo(W * fx + W * 0.02, H * 0.04);
        ctx.closePath();
        ctx.fill();
      });

      // Static parked cars
      staticCars.forEach((c) => {
        const cx = W * c.x, cy = H * c.y, cw = W * c.w, ch = H * c.h;
        ctx.fillStyle = c.col;
        rr(ctx, cx, cy, cw, ch, 4); ctx.fill();
        ctx.strokeStyle = "#111518"; ctx.lineWidth = 0.5;
        rr(ctx, cx, cy, cw, ch, 4); ctx.stroke();
        ctx.fillStyle = "rgba(120,160,200,0.18)";
        rr(ctx, cx + cw * 0.1, cy + ch * 0.12, cw * 0.8, ch * 0.28, 2); ctx.fill();
        ctx.fillStyle = "rgba(255,240,180,0.4)";
        ctx.fillRect(cx + 2, cy + ch * 0.7, cw * 0.15, ch * 0.12);
        ctx.fillRect(cx + cw - cw * 0.15 - 2, cy + ch * 0.7, cw * 0.15, ch * 0.12);
      });

      // Animated car entering (mid)
      const carProg = (t * 0.08) % 1;
      const acx = W * (0.1 + carProg * 0.55);
      const acy = H * 0.56;
      const acw = W * 0.1 + carProg * W * 0.04;
      const ach = H * 0.1 + carProg * H * 0.04;
      ctx.fillStyle = "#c0c8d0";
      rr(ctx, acx - acw / 2, acy - ach / 2, acw, ach, 4); ctx.fill();
      ctx.strokeStyle = "#888"; ctx.lineWidth = 0.5;
      rr(ctx, acx - acw / 2, acy - ach / 2, acw, ach, 4); ctx.stroke();
      ctx.fillStyle = "rgba(255,245,200,0.7)";
      ctx.fillRect(acx + acw / 2 - 3, acy - ach * 0.2, 3, ach * 0.15);
      ctx.fillRect(acx + acw / 2 - 3, acy + ach * 0.05, 3, ach * 0.15);
      ctx.fillStyle = "rgba(200,220,255,0.04)";
      ctx.fillRect(acx - acw / 2, acy + ach / 2, acw, ach * 0.3);

      // YOLO detection bbox
      // 우선순위: detections 배열 prop > 단일 detection prop (호환용)
      if (detections && detections.length > 0) {
        // 새 인터페이스: 정규화 bbox 기반 다수 detection 렌더
        for (const d of detections) {
          const bx = d.bbox.x * W;
          const by = d.bbox.y * H;
          const bw = d.bbox.width * W;
          const bh = d.bbox.height * H;
          const bl = 8;

          ctx.strokeStyle = "#4ade80"; ctx.lineWidth = 1.5;
          ctx.strokeRect(bx, by, bw, bh);
          ctx.lineWidth = 2;
          const corners: Array<[number, number, number, number]> = [
            [bx, by, 1, 0], [bx, by, 0, 1],
            [bx + bw, by, -1, 0], [bx + bw, by, 0, 1],
            [bx, by + bh, 1, 0], [bx, by + bh, 0, -1],
            [bx + bw, by + bh, -1, 0], [bx + bw, by + bh, 0, -1],
          ];
          corners.forEach(([x, y, dx, dy]) => {
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx * bl, y + dy * bl); ctx.stroke();
          });

          // 라벨 (좌상단)
          ctx.fillStyle = "#4ade80";
          ctx.font = "bold 8px monospace";
          ctx.fillText(`${d.label}  ${Math.round(d.confidence * 100)}%`, bx, by - 3);

          // plate (bbox 중앙 부근)
          if (d.plate) {
            const plateW = Math.max(52, d.plate.length * 5 + 6);
            const plateY = by + bh / 2;
            ctx.fillStyle = "rgba(0,0,0,0.55)";
            ctx.fillRect(bx, plateY - 6, plateW, 12);
            ctx.fillStyle = "#ffffff";
            ctx.font = "7px monospace";
            ctx.fillText(d.plate, bx + 3, plateY + 3);
          }
        }
      } else if (detection) {
        // 기존 호환: animated car 위에 단일 bbox
        const bx = acx - acw / 2 - 4;
        const by = acy - ach / 2 - 4;
        const bw = acw + 8;
        const bh = ach + 8;
        const bl = 8;
        ctx.strokeStyle = "#4ade80"; ctx.lineWidth = 1.5;
        ctx.strokeRect(bx, by, bw, bh);
        ctx.lineWidth = 2;
        ([[bx, by, 1, 0], [bx, by, 0, 1], [bx + bw, by, -1, 0], [bx + bw, by, 0, 1],
          [bx, by + bh, 1, 0], [bx, by + bh, 0, -1], [bx + bw, by + bh, -1, 0], [bx + bw, by + bh, 0, -1]
        ] as const).forEach(([x, y, dx, dy]) => {
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx * bl, y + dy * bl); ctx.stroke();
        });
        ctx.fillStyle = "#4ade80";
        ctx.font = "bold 8px monospace";
        ctx.fillText(`${detection.label}  ${Math.round(detection.confidence * 100)}%`, bx, by - 3);
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(bx, acy - 4, 52, 12);
        ctx.fillStyle = "#ffffff";
        ctx.font = "7px monospace";
        ctx.fillText(detection.plate, bx + 2, acy + 5);
      }

      // Scanlines noise
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);

      // Scan line
      const scanY = (t * 38) % H;
      ctx.fillStyle = "rgba(180,200,220,0.04)";
      ctx.fillRect(0, scanY, W, 2);

      // Vignette
      const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(0,0,0,0.45)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);

      // Timestamp bar
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, H - 20, W, 20);
      ctx.fillStyle = "#6b7280";
      ctx.font = "8px monospace";
      const now = new Date();
      const ts =
        pad(now.getFullYear() % 10000) + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate())
        + " " + pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds());
      ctx.fillText(`●REC  ${ts}  CAM-${pad(camId)}  1080p`, 8, H - 6);

      rafId = requestAnimationFrame(draw);
    };
    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [camId, ratio, detection, detections]);

  if (noStream || (streamUrl && streamDead)) {
    return (
      <div
        style={{ width: "100%", aspectRatio: `1 / ${ratio}`, borderRadius: 8,
                 background: "#0d1117", border: "1px solid #1f2933",
                 display: "flex", flexDirection: "column", alignItems: "center",
                 justifyContent: "center", gap: 6, color: "#6b7280" }}
      >
        <VideoOff size={22} aria-hidden="true" />
        <div style={{ fontSize: 12 }}>영상 없음</div>
        <div style={{ fontSize: 10, textAlign: "center", lineHeight: 1.5 }}>
          이 카메라로 들어오는 실시간 프레임이 없습니다.
          <br />
          run_pipeline 이 해당 카메라로 실행 중인지 확인하세요.
        </div>
      </div>
    );
  }

  if (streamUrl && !streamDead) {
    return (
      <img
        // 쿼리로 캐시를 우회해야 재시도 때 브라우저가 옛 응답을 재사용하지 않는다.
        src={`${streamUrl}?a=${attempt}`}
        alt="CCTV 실시간"
        style={{ width: "100%", display: "block", borderRadius: 8,
                 aspectRatio: `1 / ${ratio}`, objectFit: "cover", background: "#0d1117" }}
        onError={() => {
          // 3회까지는 재접속, 그 뒤로는 시뮬레이션으로 폴백한다.
          if (attempt < 3) {
            window.setTimeout(() => setAttempt((a) => a + 1), 2000);
          } else {
            setStreamDead(true);
          }
        }}
      />
    );
  }

  return <canvas ref={canvasRef} style={{ width: "100%", display: "block", borderRadius: 8 }} />;
}
