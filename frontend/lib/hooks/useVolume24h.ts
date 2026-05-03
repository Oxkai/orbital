"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { parseAbiItem, type AbiEvent } from "viem";
import { POOL_ADDRESS, DEPLOY_BLOCK } from "@/lib/contracts";

const WAD = 1e18;
const SECONDS_PER_DAY = 86_400;

const SWAP_EVENT = parseAbiItem(
  "event Swap(address indexed sender, address indexed recipient, uint256 assetIn, uint256 assetOut, uint256 amountIn, uint256 amountOut)"
) as AbiEvent;

export function useVolume24h(fee: number) {
  const client = usePublicClient();
  const [volume24h, setVolume24h] = useState(0);
  const [fees24h,   setFees24h]   = useState(0);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;

    async function load() {
      try {
        // Two calls: latest block + a block ~1000 blocks back to measure actual block time
        const latest    = await client!.getBlockNumber();
        const [blkNow, blkOld] = await Promise.all([
          client!.getBlock({ blockNumber: latest }),
          client!.getBlock({ blockNumber: latest - 1000n > DEPLOY_BLOCK ? latest - 1000n : DEPLOY_BLOCK }),
        ]);

        // Derive actual seconds-per-block from these two samples
        const blockSpan = Number(blkNow.number! - blkOld.number!);
        const timeSpan  = Number(blkNow.timestamp - blkOld.timestamp);
        const secsPerBlock = blockSpan > 0 ? timeSpan / blockSpan : 2;

        const blocksIn24h = BigInt(Math.ceil(SECONDS_PER_DAY / secsPerBlock));
        const fromBlock   = latest - blocksIn24h > DEPLOY_BLOCK
          ? latest - blocksIn24h
          : DEPLOY_BLOCK;

        const logs = await client!.getLogs({
          address:   POOL_ADDRESS,
          event:     SWAP_EVENT,
          fromBlock,
          toBlock:   latest,
        });

        if (cancelled) return;

        let vol = 0;
        for (const log of logs) {
          const { amountIn } = log.args as { amountIn: bigint };
          vol += Number(amountIn) / WAD;
        }

        setVolume24h(vol);
        setFees24h(vol * fee / 1_000_000);
      } catch (e) {
        console.warn("[useVolume24h]", e);
      }
    }

    load();
    const interval = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [client, fee]);

  return { volume24h, fees24h };
}
