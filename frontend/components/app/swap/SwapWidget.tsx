"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Settings, ArrowDown, ArrowUpDown, ChevronDown, ChevronUp, X, Check } from "lucide-react";
import { TokenDAI, TokenUSDT, TokenUSDC, TokenFRAX } from "@token-icons/react";
import { useAccount, useWriteContract, useSimulateContract, useWaitForTransactionReceipt } from "wagmi";
import { injected } from "wagmi/connectors";
import { useConnect } from "wagmi";
import { type Address, type Hash, maxUint256 } from "viem";
import { color, typography, typeStyle } from "@/constants";
import { usePool } from "@/lib/hooks/usePool";
import { useTokenBalances, useTokenAllowances } from "@/lib/hooks/useTokenBalances";
import { POOL_ADDRESS, QUOTER_ADDRESS, ROUTER_ADDRESS, ERC20_ABI, ROUTER_ABI, QUOTER_ABI } from "@/lib/contracts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TOKEN_ICON_MAP: Record<string, React.ComponentType<any>> = {
  DAI:  TokenDAI,
  USDT: TokenUSDT,
  USDC: TokenUSDC,
  FRAX: TokenFRAX,
};
const TOKEN_COLOR_MAP: Record<string, string> = {
  CRVUSD: "#FF6B35",
};

