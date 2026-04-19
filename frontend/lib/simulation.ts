import type { TickData } from "@/lib/usePoolData";

export const COINS = ["USDC", "DAI", "FRAX", "USDT"] as const;
export type Coin = (typeof COINS)[number];
export type Tab  = "curve" | "rings" | "torus";

export interface Reserves { USDC: number; DAI: number; FRAX: number; USDT: number }

export interface Tick2D extends TickData {
  S:    number;
  frac: number;
  pt:   [number, number] | null;   // one intersection (legacy)
  chord: [[number, number], [number, number]] | null;  // both chord endpoints
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
// Sphere invariant: Σ(r - xᵢ)² = r²
// 2D cross-section fixing all assets except coinA & coinB at their current values:
//   (xA - r)² + (xB - r)² = r² - Σ_{other} (r - xₖ)²  =  ρ²
// So the 2D slice is a circle centered at (r, r) with radius ρ.

export function sphereSliceRadius(r: number, reserves: Reserves, coinA: Coin, coinB: Coin): number {
  const others = (Object.keys(reserves) as Coin[]).filter(c => c !== coinA && c !== coinB);
  const otherContrib = others.reduce((sum, c) => sum + (r - reserves[c]) ** 2, 0);
  const rhoSq = r * r - otherContrib;
  return rhoSq > 0 ? Math.sqrt(rhoSq) : 0;
}

// Both intersection points of plane x+y=S with circle centered at (r,r) radius ρ
export function arcIntersectBoth(r: number, rho: number, S: number): [[number, number], [number, number]] | null {
  const u = S - 2 * r;
  const A = 2, B = 2 * u, C = u * u - rho * rho;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  const x1 = (-B - sq) / (2 * A), y1 = S - x1;
  const x2 = (-B + sq) / (2 * A), y2 = S - x2;
  return [[x1, y1], [x2, y2]];
}

// Single intersection in positive quadrant (legacy)
export function arcIntersect(r: number, rho: number, S: number): [number, number] | null {
  const both = arcIntersectBoth(r, rho, S);
  if (!both) return null;
  for (const [x, y] of both)
    if (x >= -1e-9 && y >= -1e-9) return [Math.max(0, x), Math.max(0, y)];
  return null;
}

export function buildCurveGeometry(r: number, width: number, height: number, coinA: Coin, coinB: Coin, reserves: Reserves, ticks: TickData[], zoom = 1) {
  const PAD    = 52;
  const size   = Math.min(width, height);
  const DRAW   = size - PAD * 2;
  const scale  = Math.max(zoom, 0.01);

  // Each tick has its own sphere of radius t.r.
  // Use the largest tick r as the reference sphere to set viewport scale.
  const arcR = ticks.length > 0 ? Math.max(...ticks.map(t => t.r)) : r;

  const sqrtN = Math.sqrt(4);
  // Equal-price point per asset = r*(1 - 1/√n) for each tick's own r
  // For the viewport, use the reference arcR
  const q = arcR * (1 - 1 / sqrtN);

  // Actual reserves for selected coins
  const rx = reserves[coinA];
  const ry = reserves[coinB];

  // Viewport: center on (q, q), show ±20% of arcR, zoom adjusts
  const viewHalf = arcR * 0.20 / Math.max(scale, 0.01);
  const DOMAIN   = viewHalf * 2;
  const centerX  = PAD + DRAW / 2;
  const centerY  = size - PAD - DRAW / 2;
  const originX  = centerX - (q / DOMAIN) * DRAW;
  const originY  = centerY + (q / DOMAIN) * DRAW;

  const sx = (v: number) => originX + (v / DOMAIN) * DRAW;
  const sy = (v: number) => originY - (v / DOMAIN) * DRAW;

  const slope = Math.abs(arcR - rx) > 1e-9 ? (arcR - ry) / (arcR - rx) : Infinity;
  const alpha = (rx + ry) / sqrtN;

  // For each tick, draw its OWN circle cross-section: center=(t.r, t.r), radius=tickRho
  // and intersect its own tick plane xA+xB = t.k*sqrtN (in the 2D projection,
  // fixing others at equal price for that tick: 2 * t.r*(1-1/√n) = 2*tq)
  const ticks2D: Tick2D[] = ticks.map(t => {
    const tq     = t.r * (1 - 1 / sqrtN);   // equal-price per asset for this tick
    const tickRho = sphereSliceRadius(t.r, reserves, coinA, coinB);
    // Plane: xA + xB = t.k*sqrtN - sumOthers, but sumOthers ≈ 2*tq at equal price
    const S      = t.k * sqrtN - 2 * tq;
    const kRange = t.kMax - t.kMin;
    const frac   = kRange > 0 ? (t.k - t.kMin) / kRange : 0;
    const chord  = arcIntersectBoth(t.r, tickRho, S);
    const pt     = chord ? chord.find(([x, y]) => x >= -1e-9 && y >= -1e-9) ?? null : null;
    return { ...t, S, frac, pt: pt as [number,number]|null, chord };
  });

  // Build arc for each tick's own circle, sweeping around its (tq,tq) angle
  const tickArcs: { index: number; isInterior: boolean; path: string }[] = ticks.map(t => {
    const tq      = t.r * (1 - 1 / sqrtN);
    const tickRho = sphereSliceRadius(t.r, reserves, coinA, coinB);
    const thetaQ  = Math.atan2(tq - t.r, tq - t.r);
    const halfSpan = tickRho > 0 ? Math.asin(Math.min(viewHalf * 1.8 / tickRho, 1)) : Math.PI / 4;
    const pts: string[] = [];
    for (let i = 0; i <= 120; i++) {
      const theta = thetaQ - halfSpan + (2 * halfSpan * i) / 120;
      const ax = t.r + tickRho * Math.cos(theta);
      const ay = t.r + tickRho * Math.sin(theta);
      pts.push(`${i === 0 ? "M" : "L"} ${sx(ax).toFixed(2)} ${sy(ay).toFixed(2)}`);
    }
    return { index: t.index, isInterior: t.isInterior, path: pts.join(" ") };
  });

  // Main arc: largest tick circle
  const rho     = sphereSliceRadius(arcR, reserves, coinA, coinB);
  const thetaQ  = Math.atan2(q - arcR, q - arcR);
  const halfSpan = rho > 0 ? Math.asin(Math.min(viewHalf * 1.8 / rho, 1)) : Math.PI / 4;
  const arcPts: string[] = [];
  for (let i = 0; i <= 120; i++) {
    const theta = thetaQ - halfSpan + (2 * halfSpan * i) / 120;
    const ax = arcR + rho * Math.cos(theta);
    const ay = arcR + rho * Math.sin(theta);
    arcPts.push(`${i === 0 ? "M" : "L"} ${sx(ax).toFixed(2)} ${sy(ay).toFixed(2)}`);
  }
  const arcPath = arcPts.join(" ");

  function tickLine(S: number) {
    if (S <= 0) return null;
    return { x1: sx(S), y1: sy(0), x2: sx(0), y2: sy(S) };
  }

  return { PAD, DOMAIN, sx, sy, q, rx, ry, slope, alpha, arcPath, ticks2D, tickLine, width, height, tickArcs, arcR, rho };
}

// ─── rings math ───────────────────────────────────────────────────────────────

export function buildRingsGeometry(r: number, width: number, nAssets: number, reserves: Reserves, ticks: TickData[], zoom = 5, height = width) {
  const N      = Math.max(nAssets, COINS.length);
  const sqrtN  = Math.sqrt(N);
  const q      = r * (1 - 1 / sqrtN);
  const cx     = width / 2, cy = height / 2;
  const pad    = 52;
  const maxR   = (Math.min(width, height) / 2 - pad) * 0.88;

  const ticksWithS: TickWithS[] = ticks.map(t => ({
    ...t,
    sEff: t.s,
  }));

  // Single unified scale anchored to rInt: at zoom=1, rInt fills the canvas.
  // Zooming in magnifies everything uniformly — infinite canvas behaviour.
  const scale  = (maxR / r) * Math.max(zoom, 0.01);

  const reserveDot: ReserveDot | null = (() => {
    if (!ticks.length) return null;
    const xs    = COINS.map(c => reserves[c]);
    const sumX  = xs.reduce((a, b) => a + b, 0);
    const alpha = sumX / sqrtN;
    const mean  = sumX / N;
    let dx = 0, dy = 0;
    xs.forEach((x, i) => {
      const angle = (i / N) * Math.PI * 2 - Math.PI / 2;
      dx += (x - mean) * Math.cos(angle);
      dy += (x - mean) * Math.sin(angle);
    });
    const mag  = Math.sqrt(dx * dx + dy * dy);
    const nx   = mag > 1e-9 ? dx / mag : 0;
    const ny   = mag > 1e-9 ? dy / mag : 0;
    const rSvg = mag * scale;
    return { svgX: cx + nx * rSvg, svgY: cy + ny * rSvg, alpha };
  })();

  function tooltipPos(rSvg: number): [number, number] {
    const tx = cx + Math.cos(-Math.PI / 4) * (rSvg + 10);
    const ty = cy + Math.sin(-Math.PI / 4) * (rSvg + 10);
    const bw = 196, bh = 126;
    return [
      Math.min(Math.max(tx, pad + 4), width - pad - bw - 4),
      Math.min(Math.max(ty - bh, pad + 4), height - pad - bh - 4),
    ];
  }

  const maxS   = Math.max(...ticksWithS.map(t => t.sEff), r * 0.01);
  const sphereRadii = [...new Set(ticks.map(t => t.r))].map(tickR => ({
    r: tickR,
    rSvg: tickR * scale,
  }));

  const rIntSvg = r * scale;   // = maxR * zoom — scales freely with zoom
  const axisR   = r * scale;   // axes reach out to rInt boundary

  return { N, q, cx, cy, maxR, axisR, ticksWithS, maxS, scale, reserveDot, tooltipPos, sphereRadii, rInt: r, rIntSvg };
}

