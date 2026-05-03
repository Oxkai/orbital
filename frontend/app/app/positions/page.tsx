"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { color, typography } from "@/constants";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { usePool } from "@/lib/hooks/usePool";
import { usePositions, useTickStatus, fmtWad } from "@/lib/hooks/usePositions";
import { useTokenBalances, useTokenAllowances } from "@/lib/hooks/useTokenBalances";
import { fmtUSD } from "@/lib/mock/data";
import { POOL_ADDRESSES, PM_ADDRESS, PM_ABI, ERC20_ABI } from "@/lib/contracts";
import { type Address, type Hash, maxUint256 } from "viem";
import { TokenPill } from "@/components/app/shared/TokenPill";
import { Badge } from "@/components/app/shared/Badge";
import { IncreaseLiquidityModal } from "@/components/app/lp/IncreaseLiquidityModal";
import { DecreaseLiquidityModal } from "@/components/app/lp/DecreaseLiquidityModal";
import { CollectFeesModal }       from "@/components/app/lp/CollectFeesModal";
import { BurnPositionModal }      from "@/components/app/lp/BurnPositionModal";
import type { TokenAmount }       from "@/components/app/lp/IncreaseLiquidityModal";
import { X } from "lucide-react";

const WAD = 1e18;

function mono(size = "12px", col: string = color.textSecondary) {
  return { fontFamily: "var(--font-mono)" as const, fontSize: size, color: col as never };
}
function lbl() {
  return { ...mono("9px", color.textMuted), letterSpacing: "0.07em", textTransform: "uppercase" as const };
}

// ─── Discriminated result union ───────────────────────────────────────────────

type TxResult =
  | { kind: "increase"; hash: string; tokenId: bigint; amounts: TokenAmount[]; rWadAdded: number }
  | { kind: "decrease"; hash: string; tokenId: bigint; amounts: TokenAmount[]; rWadRemoved: number; rWadRemaining: number }
  | { kind: "collect";  hash: string; tokenId: bigint; fees: TokenAmount[] }
  | { kind: "burn";     hash: string; tokenId: bigint; tokens: TokenAmount[]; finalLiquidity: number }
  | { kind: "error";    title: string; msg: string };

// ─── Amount modal (Increase / Decrease) ──────────────────────────────────────

