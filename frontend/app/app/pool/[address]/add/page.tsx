"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronDown, ChevronUp, Info } from "lucide-react";
import { useAccount, useWriteContract } from "wagmi";
import { type Address, maxUint256 } from "viem";
import { color, typography, typeStyle } from "@/constants";
import { fmtUSD } from "@/lib/mock/data";
import { usePool } from "@/lib/hooks/usePool";
import { useTokenBalances, useTokenAllowances } from "@/lib/hooks/useTokenBalances";
import { POOL_ADDRESS, PM_ADDRESS, ERC20_ABI, PM_ABI } from "@/lib/contracts";

const WAD = 10n ** 18n;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mono(size: string = "12px", col: string = color.textSecondary) {
  return { fontFamily: "var(--font-mono)" as const, fontSize: size, color: col };
}
function lbl() {
  return { fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.07em", textTransform: "uppercase" as const, color: color.textMuted };
}
function divider() {
  return { borderTop: `1px solid ${color.borderSubtle}` };
}

// ─── Tick math ────────────────────────────────────────────────────────────────

function kNormFromDepegPrice(n: number, p: number): number {
  if (p >= 1) return Math.sqrt(n) - 1;
  if (p <= 0) return (n - 1) / Math.sqrt(n);
  const sqrtN = Math.sqrt(n);
  const sqrtDenom = Math.sqrt(n * (p * p + n - 1));
  return sqrtN - (p + n - 1) / sqrtDenom;
}

function capitalEfficiency(n: number, kNorm: number): number {
  const sqrtN = Math.sqrt(n);
  const xBase = 1 - 1 / sqrtN;
  const kSqrtN = kNorm * sqrtN;
  const A = (n - 1) - kSqrtN;
  const disc = kNorm * kNorm * n - n * A * A;
  if (disc < 0) return 1;
  const xMin = (kSqrtN - Math.sqrt(disc)) / n;
  if (xBase <= xMin) return 1;
  return xBase / (xBase - xMin);
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepBar({ step }: { step: 1 | 2 | 3 }) {
  const STEPS = [{ n: 1, label: "Range" }, { n: 2, label: "Amount" }, { n: 3, label: "Review" }] as const;
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((s, i) => {
        const done   = step > s.n;
        const active = step === s.n;
        return (
          <div key={s.n} className="flex items-center">
            <div className="flex items-center gap-2">
              <div style={{ width: 20, height: 20, borderRadius: "50%", border: `1px solid ${done || active ? color.textPrimary : color.border}`, backgroundColor: done ? color.textPrimary : active ? `${color.textPrimary}18` : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {done
                  ? <Check size={10} color={color.bg} strokeWidth={2.5} />
                  : <span style={{ ...mono("10px", active ? color.textPrimary : color.textMuted) }}>{s.n}</span>}
              </div>
              <span style={{ ...mono("10px", active ? color.textPrimary : done ? color.textSecondary : color.textMuted), letterSpacing: "0.05em", textTransform: "uppercase" as const }}>
                {s.label}
              </span>
            </div>
            {i < 2 && <div style={{ width: 24, height: 1, backgroundColor: step > s.n ? color.textPrimary : color.border, margin: "0 10px", flexShrink: 0 }} />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1 — set range ───────────────────────────────────────────────────────

function Step1({
  depegPrice, setDepegPrice,
  onContinue, kBound, n,
}: {
  depegPrice: number;
  setDepegPrice: (p: number) => void;
  onContinue: () => void;
  kBound: number;
  n: number;
}) {
  const [explainerOpen, setExplainerOpen] = useState(false);
  const blocked  = kBound > 0;

  const kNorm    = kNormFromDepegPrice(n, depegPrice);
  const effMult  = capitalEfficiency(n, kNorm);
  const kNormMin = Math.sqrt(n) - 1;
  const kNormMax = (n - 1) / Math.sqrt(n);
  const sliderPct = ((depegPrice - 0.90) / (0.9999 - 0.90)) * 100;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 style={{ fontFamily: typography.h2.family, fontSize: typography.h2.size, fontWeight: 500, letterSpacing: typography.h2.letterSpacing, color: color.textPrimary }}>
          Set your range
        </h2>
        <p style={{ ...typeStyle("p2"), color: color.textMuted, marginTop: 5 }}>
          Choose a depeg price threshold. Tighter ranges earn more fees but pause sooner.
        </p>
      </div>

      {blocked && (
        <div className="flex items-start gap-3 px-4 py-3" style={{ backgroundColor: `${color.warning}0d`, border: `1px solid ${color.warning}2a` }}>
          <Info size={12} color={color.warning} style={{ marginTop: 1, flexShrink: 0 }} />
          <div>
            <div style={{ ...mono("11px", color.warning), marginBottom: 3, fontWeight: 500 }}>Deposits paused</div>
            <p style={{ ...typeStyle("caption"), color: color.warning, lineHeight: "1.5", opacity: 0.85 }}>
              A boundary tick is active. Deposits resume when all assets return to peg.
            </p>
          </div>
        </div>
      )}

      {/* Range selector */}
      <div style={{ border: `1px solid ${color.border}`, backgroundColor: color.surface1 }}>
        <div className="px-4 py-3" style={{ borderBottom: `1px solid ${color.borderSubtle}` }}>
          <span style={lbl()}>Depeg Price Threshold</span>
        </div>
        <div className="px-4 py-4 flex flex-col gap-4">

          {/* Value + efficiency */}
          <div className="flex items-end justify-between">
            <div>
              <div style={{ fontFamily: typography.h2.family, fontSize: "36px", fontWeight: 500, letterSpacing: "-0.03em", color: color.textPrimary }}>
                ${depegPrice.toFixed(4)}
              </div>
              <div style={{ ...mono("10px", color.textMuted), marginTop: 2 }}>
                Tick pauses when any asset depegs below this price
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div style={{ ...mono("10px", color.textMuted) }}>Capital efficiency</div>
              <div style={{ fontFamily: typography.h2.family, fontSize: "22px", fontWeight: 500, letterSpacing: "-0.02em", color: color.accent }}>
                {effMult.toFixed(1)}×
              </div>
            </div>
          </div>

          {/* Slider */}
          <div className="flex flex-col gap-2">
            <input
              type="range"
              min={0}
              max={100}
              step={0.1}
              value={sliderPct}
              onChange={e => {
                const pct = parseFloat(e.target.value);
                const p = 0.90 + (pct / 100) * (0.9999 - 0.90);
                setDepegPrice(parseFloat(p.toFixed(4)));
              }}
              className="w-full"
              style={{ accentColor: color.accent }}
            />
            <div className="flex justify-between">
              <span style={{ ...mono("9px", color.textMuted) }}>$0.90 · wider · safer</span>
              <span style={{ ...mono("9px", color.textMuted) }}>more efficient · tighter · $0.9999</span>
            </div>
          </div>

          {/* k_norm stats */}
          <div className="grid grid-cols-3 gap-px" style={{ border: `1px solid ${color.borderSubtle}` }}>
            {[
              { label: "k_norm",  value: kNorm.toFixed(5) },
              { label: "k_min",   value: kNormMin.toFixed(3) },
              { label: "k_max",   value: kNormMax.toFixed(3) },
            ].map(r => (
              <div key={r.label} className="px-3 py-2.5" style={{ backgroundColor: color.surface2 }}>
                <div style={{ ...lbl(), marginBottom: 3 }}>{r.label}</div>
                <div style={mono("12px", color.textSecondary)}>{r.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Efficiency hint */}
      <div className="flex items-start gap-3 px-4 py-3" style={{ backgroundColor: `${color.accent}08`, border: `1px solid ${color.accent}22` }}>
        <Info size={12} color={color.accent} style={{ marginTop: 1, flexShrink: 0 }} />
        <p style={{ ...typeStyle("caption"), color: color.textSecondary, lineHeight: "1.6" }}>
          At <strong style={{ color: color.textPrimary }}>${depegPrice.toFixed(4)}</strong> threshold
          you get <strong style={{ color: color.accent }}>{effMult.toFixed(1)}× capital efficiency</strong> vs a full-range position.
          Tighter ticks earn more fees but pause sooner during a depeg event.
        </p>
      </div>

      {/* Explainer */}
      <div style={{ border: `1px solid ${color.border}`, backgroundColor: color.surface1 }}>
        <button onClick={() => setExplainerOpen(v => !v)} className="w-full flex items-center justify-between px-4 py-2.5" style={{ cursor: "pointer" }}>
          <span style={{ ...typeStyle("caption"), color: color.textMuted }}>What is a tick?</span>
          {explainerOpen ? <ChevronUp size={11} color={color.textMuted} /> : <ChevronDown size={11} color={color.textMuted} />}
        </button>
        {explainerOpen && (
          <div className="px-4 pb-4" style={divider()}>
            <p style={{ ...typeStyle("caption"), color: color.textSecondary, lineHeight: "1.65", paddingTop: 12 }}>
              Each tick is an independent sphere AMM. When reserves reach its plane boundary (your depeg threshold),
              the tick pauses and stops accepting swaps until assets re-peg. Tighter ticks have higher capital
              efficiency but activate earlier. Your liquidity is never lost — it just earns no fees while paused.
            </p>
          </div>
        )}
      </div>

      <button
        disabled={blocked}
        onClick={() => !blocked && onContinue()}
        className="w-full py-3.5"
        style={{ backgroundColor: blocked ? color.surface2 : color.textPrimary, color: blocked ? color.textMuted : color.bg, fontFamily: typography.p1.family, fontSize: typography.p1.size, fontWeight: 500, letterSpacing: "-0.01em", cursor: blocked ? "not-allowed" : "pointer" }}
      >
        {blocked ? "Deposits paused" : "Continue →"}
      </button>
    </div>
  );
}

// ─── Step 2 — amount ──────────────────────────────────────────────────────────

const QUICK_PCTS = [25, 50, 75, 100] as const;

function Step2({ depegPrice, n, tokens, reserves, balances, usdAmount, setUsdAmount, onBack, onContinue }: {
  depegPrice: number;
  n: number;
  tokens: { symbol: string; address: string; color: string }[];
  reserves: number[];
  balances: number[];
  usdAmount: string;
  setUsdAmount: (v: string) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const num          = parseFloat(usdAmount) || 0;
  const totalReserve = reserves.reduce((a, b) => a + b, 0);
  const walletUSD    = balances.reduce((a, b) => a + b, 0);
  const splits = tokens.map((t, i) => ({
    token: t,
    pct:   totalReserve > 0 ? reserves[i] / totalReserve : 1 / n,
    usd:   num * (totalReserve > 0 ? reserves[i] / totalReserve : 1 / n),
  }));
  const activeQuick = QUICK_PCTS.find(p => usdAmount === ((walletUSD * p) / 100).toFixed(2));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 style={{ fontFamily: typography.h2.family, fontSize: typography.h2.size, fontWeight: 500, letterSpacing: typography.h2.letterSpacing, color: color.textPrimary }}>
          Set deposit amount
        </h2>
      </div>

      <div className="flex items-center justify-between px-4 py-2.5" style={{ border: `1px solid ${color.borderSubtle}`, backgroundColor: color.surface2 }}>
        <span style={{ ...typeStyle("caption"), color: color.textMuted }}>New tick @ ${depegPrice.toFixed(4)}</span>
        <button onClick={onBack} className="flex items-center gap-1" style={{ ...typeStyle("caption"), color: color.textMuted, cursor: "pointer" }}>
          <ArrowLeft size={9} /> Change
        </button>
      </div>

      <div style={{ border: `1px solid ${color.border}`, backgroundColor: color.surface1 }}>
        <div className="px-4 py-4" style={divider()}>
          <div className="flex items-center justify-between mb-2">
            <span style={{ ...typeStyle("caption"), color: color.textMuted }}>Deposit amount (USD)</span>
            <span style={mono("10px", color.textMuted)}>Balance ≈ {fmtUSD(walletUSD)}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span style={{ ...mono("24px", color.textMuted) }}>$</span>
            <input
              type="text" inputMode="decimal" placeholder="0"
              value={usdAmount}
              onChange={e => { if (/^\d*\.?\d*$/.test(e.target.value)) setUsdAmount(e.target.value); }}
              className="flex-1 bg-transparent outline-none"
              style={{ fontFamily: typography.h2.family, fontSize: "40px", letterSpacing: "-0.03em", color: usdAmount ? color.textPrimary : color.textMuted, lineHeight: "1" }}
            />
          </div>
          <div className="flex gap-1.5 mt-3">
            {QUICK_PCTS.map(pct => {
              const active = activeQuick === pct;
              return (
                <button key={pct} onClick={() => setUsdAmount(((walletUSD * pct) / 100).toFixed(2))}
                  style={{ ...mono("10px", active ? color.accent : color.textMuted), border: `1px solid ${active ? color.accent : color.border}`, backgroundColor: active ? `${color.accent}10` : "transparent", padding: "3px 10px", cursor: "pointer", letterSpacing: "0.05em" }}>
                  {pct === 100 ? "MAX" : `${pct}%`}
                </button>
              );
            })}
          </div>
        </div>

        {num > 0 && (
          <div className="px-4 pt-4 pb-3">
            <div style={{ ...lbl(), marginBottom: 12 }}>Token splits</div>
            <div className="flex flex-col gap-3">
              {splits.map(({ token, pct, usd }) => (
                <div key={token.address}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: token.color, display: "inline-block" }} />
                      <span style={{ ...typeStyle("p3"), color: color.textSecondary }}>{token.symbol}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span style={mono("10px", color.textMuted)}>{(pct * 100).toFixed(1)}%</span>
                      <span style={{ ...mono("13px", color.textPrimary), fontWeight: 500, minWidth: 56, textAlign: "right" as const }}>{fmtUSD(usd)}</span>
                    </div>
                  </div>
                  <div style={{ height: 2, backgroundColor: color.surface3 }}>
                    <div style={{ width: `${pct * 100}%`, height: "100%", backgroundColor: token.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <button disabled={num <= 0} onClick={() => num > 0 && onContinue()} className="w-full py-3.5"
        style={{ backgroundColor: num <= 0 ? color.surface2 : color.textPrimary, color: num <= 0 ? color.textMuted : color.bg, fontFamily: typography.p1.family, fontSize: typography.p1.size, fontWeight: 500, letterSpacing: "-0.01em", cursor: num <= 0 ? "not-allowed" : "pointer" }}>
        {num <= 0 ? "Enter an amount" : "Review deposit →"}
      </button>
    </div>
  );
}

// ─── Step 3 — review + submit ─────────────────────────────────────────────────

function Step3({ depegPrice, n, tokens, reserves, amount, allowances, onBack, onApprove, onMint, isTxPending, approveIdx }: {
  depegPrice: number;
  n: number;
  tokens: { symbol: string; address: string; color: string }[];
  reserves: number[];
  amount: number;
  allowances: bigint[];
  onBack: () => void;
  onApprove: (tokenIdx: number) => void;
  onMint: () => void;
  isTxPending: boolean;
  approveIdx: number;
}) {
  const totalReserve = reserves.reduce((a, b) => a + b, 0);
  const splits = tokens.map((t, i) => ({
    token: t,
    pct:   totalReserve > 0 ? reserves[i] / totalReserve : 1 / n,
    usd:   amount * (totalReserve > 0 ? reserves[i] / totalReserve : 1 / n),
  }));

  const rWad = BigInt(Math.floor(amount * 1e18));
  const needsApproval = tokens.findIndex((_, i) => allowances[i] < rWad / BigInt(n));
  const allApproved   = needsApproval === -1;

  const kNorm = kNormFromDepegPrice(n, depegPrice);
  const eff   = capitalEfficiency(n, kNorm);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 style={{ fontFamily: typography.h2.family, fontSize: typography.h2.size, fontWeight: 500, letterSpacing: typography.h2.letterSpacing, color: color.textPrimary }}>
          Review deposit
        </h2>
        <p style={{ ...typeStyle("p2"), color: color.textMuted, marginTop: 5 }}>Confirm before submitting on-chain.</p>
      </div>

      <div style={{ border: `1px solid ${color.border}`, backgroundColor: color.surface1 }}>
        <div className="px-4 py-4" style={divider()}>
          <div style={{ ...lbl(), marginBottom: 6 }}>Total deposit</div>
          <div style={{ fontFamily: typography.h2.family, fontSize: "30px", fontWeight: 500, letterSpacing: "-0.03em", color: color.textPrimary }}>
            {fmtUSD(amount)}
          </div>
        </div>

        <div className="px-4 py-4" style={divider()}>
          <div style={{ ...lbl(), marginBottom: 12 }}>Token breakdown</div>
          <div className="flex flex-col gap-3">
            {splits.map(({ token, pct, usd }) => (
              <div key={token.address} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: token.color, display: "inline-block" }} />
                  <span style={{ ...typeStyle("p3"), color: color.textSecondary }}>{token.symbol}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div style={{ width: 60, height: 2, backgroundColor: color.surface3 }}>
                    <div style={{ width: `${pct * 100}%`, height: "100%", backgroundColor: token.color }} />
                  </div>
                  <span style={{ ...mono("13px", color.textPrimary), fontWeight: 500, minWidth: 52, textAlign: "right" as const }}>{fmtUSD(usd)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-4 py-4" style={divider()}>
          <div style={{ ...lbl(), marginBottom: 10 }}>Position details</div>
          <div className="flex flex-col gap-2">
            {[
              { label: "Type",               value: "New tick",                    accent: false },
              { label: "Depeg threshold",    value: `$${depegPrice.toFixed(4)}`,   accent: false },
              { label: "Capital efficiency", value: `${eff.toFixed(1)}×`,          accent: true  },
              { label: "Fee tier",           value: "0.05%",                       accent: false },
              { label: "Slippage",           value: "0.5%",                        accent: false },
            ].map(r => (
              <div key={r.label} className="flex items-center justify-between">
                <span style={{ ...typeStyle("p3"), color: color.textMuted }}>{r.label}</span>
                <span style={{ ...mono("12px", r.accent ? color.accent : color.textSecondary) }}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {!allApproved ? (
          <button
            disabled={isTxPending}
            onClick={() => onApprove(needsApproval)}
            className="w-full py-3.5"
            style={{ backgroundColor: color.accent, color: color.bg, fontFamily: typography.p1.family, fontSize: typography.p1.size, fontWeight: 500, letterSpacing: "-0.01em", cursor: isTxPending ? "not-allowed" : "pointer" }}
          >
            {isTxPending && approveIdx === needsApproval ? "Approving…" : `Approve ${tokens[needsApproval]?.symbol}`}
          </button>
        ) : (
          <button
            disabled={isTxPending}
            onClick={onMint}
            className="w-full py-3.5"
            style={{ backgroundColor: color.textPrimary, color: color.bg, fontFamily: typography.p1.family, fontSize: typography.p1.size, fontWeight: 500, letterSpacing: "-0.01em", cursor: isTxPending ? "not-allowed" : "pointer" }}
          >
            {isTxPending ? "Submitting…" : `Add ${fmtUSD(amount)} Liquidity`}
          </button>
        )}
        <button onClick={onBack} className="w-full py-3"
          style={{ border: `1px solid ${color.border}`, backgroundColor: "transparent", color: color.textMuted, fontFamily: typography.p2.family, fontSize: typography.p2.size, cursor: "pointer" }}>
          ← Back
        </button>
      </div>
    </div>
  );
}

// ─── Success ──────────────────────────────────────────────────────────────────

function SuccessState({ depegPrice, amount, tokens, reserves, n }: {
  depegPrice: number;
  amount: number;
  tokens: { symbol: string; address: string; color: string }[];
  reserves: number[];
  n: number;
}) {
  const totalReserve = reserves.reduce((a, b) => a + b, 0);
  const splits = tokens.map((t, i) => ({
    token: t,
    usd:   amount * (totalReserve > 0 ? reserves[i] / totalReserve : 1 / n),
  }));

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto px-6 py-16" style={{ textAlign: "center" as const }}>
      <div style={{ width: 52, height: 52, borderRadius: "50%", border: `1px solid ${color.success}`, backgroundColor: `${color.success}10`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Check size={22} color={color.success} strokeWidth={1.5} />
      </div>
      <div>
        <h2 style={{ fontFamily: typography.h2.family, fontSize: typography.h2.size, fontWeight: 500, letterSpacing: typography.h2.letterSpacing, color: color.textPrimary }}>
          Position created
        </h2>
        <p style={{ ...typeStyle("p2"), color: color.textMuted, marginTop: 6 }}>
          {fmtUSD(amount)} deposited · new tick @ ${depegPrice.toFixed(4)}
        </p>
      </div>

      <div className="w-full" style={{ border: `1px solid ${color.border}`, backgroundColor: color.surface1 }}>
        <div className="px-4 py-2.5" style={divider()}>
          <span style={lbl()}>Deposited</span>
        </div>
        {splits.map(({ token, usd }) => (
          <div key={token.address} className="flex items-center justify-between px-4 py-2.5" style={divider()}>
            <div className="flex items-center gap-2">
              <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: token.color, display: "inline-block" }} />
              <span style={{ ...typeStyle("p3"), color: color.textSecondary }}>{token.symbol}</span>
            </div>
            <span style={{ ...mono("13px", color.textPrimary), fontWeight: 500 }}>{fmtUSD(usd)}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-3 w-full">
        <Link href="/app/positions" className="flex-1 py-3 flex items-center justify-center"
          style={{ backgroundColor: color.textPrimary, color: color.bg, fontFamily: typography.p1.family, fontSize: typography.p1.size, fontWeight: 500 }}>
          View positions
        </Link>
        <Link href="/app/pools" className="flex-1 py-3 flex items-center justify-center"
          style={{ border: `1px solid ${color.border}`, color: color.textPrimary, fontFamily: typography.p1.family, fontSize: typography.p1.size }}>
          Back to pools
        </Link>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AddLiquidityPage() {
  const [step,       setStep]       = useState<1 | 2 | 3 | 4>(1);
  const [depegPrice, setDepegPrice] = useState(0.95);
  const [usdAmount,  setUsdAmount]  = useState("");
  const [approveIdx, setApproveIdx] = useState(-1);

  const { address } = useAccount();
  const { pool }    = usePool(POOL_ADDRESS);
  const tokenAddrs  = (pool?.tokens.map(t => t.address as Address)) ?? [];

  const { balances }   = useTokenBalances(tokenAddrs, address);
  const { allowances, refetch: refetchAllowances } = useTokenAllowances(tokenAddrs, address, PM_ADDRESS);
  const { writeContract, isPending } = useWriteContract();

  const tokens   = pool?.tokens   ?? [];
  const reserves = pool?.reserves ?? [];
  const kBound   = pool?.kBound   ?? 0;
  const n        = tokens.length || 4;
  const amount   = parseFloat(usdAmount) || 0;

  function handleApprove(idx: number) {
    if (!address) return;
    setApproveIdx(idx);
    writeContract(
      { address: tokenAddrs[idx], abi: ERC20_ABI, functionName: "approve", args: [PM_ADDRESS, maxUint256] },
      { onSuccess: () => refetchAllowances() }
    );
  }

  function handleMint() {
    if (!address || !pool) return;

    const rWad     = BigInt(Math.floor(amount * 1e18));
    const kNorm    = kNormFromDepegPrice(n, depegPrice);
    const kNormWAD = BigInt(Math.floor(kNorm * 1e18));
    const kWad     = rWad * kNormWAD / WAD;

    const amountsMin = tokens.map(() => rWad / BigInt(n) * 995n / 1000n);
    const deadline   = BigInt(Math.floor(Date.now() / 1000) + 600);

    writeContract(
      {
        address: PM_ADDRESS,
        abi: PM_ABI,
        functionName: "mint",
        args: [{ pool: POOL_ADDRESS, kWad, rWad, amountsMin, recipient: address, deadline }],
      },
      { onSuccess: () => setStep(4) }
    );
  }

  if (step === 4) {
    return (
      <div className="flex-1 overflow-y-auto" style={{ backgroundColor: color.bg }}>
        <SuccessState depegPrice={depegPrice} amount={amount} tokens={tokens} reserves={reserves} n={n} />
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden w-full" style={{ height: "calc(100vh - 5.5rem)" }}>
    <div className="flex-1 min-h-0 grid grid-cols-[80px_1fr_80px]" style={{ border: `1px solid ${color.border}` }}>
      <div style={{ backgroundImage: `repeating-linear-gradient(45deg, ${color.borderSubtle} 0, ${color.borderSubtle} 1px, transparent 0, transparent 50%)`, backgroundSize: "12px 12px", borderRight: `1px solid ${color.border}` }} />
      <div className="flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-6 shrink-0"
        style={{ height: 44, borderBottom: `1px solid ${color.borderSubtle}` }}>
        <div className="flex items-center gap-2" style={{ ...mono("10px", color.textMuted), letterSpacing: "0.05em" }}>
          <Link href="/app/pools" style={{ color: color.textMuted }}>Pools</Link>
          <span>/</span>
          <Link href={`/app/pool/${POOL_ADDRESS}`} style={{ color: color.textMuted }}>
            {tokens.map(t => t.symbol).join("·")}
          </Link>
          <span>/</span>
          <span style={{ color: color.textPrimary }}>Add Liquidity</span>
        </div>
        <StepBar step={step as 1 | 2 | 3} />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-xl w-full mx-auto px-6 py-8">
          {step === 1 && (
            <Step1
              depegPrice={depegPrice} setDepegPrice={setDepegPrice}
              onContinue={() => setStep(2)} kBound={kBound} n={n}
            />
          )}
          {step === 2 && (
            <Step2
              depegPrice={depegPrice} n={n}
              tokens={tokens} reserves={reserves} balances={balances}
              usdAmount={usdAmount} setUsdAmount={setUsdAmount}
              onBack={() => setStep(1)} onContinue={() => setStep(3)}
            />
          )}
          {step === 3 && (
            <Step3
              depegPrice={depegPrice} n={n}
              tokens={tokens} reserves={reserves} amount={amount} allowances={allowances}
              onBack={() => setStep(2)}
              onApprove={handleApprove}
              onMint={handleMint}
              isTxPending={isPending}
              approveIdx={approveIdx}
            />
          )}
        </div>
      </div>
      </div>
      <div style={{ backgroundImage: `repeating-linear-gradient(45deg, ${color.borderSubtle} 0, ${color.borderSubtle} 1px, transparent 0, transparent 50%)`, backgroundSize: "12px 12px", borderLeft: `1px solid ${color.border}` }} />
    </div>
    </div>
  );
}
