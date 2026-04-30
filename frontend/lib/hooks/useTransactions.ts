"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { usePublicClient } from "wagmi";
import { parseAbiItem, type Address, type AbiEvent } from "viem";
import { POOL_ADDRESS, TOKEN_META, DEPLOY_BLOCK } from "@/lib/contracts";
const CHUNK        = 9_000n;
const PAGE_SIZE    = 20;
const DELAY_MS     = 150;

const WAD = 1e18;
function fmt(raw: bigint) { return (Number(raw) / WAD).toFixed(2); }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export type TxType = "Swap" | "Add" | "Remove" | "Collect";

export interface TxRecord {
  type:        TxType;
  hash:        `0x${string}`;
  blockNumber: bigint;
  timestamp:   number;   // unix seconds
  actor:       Address;
  amountIn:    string;   // e.g. "100.00 USDC"
  amountOut:   string;   // e.g. "99.98 USDT"  (empty for non-swap)
}

const SWAP_EVENT    = parseAbiItem("event Swap(address indexed sender, address indexed recipient, uint256 assetIn, uint256 assetOut, uint256 amountIn, uint256 amountOut)") as AbiEvent;
const MINT_EVENT    = parseAbiItem("event Mint(address indexed recipient, uint256 kWad, uint256 rWad, uint256[] amounts)") as AbiEvent;
const BURN_EVENT    = parseAbiItem("event Burn(address indexed owner, uint256 indexed tickIndex, uint256 rWad, uint256[] amounts)") as AbiEvent;
const COLLECT_EVENT = parseAbiItem("event Collect(address indexed owner, uint256 indexed tickIndex, uint256[] fees)") as AbiEvent;

async function fetchTimestamps(
  client: ReturnType<typeof usePublicClient>,
  blockNumbers: bigint[],
): Promise<Map<bigint, number>> {
  const unique = [...new Set(blockNumbers)];
  const results = await Promise.all(
    unique.map(n => client!.getBlock({ blockNumber: n, includeTransactions: false }))
  );
  const map = new Map<bigint, number>();
  results.forEach(b => { if (b.timestamp) map.set(b.number!, Number(b.timestamp)); });
  return map;
}

// Scan one 9k-block range, return raw records (no timestamps yet)
async function fetchChunk(
  client: ReturnType<typeof usePublicClient>,
  from: bigint,
  to: bigint,
  tokenSym: (i: number) => string,
): Promise<Omit<TxRecord, "timestamp">[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [s, m, b, c]: any[][] = await Promise.all([
    client!.getLogs({ address: POOL_ADDRESS, event: SWAP_EVENT,    fromBlock: from, toBlock: to }),
    client!.getLogs({ address: POOL_ADDRESS, event: MINT_EVENT,    fromBlock: from, toBlock: to }),
    client!.getLogs({ address: POOL_ADDRESS, event: BURN_EVENT,    fromBlock: from, toBlock: to }),
    client!.getLogs({ address: POOL_ADDRESS, event: COLLECT_EVENT, fromBlock: from, toBlock: to }),
  ]);

  const records: Omit<TxRecord, "timestamp">[] = [];

  for (const log of s) {
    const a = log.args as { sender: Address; assetIn: bigint; assetOut: bigint; amountIn: bigint; amountOut: bigint };
    records.push({ type: "Swap", hash: log.transactionHash, blockNumber: log.blockNumber, actor: a.sender,
      amountIn:  `${fmt(a.amountIn)} ${tokenSym(Number(a.assetIn))}`,
      amountOut: `${fmt(a.amountOut)} ${tokenSym(Number(a.assetOut))}` });
  }
  for (const log of m) {
    const a = log.args as { recipient: Address; rWad: bigint };
    records.push({ type: "Add", hash: log.transactionHash, blockNumber: log.blockNumber, actor: a.recipient,
      amountIn: `$${fmt(a.rWad)}`, amountOut: "" });
  }
  for (const log of b) {
    const a = log.args as { owner: Address; tickIndex: bigint; rWad: bigint };
    records.push({ type: "Remove", hash: log.transactionHash, blockNumber: log.blockNumber, actor: a.owner,
      amountIn: `$${fmt(a.rWad)} tick #${a.tickIndex}`, amountOut: "" });
  }
  for (const log of c) {
    const a = log.args as { owner: Address; tickIndex: bigint };
    records.push({ type: "Collect", hash: log.transactionHash, blockNumber: log.blockNumber, actor: a.owner,
      amountIn: `tick #${a.tickIndex}`, amountOut: "" });
  }

  return records;
}

export function useTransactions(poolTokens: { symbol: string; address: string }[]) {
  const client = usePublicClient();
  const [txs, setTxs]                   = useState<TxRecord[]>([]);
  const [isLoading, setIsLoading]       = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore]           = useState(true);
  const [error, setError]               = useState<string | null>(null);

  // cursor: the next "toBlock" to scan (scanning backwards)
  const cursorRef = useRef<bigint | null>(null);

  const tokenSym = useCallback((idx: number) =>
    poolTokens[idx]?.symbol ??
    TOKEN_META[poolTokens[idx]?.address?.toLowerCase() ?? ""]?.symbol ??
    `Asset#${idx}`,
  [poolTokens]);

  // Scan backwards from `startBlock`, collect up to `limit` records
  const scanBack = useCallback(async (startBlock: bigint, limit: number) => {
    const accumulated: Omit<TxRecord, "timestamp">[] = [];
    let to = startBlock;

    while (accumulated.length < limit && to >= DEPLOY_BLOCK) {
      const from = to - CHUNK + 1n < DEPLOY_BLOCK ? DEPLOY_BLOCK : to - CHUNK + 1n;
      const chunk = await fetchChunk(client!, from, to, tokenSym);
      accumulated.unshift(...chunk); // prepend so latest-first after reverse
      to = from - 1n;
      if (from === DEPLOY_BLOCK) break;
      if (accumulated.length < limit) await sleep(DELAY_MS);
    }

    // Sort newest first, take limit
    accumulated.sort((a, b) => (a.blockNumber < b.blockNumber ? 1 : -1));
    const page = accumulated.slice(0, limit);

    // Attach timestamps
    const tsMap = await fetchTimestamps(client!, page.map(r => r.blockNumber));
    const withTs: TxRecord[] = page.map(r => ({ ...r, timestamp: tsMap.get(r.blockNumber) ?? 0 }));

    return { records: withTs, nextCursor: to >= DEPLOY_BLOCK ? to : null };
  }, [client, tokenSym]);

  // Initial load
  useEffect(() => {
    if (!client || poolTokens.length === 0) return;
    let cancelled = false;

    async function init() {
      setIsLoading(true);
      setError(null);
      try {
        const latest = await client!.getBlockNumber();
        const { records, nextCursor } = await scanBack(latest, PAGE_SIZE);
        if (cancelled) return;
        setTxs(records);
        cursorRef.current = nextCursor;
        setHasMore(nextCursor !== null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, poolTokens.length]);

  // Load more (called on scroll)
  const loadMore = useCallback(async () => {
    if (!cursorRef.current || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const { records, nextCursor } = await scanBack(cursorRef.current, PAGE_SIZE);
      setTxs(prev => [...prev, ...records]);
      cursorRef.current = nextCursor;
      setHasMore(nextCursor !== null);
    } catch {
      // silently ignore pagination errors
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, scanBack]);

  return { txs, isLoading, isLoadingMore, hasMore, loadMore, error };
}
