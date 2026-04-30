"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Settings, ArrowDown, ArrowUpDown, ChevronDown, ChevronUp, X, Check } from "lucide-react";
import { useAccount, useWriteContract, useSimulateContract } from "wagmi";
import { injected } from "wagmi/connectors";
import { useConnect } from "wagmi";
import { type Address, maxUint256 } from "viem";
import { color, typography, typeStyle } from "@/constants";
import { usePool } from "@/lib/hooks/usePool";
import { useTokenBalances, useTokenAllowances } from "@/lib/hooks/useTokenBalances";
import { POOL_ADDRESS, QUOTER_ADDRESS, ROUTER_ADDRESS, ERC20_ABI, ROUTER_ABI, QUOTER_ABI } from "@/lib/contracts";

function fmtBalance(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(2) + "K";
  return n.toFixed(4);
}

// ─── Token dropdown ───────────────────────────────────────────────────────────

interface DropdownProps {
  tokens: { symbol: string; address: string; color: string; balance: number }[];
  selected: number;
  excluded: number;
  onSelect: (idx: number) => void;
  onClose: () => void;
}

function TokenDropdown({ tokens, selected, excluded, onSelect, onClose }: DropdownProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute right-0 top-full mt-1 z-50 w-52"
      style={{ border: `1px solid ${color.border}`, backgroundColor: color.surface2, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
      {tokens.map((token, idx) => (
        <button key={token.address} onClick={() => { onSelect(idx); onClose(); }}
          className="w-full flex items-center gap-3 px-4 py-3 transition-colors"
          style={{ backgroundColor: idx === selected ? color.surface3 : "transparent" }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: token.color, flexShrink: 0 }} />
          <div className="flex-1 flex flex-col items-start">
            <span style={{ ...typeStyle("p2"), fontWeight: 500, color: color.textPrimary }}>{token.symbol}</span>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: color.textSecondary }}>
              {token.balance.toFixed(2)}
            </span>
            {idx === selected && <Check size={10} color={color.success} />}
            {idx === excluded && <span style={{ ...typeStyle("caption"), color: color.textMuted }}>swap ↔</span>}
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Token box ────────────────────────────────────────────────────────────────

function TokenBox({ mode, token, otherIdx, tokenIdx, tokens, value, onChange, onTokenSelect, isConnected }: {
  mode: "in" | "out";
  token: { symbol: string; address: string; color: string; balance: number };
  tokenIdx: number;
  otherIdx: number;
  tokens: { symbol: string; address: string; color: string; balance: number }[];
  value: string;
  onChange?: (v: string) => void;
  onTokenSelect: (idx: number) => void;
  isConnected: boolean;
}) {
  const [open, setOpen] = useState(false);
  const numVal = parseFloat(value) || 0;
  const balanceStr = !isConnected ? "—" : fmtBalance(token.balance);

  return (
    <div className="relative px-4 py-4" style={{ backgroundColor: color.surface2 }}>
      <div className="flex items-center justify-between mb-3">
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase" as const, color: color.textMuted }}>
          {mode === "in" ? "You pay" : "You receive"}
        </span>
        {mode === "in" && (
          <span style={{ ...typeStyle("caption"), color: color.textMuted }}>
            Balance: {balanceStr}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          {mode === "in" ? (
            <input type="text" inputMode="decimal" placeholder="0" value={value}
              onChange={e => { if (/^\d*\.?\d*$/.test(e.target.value)) onChange?.(e.target.value); }}
              className="w-full bg-transparent outline-none"
              style={{ fontFamily: typography.h2.family, fontSize: "28px", letterSpacing: "-0.03em", fontWeight: 400, color: value ? color.textPrimary : color.textMuted, lineHeight: "1.1" }}
            />
          ) : (
            <div style={{ fontFamily: typography.h2.family, fontSize: "28px", letterSpacing: "-0.03em", fontWeight: 400, color: value ? color.textPrimary : color.textMuted, lineHeight: "1.1" }}>
              {value || "0"}
            </div>
          )}
        </div>

        <div className="relative shrink-0">
          <button onClick={() => setOpen(v => !v)} className="flex items-center gap-2 px-3 py-2"
            style={{ border: `1px solid ${color.border}`, backgroundColor: open ? color.surface3 : color.surface1, transition: "background-color 0.1s" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: token.color, flexShrink: 0 }} />
            <span style={{ ...typeStyle("p2"), fontWeight: 500, color: color.textPrimary }}>{token.symbol}</span>
            <ChevronDown size={12} color={color.textMuted} style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }} />
          </button>
          {open && (
            <TokenDropdown tokens={tokens} selected={tokenIdx} excluded={otherIdx}
              onSelect={onTokenSelect} onClose={() => setOpen(false)} />
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-2">
        <span style={{ ...typeStyle("caption"), color: color.textMuted }}>≈ ${numVal > 0 ? numVal.toFixed(2) : "0.00"}</span>
        {mode === "in" && isConnected && token.balance > 0 && (
          <button onClick={() => onChange?.(token.balance.toFixed(6))}
            style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.06em", textTransform: "uppercase" as const, color: color.accent, border: `1px solid ${color.accent}44`, padding: "1px 6px", cursor: "pointer" }}>
            Max
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Settings (slippage tolerance + deadline) ─────────────────────────────────

function SettingsPanel({ slippage, setSlippage, deadline, setDeadline, onClose }: {
  slippage: number; setSlippage: (v: number) => void;
  deadline: number; setDeadline: (v: number) => void;
  onClose: () => void;
}) {
  return (
    <div className="p-4" style={{ backgroundColor: color.surface2, borderBottom: `1px solid ${color.borderSubtle}` }}>
      <div className="flex items-center justify-between mb-4">
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase" as const, color: color.textMuted }}>Settings</span>
        <button onClick={onClose}><X size={13} color={color.textMuted} /></button>
      </div>
      <div className="flex flex-col gap-4">
        <div>
          <div style={{ ...typeStyle("caption"), color: color.textMuted, marginBottom: 8 }}>Slippage tolerance</div>
          <div className="flex gap-2">
            {[0.1, 0.5, 1].map(v => (
              <button key={v} onClick={() => setSlippage(v)} className="flex-1 py-1.5"
                style={{ border: `1px solid ${slippage === v ? color.accent : color.border}`, backgroundColor: slippage === v ? `${color.accent}18` : "transparent", ...typeStyle("p3"), color: slippage === v ? color.accent : color.textSecondary, cursor: "pointer" }}>
                {v}%
              </button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ ...typeStyle("caption"), color: color.textMuted, marginBottom: 8 }}>Transaction deadline</div>
          <div className="flex gap-2">
            {[5, 10, 30].map(v => (
              <button key={v} onClick={() => setDeadline(v)} className="flex-1 py-1.5"
                style={{ border: `1px solid ${deadline === v ? color.accent : color.border}`, backgroundColor: deadline === v ? `${color.accent}18` : "transparent", ...typeStyle("p3"), color: deadline === v ? color.accent : color.textSecondary, cursor: "pointer" }}>
                {v}m
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Info panel ───────────────────────────────────────────────────────────────

function SwapInfoPanel({ tokenIn, tokenOut, tokens, numIn, amountOut, slippage, fee }: {
  tokenIn: number; tokenOut: number;
  tokens: { symbol: string }[];
  numIn: number; amountOut: number; slippage: number; fee: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const [rateFlipped, setRateFlipped] = useState(false);
  const inSym  = tokens[tokenIn]?.symbol  ?? "—";
  const outSym = tokens[tokenOut]?.symbol ?? "—";
  const hasValues = numIn > 0 && amountOut > 0;
  const feeAmt    = hasValues ? numIn * fee / 1_000_000 : 0;
  const minOut    = hasValues ? amountOut * (1 - slippage / 100) : 0;
  const rate      = hasValues ? amountOut / numIn : 0;
  const rateStr   = hasValues
    ? rateFlipped ? `1 ${outSym} = ${(1 / rate).toFixed(5)} ${inSym}` : `1 ${inSym} = ${rate.toFixed(5)} ${outSym}`
    : `1 ${inSym} = — ${outSym}`;

  return (
    <div style={{ borderTop: `1px solid ${color.borderSubtle}` }}>
      <button onClick={() => setExpanded(v => !v)} className="w-full flex items-center justify-between px-4 py-3">
        <span style={{ ...typeStyle("p3"), color: color.textSecondary }}>{rateStr}</span>
        <div className="flex items-center gap-2">
          {hasValues && (
            <span onClick={e => { e.stopPropagation(); setRateFlipped(v => !v); }} style={{ lineHeight: 0, cursor: "pointer" }}>
              <ArrowUpDown size={11} color={color.textMuted} />
            </span>
          )}
          {expanded ? <ChevronUp size={12} color={color.textMuted} /> : <ChevronDown size={12} color={color.textMuted} />}
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4 grid gap-2.5">
          {[
            { label: "Fee",          value: hasValues ? `${feeAmt.toFixed(4)} ${inSym}` : "—", note: hasValues ? `${(fee / 10000).toFixed(2)}%` : undefined },
            { label: "Slippage",     value: `${slippage}%` },
            { label: "Min received", value: hasValues ? `${minOut.toFixed(4)} ${outSym}` : "—" },
            { label: "Route",        value: "Direct" },
          ].map(r => (
            <div key={r.label} className="flex items-center justify-between">
              <span style={{ ...typeStyle("p3"), color: color.textMuted }}>{r.label}</span>
              <span style={{ ...typeStyle("p3"), color: color.textSecondary }}>
                {r.value}
                {r.note && <span style={{ color: color.textMuted, marginLeft: 4 }}>({r.note})</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main widget ──────────────────────────────────────────────────────────────

export function SwapWidget() {
  const [tokenIn,      setTokenIn]      = useState(0);
  const [tokenOut,     setTokenOut]     = useState(1);
  const [amountIn,     setAmountIn]     = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [deadline,     setDeadline]     = useState(10);
  const [slippage,     setSlippage]     = useState(0.5);

  const { address, isConnected } = useAccount();
  const { connect }              = useConnect();
  const { writeContract, isPending } = useWriteContract();

  const { pool } = usePool(POOL_ADDRESS);
  const tokens   = pool?.tokens ?? [];
  const tokenAddrs = tokens.map(t => t.address as Address);

  const { balances, refetch: refetchBalances } = useTokenBalances(tokenAddrs, address);
  const { allowances, refetch: refetchAllowances } = useTokenAllowances(tokenAddrs, address, ROUTER_ADDRESS);

  const tokensWithBalance = tokens.map((t, i) => ({ ...t, balance: balances[i] ?? 0 }));

  const numIn = parseFloat(amountIn) || 0;
  const fee   = pool?.fee ?? 500;

  const amtInBig = numIn > 0 ? BigInt(Math.floor(numIn * 1e18)) : 0n;

  const { data: quoteData } = useSimulateContract({
    address:      QUOTER_ADDRESS,
    abi:          QUOTER_ABI,
    functionName: "quoteExactInput",
    args:         [POOL_ADDRESS, BigInt(tokenIn), BigInt(tokenOut), amtInBig],
    query:        { enabled: numIn > 0 && tokenIn !== tokenOut },
  });

  const amountOut    = quoteData?.result ? Number(quoteData.result as bigint) / 1e18 : 0;
  const amountOutStr = amountOut > 0 ? amountOut.toFixed(5) : "";

  const inBalance      = tokensWithBalance[tokenIn]?.balance ?? 0;
  const isInsufficient = numIn > inBalance;
  const needsApproval  = isConnected && address
    ? (allowances[tokenIn] ?? 0n) < BigInt(Math.floor(numIn * 1e18))
    : false;

  const boundaryCount = pool?.kBound ? 1 : 0;
  const healthLabel   = boundaryCount === 0 ? "All pegged" : "Boundary tick";

  const flip = useCallback(() => {
    const prev = amountOut;
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    setAmountIn(prev > 0 ? prev.toFixed(5) : "");
  }, [tokenIn, tokenOut, amountOut]);

  const handleInSelect  = useCallback((idx: number) => { if (idx === tokenOut) flip(); else setTokenIn(idx); }, [tokenIn, tokenOut, flip]);
  const handleOutSelect = useCallback((idx: number) => { if (idx === tokenIn)  flip(); else setTokenOut(idx); }, [tokenIn, tokenOut, flip]);

  function handleApprove() {
    if (!address) return;
    writeContract(
      { address: tokenAddrs[tokenIn], abi: ERC20_ABI, functionName: "approve", args: [ROUTER_ADDRESS, maxUint256] },
      { onSuccess: () => refetchAllowances() }
    );
  }

  function handleSwap() {
    if (!address || !pool) return;
    const amtIn    = amtInBig;
    const amtMin   = amountOut > 0
      ? BigInt(Math.floor(amountOut * (1 - slippage / 100) * 1e18))
      : 0n;
    const dl       = BigInt(Math.floor(Date.now() / 1000) + deadline * 60);
    writeContract(
      {
        address: ROUTER_ADDRESS,
        abi: ROUTER_ABI,
        functionName: "exactInput",
        args: [{
          pool:         POOL_ADDRESS,
          assetIn:      BigInt(tokenIn),
          assetOut:     BigInt(tokenOut),
          amountIn:     amtIn,
          amountOutMin: amtMin,
          recipient:    address,
          deadline:     dl,
        }],
      },
      { onSuccess: () => { setAmountIn(""); refetchBalances(); } }
    );
  }

  const btnLabel = !isConnected
    ? "Connect Wallet"
    : numIn <= 0
    ? "Enter an amount"
    : isInsufficient
    ? `Insufficient ${tokensWithBalance[tokenIn]?.symbol ?? ""}`
    : needsApproval
    ? `Approve ${tokensWithBalance[tokenIn]?.symbol ?? ""}`
    : isPending
    ? "Submitting…"
    : "Swap";

  const btnDisabled = isConnected && (numIn <= 0 || isInsufficient || isPending);

  function handleBtn() {
    if (!isConnected) { connect({ connector: injected() }); return; }
    if (needsApproval) { handleApprove(); return; }
    handleSwap();
  }

  return (
    <div className="flex flex-col h-full border"  style={{ border: `1px solid ${color.border}`,backgroundColor: color.surface1, width: "100%" }}>
      {/* Pool status bar */}
      <div className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: `1px solid ${color.borderSubtle}`, backgroundColor: color.surface2 }}>
        <div className="flex items-center gap-2.5 flex-wrap">
          {tokens.map(t => (
            <span key={t.address} className="flex items-center gap-1">
              <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: t.color, display: "inline-block" }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.04em", color: color.textMuted }}>{t.symbol}</span>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: color.textMuted }}>
            {(fee / 10000).toFixed(2)}%
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: boundaryCount === 0 ? color.success : color.warning }}>
            {boundaryCount === 0 ? "● " : "◐ "}{healthLabel}
          </span>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${color.borderSubtle}` }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase" as const, color: color.textPrimary }}>
          Swap
        </span>
        <button onClick={() => setShowSettings(v => !v)} style={{ color: showSettings ? color.accent : color.textMuted, lineHeight: 0, cursor: "pointer" }}>
          <Settings size={14} strokeWidth={1.5} />
        </button>
      </div>

      {showSettings && (
        <SettingsPanel slippage={slippage} setSlippage={setSlippage} deadline={deadline} setDeadline={setDeadline} onClose={() => setShowSettings(false)} />
      )}

      <div className="flex-1 min-h-0 overflow-y-auto">
        {tokens.length > 0 ? (
          <>
            <TokenBox
              mode="in" token={tokensWithBalance[tokenIn] ?? { symbol: "…", address: "0x", color: "#888", balance: 0 }}
              tokenIdx={tokenIn} otherIdx={tokenOut} tokens={tokensWithBalance}
              value={amountIn} onChange={setAmountIn} onTokenSelect={handleInSelect}
              isConnected={isConnected}
            />
            <div className="flex items-center justify-center py-1"
              style={{ borderTop: `1px solid ${color.borderSubtle}`, borderBottom: `1px solid ${color.borderSubtle}` }}>
              <button onClick={flip} className="flex items-center justify-center w-8 h-8"
                style={{ border: `1px solid ${color.border}`, backgroundColor: color.surface1, cursor: "pointer" }}>
                <ArrowDown size={13} color={color.textMuted} />
              </button>
            </div>
            <TokenBox
              mode="out" token={tokensWithBalance[tokenOut] ?? { symbol: "…", address: "0x", color: "#888", balance: 0 }}
              tokenIdx={tokenOut} otherIdx={tokenIn} tokens={tokensWithBalance}
              value={amountOutStr} onTokenSelect={handleOutSelect}
              isConnected={isConnected}
            />
            {numIn > 0 && amountOut > 0 && <SwapInfoPanel tokenIn={tokenIn} tokenOut={tokenOut} tokens={tokens} numIn={numIn} amountOut={amountOut} slippage={slippage} fee={fee} />}
          </>
        ) : (
          <div className="px-4 py-6" style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: color.textMuted }}>
            Loading pool…
          </div>
        )}
      </div>

      <div className="p-4">
        <button
          disabled={btnDisabled}
          onClick={handleBtn}
          className="w-full py-3.5"
          style={{
            backgroundColor: isInsufficient ? color.surface3 : numIn <= 0 && isConnected ? color.surface2 : color.textPrimary,
            color: isInsufficient ? color.error : numIn <= 0 && isConnected ? color.textMuted : color.bg,
            fontFamily: typography.p1.family, fontSize: typography.p1.size, fontWeight: 500,
            letterSpacing: "-0.01em", cursor: btnDisabled ? "not-allowed" : "pointer",
          }}
        >
          {btnLabel}
        </button>
      </div>
    </div>
  );
}
