import type { TickData } from "@/lib/usePoolData";

export const COINS = ["USDC", "DAI", "FRAX", "USDT"] as const;
export type Coin = (typeof COINS)[number];
export type Tab  = "curve" | "rings";

export interface Reserves { USDC: number; DAI: number; FRAX: number; USDT: number }

export interface Tick2D extends TickData {
  S:    number;
  frac: number;
  pt:   [number, number] | null;
}

export interface TickWithS extends TickData {
  sEff: number;
}

export interface ReserveDot {
  svgX:  number;
  svgY:  number;
  alpha: number;
}

// ─── curve math ───────────────────────────────────────────────────────────────

export function arcIntersect(r: number, S: number): [number, number] | null {
  const a = 2, b = -2 * S, c = S * S - 2 * r * S + r * r;
  const d = b * b - 4 * a * c;
  if (d < 0) return null;
  const sq = Math.sqrt(d);
  for (const x of [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]) {
    const y = S - x;
    if (x >= -1e-9 && y >= -1e-9 && x <= r + 1e-9 && y <= r + 1e-9)
      return [Math.max(0, x), Math.max(0, y)];
  }
  return null;
}

export function projectOntoArc(r: number, px: number, py: number): [number, number] {
  const dx = px - r, dy = py - r;
  const d  = Math.sqrt(dx * dx + dy * dy);
  if (d < 1e-12) return [r * (1 - 1 / Math.SQRT2), r * (1 - 1 / Math.SQRT2)];
  return [r + (dx / d) * r, r + (dy / d) * r];
}

export function buildCurveGeometry(r: number, size: number, coinA: Coin, coinB: Coin, reserves: Reserves, ticks: TickData[]) {
  const PAD    = 52;
  const DRAW   = size - PAD * 2;
  const DOMAIN = r * 1.1;
  const sx     = (v: number) => PAD + (v / DOMAIN) * DRAW;
  const sy     = (v: number) => size - PAD - (v / DOMAIN) * DRAW;
  const svgR   = (r / DOMAIN) * DRAW;
  const q      = r * (1 - 1 / Math.SQRT2);

  const [rx, ry] = projectOntoArc(r, reserves[coinA], reserves[coinB]);
  const slope    = Math.abs(r - rx) > 1e-9 ? (r - ry) / (r - rx) : Infinity;
  const alpha    = (rx + ry) / Math.SQRT2;
  const arcPath  = `M ${sx(0)} ${sy(r)} A ${svgR} ${svgR} 0 0 0 ${sx(r)} ${sy(0)}`;

  const S_min  = (Math.SQRT2 - 1) * r * Math.SQRT2;
  const S_max  = r;
  const ticks2D: Tick2D[] = ticks.map(t => {
    const frac = (t.kNorm - 1.0) / (1.5 - 1.0);
    const S    = S_min + frac * (S_max - S_min);
    return { ...t, S, frac, pt: arcIntersect(r, S) };
  });

  function tickLine(S: number) {
    if (S < 0 || S > DOMAIN * 2) return null;
    return { x1: sx(Math.min(S, DOMAIN)), y1: sy(0), x2: sx(0), y2: sy(Math.min(S, DOMAIN)) };
  }

  return { PAD, DOMAIN, sx, sy, q, rx, ry, slope, alpha, arcPath, ticks2D, tickLine };
}

// ─── rings math ───────────────────────────────────────────────────────────────

export function buildRingsGeometry(r: number, size: number, nAssets: number, reserves: Reserves, ticks: TickData[]) {
  const N      = Math.max(nAssets, COINS.length);
  const sqrtN  = Math.sqrt(N);
  const q      = r * (1 - 1 / sqrtN);
  const cx     = size / 2, cy = size / 2;
  const pad    = 52;
  const maxR   = ((size - pad * 2) / 2) * 0.88;

  const ticksWithS: TickWithS[] = ticks.map(t => {
    const d = sqrtN - t.kNorm;
    const v = 1 - d * d;
    return { ...t, sEff: v > 0 ? r * Math.sqrt(v) : 0 };
  });
  const maxS   = Math.max(...ticksWithS.map(t => t.sEff), r * 0.01);
  const scale  = maxR / maxS;

  const reserveDot: ReserveDot | null = (() => {
    if (!ticks.length) return null;
    const xs    = COINS.map(c => reserves[c]);
    const sumX  = xs.reduce((a, b) => a + b, 0);
    const alpha = sumX / sqrtN;
    const diff  = r * sqrtN - alpha;
    const sSq   = r * r - diff * diff;
    const sRes  = sSq > 0 ? Math.sqrt(sSq) : 0;
    const rSvg  = sRes * scale;
    let dx = 0, dy = 0;
    xs.forEach((x, i) => {
      const angle = (i / N) * Math.PI * 2 - Math.PI / 2;
      dx += (x - q) * Math.cos(angle);
      dy += (x - q) * Math.sin(angle);
    });
    const mag = Math.sqrt(dx * dx + dy * dy);
    const nx  = mag > 1e-9 ? dx / mag : 1;
    const ny  = mag > 1e-9 ? dy / mag : 0;
    return { svgX: cx + nx * rSvg, svgY: cy + ny * rSvg, alpha };
  })();

  function tooltipPos(rSvg: number): [number, number] {
    const tx = cx + Math.cos(-Math.PI / 4) * (rSvg + 10);
    const ty = cy + Math.sin(-Math.PI / 4) * (rSvg + 10);
    const bw = 196, bh = 126;
    return [
      Math.min(Math.max(tx, pad + 4), size - pad - bw - 4),
      Math.min(Math.max(ty - bh, pad + 4), size - pad - bh - 4),
    ];
  }

  return { N, q, cx, cy, maxR, ticksWithS, maxS, scale, reserveDot, tooltipPos };
}