function TokenIcon({ symbol, size = 20 }: { symbol: string; size?: number }) {
  const Icon = TOKEN_ICON_MAP[symbol.toUpperCase()];
  if (Icon) return <Icon size={size} variant="branded" />;
  const bg = TOKEN_COLOR_MAP[symbol.toUpperCase()] ?? "#555";
  return (
    <span style={{ width: size, height: size, borderRadius: "50%", backgroundColor: bg, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: Math.max(6, size * 0.38), color: "#fff", fontFamily: "var(--font-mono)", fontWeight: 700 }}>
      {symbol.slice(0, 2).toUpperCase()}
    </span>
  );
}

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
          <TokenIcon symbol={token.symbol} size={18} />
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
            <TokenIcon symbol={token.symbol} size={18} />
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
    <div className="p-4" style={{ backgroundColor: color.surface1 }}>
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
    <div>
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
  const [swapResult,   setSwapResult]   = useState<{ success: boolean; hash?: string; msg: string } | null>(null);
  const [pendingHash,  setPendingHash]  = useState<Hash | undefined>(undefined);
  const resultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { address, isConnected } = useAccount();
  const { connect }              = useConnect();
  const { writeContract, isPending } = useWriteContract();

  function showResult(result: { success: boolean; hash?: string; msg: string }) {
    if (resultTimer.current) clearTimeout(resultTimer.current);
    setSwapResult(result);
    resultTimer.current = setTimeout(() => setSwapResult(null), 5000);
  }

  const { pool, refetch: refetchPool } = usePool(POOL_ADDRESS);
  const tokens   = pool?.tokens ?? [];
  const tokenAddrs = tokens.map(t => t.address as Address);

  const { balances, refetch: refetchBalances } = useTokenBalances(tokenAddrs, address);
  const { allowances, refetch: refetchAllowances } = useTokenAllowances(tokenAddrs, address, ROUTER_ADDRESS);

  const { isSuccess: txConfirmed } = useWaitForTransactionReceipt({
    hash: pendingHash,
    query: { enabled: !!pendingHash },
  });

  useEffect(() => {
    if (!txConfirmed) return;
    setPendingHash(undefined);
    refetchPool();
    refetchBalances();
    refetchAllowances();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txConfirmed]);

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
      {
        onSuccess: (hash) => {
          refetchAllowances();
          showResult({ success: true, hash, msg: `${tokensWithBalance[tokenIn]?.symbol ?? "Token"} approved` });
        },
        onError: (e) => showResult({ success: false, msg: e.message.split("\n")[0] }),
      }
    );
  }

  function handleSwap() {
    if (!address || !pool) return;
    const inSym  = tokensWithBalance[tokenIn]?.symbol  ?? "";
    const outSym = tokensWithBalance[tokenOut]?.symbol ?? "";
    const amtIn  = amtInBig;
    const amtMin = amountOut > 0
      ? BigInt(Math.floor(amountOut * (1 - slippage / 100) * 1e18))
      : 0n;
    const dl     = BigInt(Math.floor(Date.now() / 1000) + deadline * 60);
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
      {
        onSuccess: (hash) => {
          setAmountIn("");
          setPendingHash(hash);
          showResult({ success: true, hash, msg: `Swapped ${numIn.toFixed(4)} ${inSym} → ${amountOut.toFixed(4)} ${outSym}` });
        },
        onError: (e) => showResult({ success: false, msg: e.message.split("\n")[0] }),
      }
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
    <div className="flex flex-col h-full" style={{  backgroundColor: color.surface1, width: "100%", position: "relative" }}>

      {/* corner brackets */}
      {([
        { top: -1, left: -1,     borderTop: `2px solid ${color.textPrimary}`, borderLeft:  `2px solid ${color.textPrimary}` },
        { top: -1, right: -1,    borderTop: `2px solid ${color.textPrimary}`, borderRight: `2px solid ${color.textPrimary}` },
        { bottom: -1, left: -1,  borderBottom: `2px solid ${color.textPrimary}`, borderLeft:  `2px solid ${color.textPrimary}` },
        { bottom: -1, right: -1, borderBottom: `2px solid ${color.textPrimary}`, borderRight: `2px solid ${color.textPrimary}` },
      ] as React.CSSProperties[]).map((s, i) => (
        <div key={i} style={{ position: "absolute", width: 18, height: 18, ...s }} />
      ))}

      {/* Header — breadcrumb + pills + settings */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${color.borderSubtle}` }}>
        <div className="flex items-center gap-2">
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.06em", color: color.textMuted }}>Pool</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: color.textMuted }}>/</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.06em", fontWeight: 700, color: color.textSecondary }}>Swap</span>
        </div>
        <div className="flex items-center gap-2">
          {/* fee pill */}
          {/* status pill */}
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase" as const, color: boundaryCount === 0 ? "#8AE06C" : color.warning, backgroundColor: boundaryCount === 0 ? "#8AE06C12" : `${color.warning}12`, padding: "2px 8px" }}>
            {boundaryCount === 0 ? "● All pegged" : "◐ Boundary"}
          </span>
          <button onClick={() => setShowSettings(v => !v)} style={{ lineHeight: 0, cursor: "pointer", marginLeft: 2 }}>
            <Settings size={13} strokeWidth={1.5} color={showSettings ? color.textPrimary : color.textMuted} />
          </button>
        </div>
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
            <div className="flex items-center justify-center py-1">
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

      {/* Modal overlay */}
      {swapResult && (() => {
        const accentHex  = swapResult.success ? color.textPrimary : "#F56868";
        // msg format: "Swapped 10.0000 DAI → 9.9950 USDT"
        const halves     = swapResult.msg.replace("Swapped ", "").split(" → ");
        const [inAmt = "", inSym = ""]   = (halves[0] ?? "").split(" ");
        const [outAmt = "", outSym = ""] = (halves[1] ?? "").split(" ");
        const SEGMENTS   = 24;
        const filledSegs = swapResult.success ? SEGMENTS : Math.floor(SEGMENTS * 0.35);
        const M          = { fontFamily: "var(--font-mono)" as const };

        return (
          <>
            {/* backdrop with sparse grid lines like reference */}
            <div onClick={() => setSwapResult(null)} style={{
              position: "fixed", inset: 0, zIndex: 9998,
              backgroundColor: "rgba(0,0,0,0.82)",
              backgroundImage: `linear-gradient(${color.border}28 1px, transparent 1px), linear-gradient(90deg, ${color.border}28 1px, transparent 1px)`,
              backgroundSize: "80px 80px",
            }} />

            {/* panel */}
            <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 9999, width: 440, backgroundColor: color.surface1, boxShadow: "0 24px 80px rgba(0,0,0,0.7)" }}>

              {/* corner brackets */}
              {([
                { top: -1, left: -1,      borderTop: `2px solid ${accentHex}`,    borderLeft:  `2px solid ${accentHex}` },
                { top: -1, right: -1,     borderTop: `2px solid ${accentHex}`,    borderRight: `2px solid ${accentHex}` },
                { bottom: -1, left: -1,   borderBottom: `2px solid ${accentHex}`, borderLeft:  `2px solid ${accentHex}` },
                { bottom: -1, right: -1,  borderBottom: `2px solid ${accentHex}`, borderRight: `2px solid ${accentHex}` },
              ] as React.CSSProperties[]).map((s, i) => (
                <div key={i} style={{ position: "absolute", width: 20, height: 20, ...s }} />
              ))}

              {/* breadcrumb header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 20px", borderBottom: `1px solid ${color.borderSubtle}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ ...M, fontSize: "10px", letterSpacing: "0.06em", color: color.textMuted }}>Swap</span>
                  <span style={{ ...M, fontSize: "10px", color: color.textMuted }}>/</span>
                  <span style={{ ...M, fontSize: "10px", letterSpacing: "0.04em", fontWeight: 600, color: color.textSecondary }}>
                    {swapResult.success ? "Transaction confirmed" : "Transaction failed"}
                  </span>
                </div>
                <span style={{ ...M, fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase" as const, color: accentHex, backgroundColor: `${accentHex}15`, padding: "3px 9px" }}>
                  {swapResult.success ? "Confirmed" : "Failed"}
                </span>
              </div>

              {/* swap flow */}
              <div style={{ padding: "24px 20px 20px", display: "flex", alignItems: "center", gap: 12 }}>
                {/* from */}
                <div style={{ flex: 1 }}>
                  <div style={{ ...M, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase" as const, color: color.textMuted, marginBottom: 10 }}>From</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {(() => { const I = TOKEN_ICON_MAP[inSym.toUpperCase()]; return I ? <I size={28} variant="branded" /> : <TokenIcon symbol={inSym} size={28} />; })()}
                    <div>
                      <div style={{ fontFamily: typography.h2.family, fontSize: "26px", fontWeight: 500, letterSpacing: "-0.03em", color: color.textPrimary, lineHeight: 1 }}>{inAmt}</div>
                      <div style={{ ...M, fontSize: "12px", letterSpacing: "0.06em", color: color.textMuted, marginTop: 4 }}>{inSym}</div>
                    </div>
                  </div>
                </div>

                {/* arrow */}
                <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 3, flexShrink: 0, paddingTop: 18 }}>
                  <div style={{ width: 28, height: 1, backgroundColor: color.border }} />
                  <div style={{ width: 0, height: 0, borderTop: "4px solid transparent", borderBottom: "4px solid transparent", borderLeft: `5px solid ${color.border}`, marginTop: -3 }} />
                </div>

                {/* to */}
                <div style={{ flex: 1, textAlign: "right" as const }}>
                  <div style={{ ...M, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase" as const, color: color.textMuted, marginBottom: 10 }}>To</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                    <div>
                      <div style={{ fontFamily: typography.h2.family, fontSize: "26px", fontWeight: 500, letterSpacing: "-0.03em", color: accentHex, lineHeight: 1 }}>{outAmt}</div>
                      <div style={{ ...M, fontSize: "12px", letterSpacing: "0.06em", color: color.textMuted, marginTop: 4 }}>{outSym}</div>
                    </div>
                    {(() => { const I = TOKEN_ICON_MAP[outSym.toUpperCase()]; return I ? <I size={28} variant="branded" /> : <TokenIcon symbol={outSym} size={28} />; })()}
                  </div>
                </div>
              </div>

              {/* success / error message */}
              <div style={{ margin: "0 20px 20px", padding: "10px 14px", backgroundColor: `${accentHex}10`, border: `1px solid ${accentHex}30`, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: accentHex, flexShrink: 0, display: "inline-block" }} />
                <span style={{ ...M, fontSize: "11px", letterSpacing: "0.03em", color: color.textSecondary }}>
                  {swapResult.success
                    ? `${inAmt} ${inSym} successfully swapped for ${outAmt} ${outSym} and deposited to your wallet.`
                    : swapResult.msg}
                </span>
              </div>

              {/* segmented progress bar */}
              <div style={{ display: "flex", gap: 2, padding: "0 20px 20px" }}>
                {Array.from({ length: SEGMENTS }).map((_, i) => (
                  <div key={i} style={{ flex: 1, height: 3, backgroundColor: i < filledSegs ? accentHex : color.surface3 }} />
                ))}
              </div>

              {/* divider */}
              <div style={{ height: 1, backgroundColor: color.borderSubtle }} />

              {/* footer */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px" }}>
                {swapResult.hash ? (
                  <a href={`https://sepolia.basescan.org/tx/${swapResult.hash}`} target="_blank" rel="noreferrer"
                    style={{ ...M, fontSize: "10px", letterSpacing: "0.04em", color: color.textMuted, textDecoration: "none", display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ color: color.textMuted }}>TX</span>
                    <span>{swapResult.hash.slice(0, 12)}…{swapResult.hash.slice(-6)}</span>
                    <span style={{ color: accentHex }}>↗</span>
                  </a>
                ) : <span />}
                <button onClick={() => setSwapResult(null)} style={{ ...M, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase" as const, color: color.textMuted, backgroundColor: "transparent", border: `1px solid ${color.border}`, padding: "5px 14px", cursor: "pointer" }}>
                  Dismiss
                </button>
              </div>

              {/* auto-dismiss bar */}
              <div style={{ height: 2, backgroundColor: color.surface3 }}>
                <div style={{ height: "100%", backgroundColor: accentHex, animation: "shrink 5s linear forwards" }} />
              </div>
              <style>{`@keyframes shrink { from { width: 100% } to { width: 0% } }`}</style>
            </div>
          </>
        );
      })()}
    </div>
  );
}
