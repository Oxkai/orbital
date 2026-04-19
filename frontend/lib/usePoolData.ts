"use client";

import { useReadContracts } from "wagmi";
import { ADDRESSES, POOL_ABI, WAD } from "@/constants/contracts";

const MAX_TICKS = 32;

export interface TickData {
  index: number;
  k: number;          // plane constant (WAD-descaled), relative to this tick's r
  r: number;          // this tick's radius contribution
  s: number;          // boundary circle radius = sqrt(r²-(r√N-k)²)
  kNorm: number;      // k/r — normalised, comparable across ticks
  kMin: number;       // TickLib.kMin for this tick's r: r*(√N-1)
  kMax: number;       // TickLib.kMax for this tick's r: r*(N-1)/√N
  isInterior: boolean;
  liquidityGross: number;
}

export interface PoolData {
  reserves: { USDC: number; DAI: number; FRAX: number; USDT: number };
  rInt: number;
  sumX: number;
  sumXSq: number;
  kBound: number;
  sBound: number;
  fee: number;
  numTicks: number;
  n: number;
  ticks: TickData[];
  q: number;       // equalPricePoint(rInt, n) — composite sphere equal-price
  alpha: number;   // computeAlpha(sumX, n) — current position on sphere axis
  sqrtN: number;
  isLoading: boolean;
}

const addr = ADDRESSES.pool as `0x${string}`;

export function usePoolData(): PoolData {
  // Batch 1: pool-level data
  const { data: d1, isLoading: l1 } = useReadContracts({
    contracts: [
      { address: addr, abi: POOL_ABI, functionName: "reserves", args: [BigInt(0)] },
      { address: addr, abi: POOL_ABI, functionName: "reserves", args: [BigInt(1)] },
      { address: addr, abi: POOL_ABI, functionName: "reserves", args: [BigInt(2)] },
      { address: addr, abi: POOL_ABI, functionName: "reserves", args: [BigInt(3)] },
      { address: addr, abi: POOL_ABI, functionName: "slot0" },
      { address: addr, abi: POOL_ABI, functionName: "fee" },
      { address: addr, abi: POOL_ABI, functionName: "numTicks" },
      { address: addr, abi: POOL_ABI, functionName: "n" },
    ],
    query: { refetchInterval: 5000 },
  });

  // Batch 2: tick data
  const { data: d2, isLoading: l2 } = useReadContracts({
    contracts: Array.from({ length: MAX_TICKS }, (_, i) => ({
      address: addr,
      abi: POOL_ABI,
      functionName: "ticks" as const,
      args: [BigInt(i)],
    })),
    query: { refetchInterval: 5000 },
  });

  const toNum = (v: unknown) =>
    typeof v === "bigint" ? Number(v) / Number(WAD) : 0;

  const slot0    = d1?.[4]?.result as readonly [bigint, bigint, bigint, bigint, bigint, boolean] | undefined;
  const numTicks = d1?.[6]?.result ? Number(d1[6].result as bigint) : 0;
  const nAssets  = d1?.[7]?.result ? Number(d1[7].result as bigint) : 4;
  const fee      = d1?.[5]?.result as number | undefined;

  const rInt   = toNum(slot0?.[2]);
  const sumX   = toNum(slot0?.[0]);
  const sumXSq = toNum(slot0?.[1]);
  const kBound = toNum(slot0?.[3]);
  const sBound = toNum(slot0?.[4]);
  const sqrtN  = Math.sqrt(nAssets);

  // Derived — exact formulas from SphereMath/TickLib
  const q     = rInt > 0 ? rInt - rInt / sqrtN : 0;  // equalPricePoint
  const alpha = sumX / sqrtN;                         // computeAlpha
  // kMin/kMax are per-tick (each tick has its own r) — computed inside tick loop

  const ticks: TickData[] = [];
  for (let i = 0; i < Math.min(numTicks, MAX_TICKS); i++) {
    const raw = d2?.[i]?.result as readonly [bigint, bigint, boolean, bigint, bigint] | undefined;
    if (!raw) continue;
    const k = toNum(raw[0]);
    const r = toNum(raw[1]);
    const diff = r * sqrtN - k;
    const sSq  = r * r - diff * diff;
    ticks.push({
      index: i, k, r,
      s:              sSq > 0 ? Math.sqrt(sSq) : 0,
      kNorm:          r > 0 ? k / r : 0,
      kMin:           r * (sqrtN - 1),
      kMax:           r * (nAssets - 1) / sqrtN,
      isInterior:     raw[2],
      liquidityGross: Number(raw[4]),
    });
  }

  const reserves = {
    USDT: toNum(d1?.[0]?.result),
    FRAX: toNum(d1?.[1]?.result),
    USDC: toNum(d1?.[2]?.result),
    DAI:  toNum(d1?.[3]?.result),
  };

  const isLoading = l1 || l2;

  const result: PoolData = {
    reserves, rInt, sumX, sumXSq, kBound, sBound,
    fee: fee ?? 500, numTicks, n: nAssets, ticks,
    q, alpha, sqrtN, isLoading,
  };

  if (!isLoading && numTicks > 0) {
    console.group("=== Orbital Pool (on-chain) ===");
    console.log("--- RAW tick data from contract (bigint, pre-WAD) ---");
    for (let i = 0; i < Math.min(numTicks, MAX_TICKS); i++) {
      const raw = d2?.[i]?.result as readonly [bigint, bigint, boolean, bigint, bigint] | undefined;
      if (!raw) continue;
      console.log(`tick[${i}] →`, {
        k_raw:            raw[0].toString(),
        r_raw:            raw[1].toString(),
        isInterior:       raw[2],
        feeGrowthInside:  raw[3].toString(),
        liquidityGross:   raw[4].toString(),
      });
    }
    console.log("pool          :", ADDRESSES.pool);
    console.log("n             :", nAssets);
    console.log("rInt          :", rInt.toFixed(6));
    console.log("fee           :", (result.fee / 10000).toFixed(2) + "%");
    console.log("numTicks      :", numTicks);
    console.log("--- slot0 ---");
    console.log("sumX  (Σxᵢ)   :", sumX.toFixed(6));
    console.log("sumXSq (Σxᵢ²) :", sumXSq.toFixed(6));
    console.log("kBound        :", kBound.toFixed(6), "  ← active tick boundary k");
    console.log("sBound        :", sBound.toFixed(6), "  ← active tick boundary s");
    console.log("--- Derived ---");
    console.log("q  (equal-price point) :", q.toFixed(6), "  = rInt - rInt/√N");
    console.log("α  (current position)  :", alpha.toFixed(6), "  = sumX/√N");
    console.log("--- Reserves ---");
    console.table(reserves);
    console.log("--- Ticks (all fields) ---");
    console.table(ticks.map(t => ({
      "#":            t.index,
      "k (contract)": t.k.toFixed(6),
      "r (contract)": t.r.toFixed(6),
      "s = √(r²-(r√N-k)²)": t.s.toFixed(6),
      "kNorm = k/r":  t.kNorm.toFixed(6),
      "kMin = r(√N-1)": t.kMin.toFixed(6),
      "kMax = r(N-1)/√N": t.kMax.toFixed(6),
      "isInterior":   t.isInterior,
      "liquidityGross": t.liquidityGross,
    })));
    console.groupEnd();
  }

  return result;
}