function AmountModal({ title, maxLabel, maxValue, onConfirm, onClose, isPending }: {
  title: string; maxLabel: string; maxValue: string;
  onConfirm: (amount: string) => void; onClose: () => void; isPending: boolean;
}) {
  const [val, setVal] = useState("");
  const num = parseFloat(val) || 0;
  const max = parseFloat(maxValue) || 0;
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9998, backgroundColor: "rgba(0,0,0,0.7)" }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 9999, width: 380, backgroundColor: color.surface1, border: `1px solid ${color.border}` }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${color.borderSubtle}` }}>
          <span style={mono("11px", color.textSecondary)}>{title}</span>
          <button onClick={onClose}><X size={13} color={color.textMuted} /></button>
        </div>
        <div className="p-4 flex flex-col gap-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span style={mono("10px", color.textMuted)}>USD amount</span>
              <button onClick={() => setVal(maxValue)} style={{ ...mono("9px", color.accent), border: `1px solid ${color.accent}44`, padding: "1px 6px", cursor: "pointer" }}>
                {maxLabel} {maxValue ? fmtUSD(parseFloat(maxValue)) : ""}
              </button>
            </div>
            <div className="flex items-baseline gap-2" style={{ border: `1px solid ${color.border}`, backgroundColor: color.surface2, padding: "10px 14px" }}>
              <span style={mono("16px", color.textMuted)}>$</span>
              <input type="text" inputMode="decimal" placeholder="0" value={val} autoFocus
                onChange={e => { if (/^\d*\.?\d*$/.test(e.target.value)) setVal(e.target.value); }}
                className="flex-1 bg-transparent outline-none"
                style={{ fontFamily: typography.h2.family, fontSize: "24px", letterSpacing: "-0.02em", color: val ? color.textPrimary : color.textMuted }}
              />
            </div>
          </div>
          <button disabled={num <= 0 || num > max + 0.001 || isPending} onClick={() => onConfirm(val)} className="w-full py-3"
            style={{ backgroundColor: num > 0 && num <= max + 0.001 && !isPending ? color.textPrimary : color.surface2, color: num > 0 && num <= max + 0.001 && !isPending ? color.bg : color.textMuted, fontFamily: typography.p2.family, fontSize: typography.p2.size, fontWeight: 500, cursor: num <= 0 || isPending ? "not-allowed" : "pointer" }}>
            {isPending ? "Submitting…" : "Confirm"}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Confirm modal (Collect / Burn) ──────────────────────────────────────────

function ConfirmModal({ title, body, confirmLabel, onConfirm, onClose, isPending, danger }: {
  title: string; body: string; confirmLabel: string;
  onConfirm: () => void; onClose: () => void; isPending: boolean; danger?: boolean;
}) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9998, backgroundColor: "rgba(0,0,0,0.7)" }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 9999, width: 360, backgroundColor: color.surface1, border: `1px solid ${color.border}` }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${color.borderSubtle}` }}>
          <span style={mono("11px", color.textSecondary)}>{title}</span>
          <button onClick={onClose}><X size={13} color={color.textMuted} /></button>
        </div>
        <div className="p-4 flex flex-col gap-4">
          <p style={mono("11px", color.textMuted)}>{body}</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2.5" style={{ border: `1px solid ${color.border}`, color: color.textMuted, fontFamily: typography.p2.family, fontSize: typography.p2.size, cursor: "pointer", backgroundColor: "transparent" }}>Cancel</button>
            <button disabled={isPending} onClick={onConfirm} className="flex-1 py-2.5"
              style={{ backgroundColor: danger ? color.error : color.textPrimary, color: color.bg, fontFamily: typography.p2.family, fontSize: typography.p2.size, fontWeight: 500, cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.6 : 1 }}>
              {isPending ? "Submitting…" : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Position row ─────────────────────────────────────────────────────────────

type ModalState = { type: "increase" } | { type: "decrease" } | { type: "collect" } | { type: "burn" } | null;

function PositionRow({
  tokenId, poolAddress, tickIndex, rWad, pool, onActionDone, onTxResult,
}: {
  tokenId: bigint; poolAddress: Address; tickIndex: number; rWad: bigint;
  pool: ReturnType<typeof usePool>["pool"];
  onActionDone: () => void;
  onTxResult: (r: TxResult) => void;
}) {
  const { address } = useAccount();
  const tick    = useTickStatus(poolAddress, tickIndex, !!pool);
  const rUSD    = fmtWad(rWad);
  const rNum    = Number(rWad) / WAD;

  const [modal,       setModal]       = useState<ModalState>(null);
  const [pendingHash, setPendingHash] = useState<Hash | undefined>();
  const [pendingKind, setPendingKind] = useState<"increase" | "decrease" | "collect" | "burn">("collect");
  // store the USD amounts typed by user to display in popup
  const [pendingUsd, setPendingUsd]   = useState(0);

  const { writeContract, isPending } = useWriteContract();

  const tokens     = pool?.tokens ?? [];
  const tokenAddrs = tokens.map(t => t.address as Address);
  const { allowances, refetch: refetchAllowances } = useTokenAllowances(tokenAddrs, address, PM_ADDRESS);
  const { balances } = useTokenBalances(tokenAddrs, address);
  // Maximum depositable USD = n * the smallest per-token balance (each token contributes equally)
  const n          = tokenAddrs.length || 1;
  const minBalance = balances.length > 0 ? Math.min(...balances) : 0;
  const walletUSD  = minBalance * n;

  const { isSuccess: txDone } = useWaitForTransactionReceipt({ hash: pendingHash, query: { enabled: !!pendingHash } });

  // Build equal-split token amounts array for display (real amounts from receipt decode not available client-side)
  function splitAmounts(totalUsd: number): TokenAmount[] {
    const perToken = totalUsd / n;
    return tokens.map(t => ({ symbol: t.symbol, color: t.color, amount: perToken }));
  }

  const handleTxDone = useCallback((hash: Hash) => {
    setPendingHash(undefined);
    setModal(null);
    onActionDone();

    if (pendingKind === "increase") {
      onTxResult({ kind: "increase", hash, tokenId, amounts: splitAmounts(pendingUsd), rWadAdded: pendingUsd });
    } else if (pendingKind === "decrease") {
      const remaining = Math.max(0, rNum - pendingUsd);
      onTxResult({ kind: "decrease", hash, tokenId, amounts: splitAmounts(pendingUsd), rWadRemoved: pendingUsd, rWadRemaining: remaining });
    } else if (pendingKind === "collect") {
      onTxResult({ kind: "collect", hash, tokenId, fees: splitAmounts(0) });
    } else if (pendingKind === "burn") {
      onTxResult({ kind: "burn", hash, tokenId, tokens: tokens.map(t => ({ symbol: t.symbol, color: t.color, amount: 0 })), finalLiquidity: rNum });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onActionDone, onTxResult, pendingKind, pendingUsd, rNum, tokenId, tokens]);

  useEffect(() => {
    if (txDone && pendingHash) handleTxDone(pendingHash);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txDone, pendingHash]);

  const deadline = () => BigInt(Math.floor(Date.now() / 1000) + 600);

  function handleIncrease(amountStr: string) {
    if (!address) return;
    const usd    = parseFloat(amountStr);
    const rWadNew = BigInt(Math.floor(usd * WAD));
    const amountsMin = Array(n).fill(rWadNew / BigInt(n) * 995n / 1000n);
    const needsApproval = tokenAddrs.findIndex((_, i) => (allowances[i] ?? 0n) < rWadNew / BigInt(n));
    if (needsApproval >= 0) {
      writeContract(
        { address: tokenAddrs[needsApproval], abi: ERC20_ABI, functionName: "approve", args: [PM_ADDRESS, maxUint256] },
        { onSuccess: () => refetchAllowances() }
      );
      return;
    }
    setPendingKind("increase");
    setPendingUsd(usd);
    writeContract(
      { address: PM_ADDRESS, abi: PM_ABI, functionName: "increaseLiquidity", args: [{ tokenId, rWad: rWadNew, amountsMin, deadline: deadline() }] },
      {
        onSuccess: (hash) => setPendingHash(hash),
        onError: (e) => { setModal(null); onTxResult({ kind: "error", title: "Increase liquidity", msg: e.message.split("\n")[0] }); },
      }
    );
  }

  function handleDecrease(amountStr: string) {
    if (!address) return;
    const usd    = parseFloat(amountStr);
    const rWadOut = BigInt(Math.floor(usd * WAD));
    const amountsMin = Array(n).fill(rWadOut / BigInt(n) * 995n / 1000n);
    setPendingKind("decrease");
    setPendingUsd(usd);
    writeContract(
      { address: PM_ADDRESS, abi: PM_ABI, functionName: "decreaseLiquidity", args: [{ tokenId, rWad: rWadOut, amountsMin, deadline: deadline() }] },
      {
        onSuccess: (hash) => setPendingHash(hash),
        onError: (e) => { setModal(null); onTxResult({ kind: "error", title: "Decrease liquidity", msg: e.message.split("\n")[0] }); },
      }
    );
  }

  function handleCollect() {
    if (!address) return;
    setPendingKind("collect");
    setPendingUsd(0);
    writeContract(
      { address: PM_ADDRESS, abi: PM_ABI, functionName: "collect", args: [{ tokenId, recipient: address }] },
      {
        onSuccess: (hash) => setPendingHash(hash),
        onError: (e) => { setModal(null); onTxResult({ kind: "error", title: "Collect fees", msg: e.message.split("\n")[0] }); },
      }
    );
  }

  function handleBurn() {
    if (!address) return;
    setPendingKind("burn");
    setPendingUsd(rNum);
    writeContract(
      { address: PM_ADDRESS, abi: PM_ABI, functionName: "burn", args: [tokenId] },
      {
        onSuccess: (hash) => setPendingHash(hash),
        onError: (e) => { setModal(null); onTxResult({ kind: "error", title: "Burn position", msg: e.message.split("\n")[0] }); },
      }
    );
  }

  return (
    <>
      <div style={{ backgroundColor: color.surface1, borderBottom: `1px solid ${color.border}` }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <span style={{ ...mono("10px", color.textMuted), backgroundColor: color.surface2, padding: "1px 6px" }}>
              #{tokenId.toString()}
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {pool?.tokens.map(tk => <TokenPill key={tk.address} token={tk} size="sm" />)}
            </div>
          </div>
          <Badge variant={tick.isInterior ? "success" : "warning"} dot>
            {tick.isInterior ? "Active" : "Paused"}
          </Badge>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3">
          {[
            { label: "Liquidity", value: rUSD },
            { label: "Tick",      value: `#${tickIndex}` },
            { label: "Status",    value: tick.isInterior ? "Earning fees" : "Paused", accent: tick.isInterior },
          ].map(s => (
            <div key={s.label} className="px-4 py-3" style={{ backgroundColor: color.surface1 }}>
              <div style={{ ...lbl(), marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontFamily: typography.h3.family, fontSize: "16px", fontWeight: 500, letterSpacing: "-0.02em", color: s.accent ? color.accent : color.textPrimary }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-4 py-3">
          {([
            { label: "Increase", onClick: () => setModal({ type: "increase" }) },
            { label: "Decrease", onClick: () => setModal({ type: "decrease" }), disabled: rNum <= 0 },
            { label: "Collect",  onClick: () => setModal({ type: "collect" }) },
            { label: "Burn",     onClick: () => setModal({ type: "burn" }), danger: true },
          ] as { label: string; onClick: () => void; disabled?: boolean; danger?: boolean }[]).map(btn => (
            <button key={btn.label} disabled={!!btn.disabled} onClick={btn.onClick}
              style={{
                backgroundColor: color.surface2,
                color: btn.danger ? color.error : btn.disabled ? color.textMuted : color.textSecondary,
                border: `1px solid ${btn.danger ? color.error + "44" : color.border}`,
                fontFamily: typography.p3.family, fontSize: typography.p3.size, letterSpacing: "-0.01em",
                padding: "6px 12px", cursor: btn.disabled ? "not-allowed" : "pointer", opacity: btn.disabled ? 0.4 : 1,
              }}>
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input modals */}
      {modal?.type === "increase" && (
        <AmountModal title={`Increase Position #${tokenId}`} maxLabel="Wallet" maxValue={walletUSD.toFixed(2)}
          onConfirm={handleIncrease} onClose={() => setModal(null)} isPending={isPending} />
      )}
      {modal?.type === "decrease" && (
        <AmountModal title={`Decrease Position #${tokenId}`} maxLabel="Max" maxValue={rNum.toFixed(2)}
          onConfirm={handleDecrease} onClose={() => setModal(null)} isPending={isPending} />
      )}
      {modal?.type === "collect" && (
        <ConfirmModal title={`Collect fees — Position #${tokenId}`}
          body="Collected fees will be sent to your wallet. Your liquidity position remains unchanged."
          confirmLabel="Collect fees" onConfirm={handleCollect} onClose={() => setModal(null)} isPending={isPending} />
      )}
      {modal?.type === "burn" && (
        <ConfirmModal title={`Burn Position #${tokenId}`}
          body="This permanently removes the position NFT. Decrease liquidity to zero and collect fees first."
          confirmLabel="Burn position" onConfirm={handleBurn} onClose={() => setModal(null)} isPending={isPending} danger />
      )}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PositionsPage() {
  const { address } = useAccount();

  // Load all known pools so each position row gets the right token metadata
  const poolHooks = POOL_ADDRESSES.map(addr => usePool(addr)); // eslint-disable-line react-hooks/rules-of-hooks
  const poolMap: Record<string, ReturnType<typeof usePool>["pool"]> = Object.fromEntries(
    POOL_ADDRESSES.map((addr, i) => [addr.toLowerCase(), poolHooks[i].pool])
  );
  // poolHooks is a new array each render; capture refetch fns in a ref so useCallback stays stable
  const poolRefetchsRef = useRef(poolHooks.map(h => h.refetch));
  poolRefetchsRef.current = poolHooks.map(h => h.refetch);
  const refetchPools = useCallback(() => { poolRefetchsRef.current.forEach(fn => fn()); }, []);

  const { positions, isLoading, refetch: refetchPositions } = usePositions(address);
  const [txResult, setTxResult] = useState<TxResult | null>(null);

  const totalR = positions.reduce((s, p) => s + Number(p.rWad), 0);

  const handleActionDone = useCallback(() => {
    refetchPools();
    refetchPositions();
  }, [refetchPools, refetchPositions]);

  return (
    <div className="flex flex-col overflow-hidden w-full" style={{ height: "calc(100vh - 5.5rem)" }}>
      <div className="flex-1 min-h-0 grid grid-cols-[80px_1fr_80px]" style={{ border: `1px solid ${color.border}` }}>

        {/* Left gutter */}
        <div style={{ backgroundImage: `repeating-linear-gradient(45deg, ${color.borderSubtle} 0, ${color.borderSubtle} 1px, transparent 0, transparent 50%)`, backgroundSize: "12px 12px", borderRight: `1px solid ${color.border}` }} />

        {/* Main column */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex items-end justify-between px-5 py-4 shrink-0" style={{ borderBottom: `1px solid ${color.border}` }}>
            <div>
              <h1 style={{ fontFamily: typography.h2.family, fontSize: typography.h2.size, fontWeight: 500, letterSpacing: typography.h2.letterSpacing, color: color.textPrimary }}>
                Positions
              </h1>
              <p style={{ fontFamily: typography.p2.family, fontSize: typography.p2.size, color: color.textMuted, marginTop: 4 }}>
                {!address ? "Connect wallet to view positions" : isLoading ? "Loading…"
                  : `${positions.length} position${positions.length !== 1 ? "s" : ""} · ${fmtUSD(totalR / 1e18)} total`}
              </p>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {!address ? (
              <div className="px-5 py-4" style={mono("12px", color.textMuted)}>Connect your wallet to see your positions.</div>
            ) : isLoading ? (
              <div className="px-5 py-4" style={mono("12px", color.textMuted)}>Fetching positions…</div>
            ) : positions.length === 0 ? (
              <div className="px-5 py-4" style={mono("12px", color.textMuted)}>No positions found. Add liquidity to get started.</div>
            ) : (
              <div className="flex flex-col">
                {positions.map(pos => (
                  <PositionRow
                    key={pos.tokenId.toString()}
                    tokenId={pos.tokenId}
                    poolAddress={pos.poolAddress}
                    tickIndex={pos.tickIndex}
                    rWad={pos.rWad}
                    pool={poolMap[pos.poolAddress.toLowerCase()] ?? null}
                    onActionDone={handleActionDone}
                    onTxResult={setTxResult}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right gutter */}
        <div style={{ backgroundImage: `repeating-linear-gradient(45deg, ${color.borderSubtle} 0, ${color.borderSubtle} 1px, transparent 0, transparent 50%)`, backgroundSize: "12px 12px", borderLeft: `1px solid ${color.border}` }} />
      </div>

      {/* Per-action result modals */}
      {txResult?.kind === "increase" && (
        <IncreaseLiquidityModal
          tokenId={txResult.tokenId} hash={txResult.hash}
          amounts={txResult.amounts} rWadAdded={txResult.rWadAdded}
          onClose={() => setTxResult(null)}
        />
      )}
      {txResult?.kind === "decrease" && (
        <DecreaseLiquidityModal
          tokenId={txResult.tokenId} hash={txResult.hash}
          amounts={txResult.amounts} rWadRemoved={txResult.rWadRemoved} rWadRemaining={txResult.rWadRemaining}
          onClose={() => setTxResult(null)}
        />
      )}
      {txResult?.kind === "collect" && (
        <CollectFeesModal
          tokenId={txResult.tokenId} hash={txResult.hash}
          fees={txResult.fees}
          onClose={() => setTxResult(null)}
        />
      )}
      {txResult?.kind === "burn" && (
        <BurnPositionModal
          tokenId={txResult.tokenId} hash={txResult.hash}
          tokens={txResult.tokens} finalLiquidity={txResult.finalLiquidity}
          onClose={() => setTxResult(null)}
        />
      )}

      {/* Error modal */}
      {txResult?.kind === "error" && (
        <>
          <div onClick={() => setTxResult(null)} style={{ position: "fixed", inset: 0, zIndex: 9998, backgroundColor: "rgba(0,0,0,0.75)" }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 9999, width: 380, backgroundColor: color.surface1, border: `1px solid ${color.error}44` }}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${color.borderSubtle}` }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: color.error }}>{txResult.title} failed</span>
              <button onClick={() => setTxResult(null)}><X size={13} color={color.textMuted} /></button>
            </div>
            <div className="px-4 py-4">
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: color.textMuted, lineHeight: 1.6, wordBreak: "break-word" as const }}>{txResult.msg}</p>
            </div>
            <div style={{ height: 2, backgroundColor: color.error, opacity: 0.4 }} />
          </div>
        </>
      )}
    </div>
  );
}
