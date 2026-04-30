"use client";

import { useEffect, useState } from "react";
import { usePublicClient, useReadContracts } from "wagmi";
import { type Address, parseAbiItem, zeroAddress } from "viem";
import { PM_ADDRESS, PM_ABI, POOL_ABI, DEPLOY_BLOCK } from "@/lib/contracts";
import { baseSepolia } from "wagmi/chains";

export type OnChainPosition = {
  tokenId: bigint;
  poolAddress: Address;
  tickIndex: number;
  kWad: bigint;
  rWad: bigint;
};

const WAD = 1e18;
const CHUNK = 9_000n;

const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
);

export function usePositions(account: Address | undefined) {
  const publicClient = usePublicClient({ chainId: baseSepolia.id });
  const [tokenIds, setTokenIds] = useState<bigint[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Scan all blocks in 9k-block chunks to find mint Transfer events for account
  useEffect(() => {
    if (!account || !publicClient) { setTokenIds([]); return; }
    let cancelled = false;
    setLogsLoading(true);

    async function scan() {
      const latest = await publicClient!.getBlockNumber();
      const ids: bigint[] = [];

      for (let from = DEPLOY_BLOCK; from <= latest; from += CHUNK) {
        if (cancelled) return;
        const to = from + CHUNK - 1n < latest ? from + CHUNK - 1n : latest;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const logs: any[] = await publicClient!.getLogs({
          address: PM_ADDRESS,
          event: TRANSFER_EVENT,
          args: { from: zeroAddress, to: account },
          fromBlock: from,
          toBlock: to,
        });
        for (const l of logs) {
          if (l.args.tokenId) ids.push(l.args.tokenId);
        }
      }

      if (!cancelled) setTokenIds(ids);
    }

    scan().catch(() => {
      if (!cancelled) setTokenIds([]);
    }).finally(() => {
      if (!cancelled) setLogsLoading(false);
    });

    return () => { cancelled = true; };
  }, [account, publicClient]);

  // Read position data for each tokenId
  const positionReads = useReadContracts({
    contracts: tokenIds.map(id => ({
      address: PM_ADDRESS,
      abi: PM_ABI,
      functionName: "positions" as const,
      args: [id] as const,
    })),
    query: { enabled: tokenIds.length > 0 },
  });

  // Verify ownership (filter out transferred/burned)
  const ownerReads = useReadContracts({
    contracts: tokenIds.map(id => ({
      address: PM_ADDRESS,
      abi: PM_ABI,
      functionName: "ownerOf" as const,
      args: [id] as const,
    })),
    query: { enabled: tokenIds.length > 0 },
  });

  const positions: OnChainPosition[] = tokenIds
    .map((id, i) => {
      const owner = ownerReads.data?.[i]?.result as Address | undefined;
      if (owner?.toLowerCase() !== account?.toLowerCase()) return null;

      const pos = positionReads.data?.[i]?.result as readonly [Address, bigint, bigint, bigint] | undefined;
      if (!pos) return null;

      return {
        tokenId:     id,
        poolAddress: pos[0],
        tickIndex:   Number(pos[1]),
        kWad:        pos[2],
        rWad:        pos[3],
      };
    })
    .filter(Boolean) as OnChainPosition[];

  return {
    positions,
    isLoading: logsLoading || positionReads.isLoading || ownerReads.isLoading,
    refetch: () => { positionReads.refetch(); ownerReads.refetch(); },
  };
}

// Read tick isInterior for a given pool + tickIndex
export function useTickStatus(poolAddress: Address, tickIndex: number, enabled = true) {
  const { data } = useReadContracts({
    contracts: [{
      address: poolAddress,
      abi: POOL_ABI,
      functionName: "ticks" as const,
      args: [BigInt(tickIndex)] as const,
    }],
    query: { enabled },
  });

  const raw = data?.[0]?.result as readonly [bigint, bigint, boolean, bigint, bigint] | undefined;
  return {
    kWad:       raw?.[0] ?? 0n,
    rWad:       raw?.[1] ?? 0n,
    isInterior: raw?.[2] ?? true,
  };
}

export function fmtWad(n: bigint): string {
  const v = Number(n) / WAD;
  if (v >= 1_000_000) return "$" + (v / 1_000_000).toFixed(2) + "M";
  if (v >= 1_000)     return "$" + (v / 1_000).toFixed(1) + "K";
  return "$" + v.toFixed(2);
}
