/**
 * Canvas 공통 유틸 — roundRect / drawCar / pad
 * (참조 디자인 HTML의 헬퍼를 TS로 옮긴 것)
 */

export function rr(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function drawCar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  color: string,
  cw: number,
  ch: number
): void {
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;
  rr(ctx, cx - cw / 2, cy - ch / 2, cw, ch, 3);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  rr(ctx, cx - cw / 2 + 2, cy - ch / 2 + 2, cw - 4, ch * 0.45, 2);
  ctx.fill();
}

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * useCanvasLoop을 쓰는 컴포넌트가 부모 width에 맞춰 자동 리사이즈하도록
 * 부모의 clientWidth에 안정적으로 매핑할 때 쓰는 헬퍼.
 */
export function fitCanvasToParent(canvas: HTMLCanvasElement, ratio: number): { W: number; H: number } {
  const parent = canvas.parentElement;
  if (!parent) return { W: canvas.width, H: canvas.height };
  const W = Math.max(120, parent.clientWidth);
  const H = Math.round(W * ratio);
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  return { W, H };
}
