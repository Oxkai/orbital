"use client";

import { useAccount, useWriteContract, useReadContract, useSimulateContract } from "wagmi";
import { ADDRESSES, ROUTER_ABI, QUOTER_ABI, ERC20_ABI, TOKEN_INDEX, WAD } from "@/constants/contracts";
import { parseUnits, formatUnits } from "viem";

export type SwapCoin = "USDC" | "DAI" | "FRAX" | "USDT";

export function useQuote(coinIn: SwapCoin, coinOut: SwapCoin, amountIn: string) {
  const amountInWad = amountIn && parseFloat(amountIn) > 0
    ? parseUnits(amountIn, 18)
    : 0n;

  const { data, isLoading } = useReadContract({
    address: ADDRESSES.quoter as `0x${string}`,
    abi: QUOTER_ABI,
    functionName: "quoteExactInput",
    args: [
      ADDRESSES.pool as `0x${string}`,
      BigInt(TOKEN_INDEX[coinIn]),
      BigInt(TOKEN_INDEX[coinOut]),
      amountInWad,
    ],
    query: {
      enabled: amountInWad > 0n,
      refetchInterval: 4000,
    },
  });

  return {
    amountOut: data ? formatUnits(data as bigint, 18) : "",
    isLoading,
  };
}

export function useAllowance(coinIn: SwapCoin, amountIn: string) {
  const { address } = useAccount();
  const tokenAddr = ADDRESSES.tokens[coinIn] as `0x${string}`;

  const { data: allowance } = useReadContract({
    address: tokenAddr,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [address!, ADDRESSES.router as `0x${string}`],
    query: { enabled: !!address },
  });

  const { data: balance } = useReadContract({
    address: tokenAddr,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [address!],
    query: { enabled: !!address },
  });

  const amountInWad = amountIn && parseFloat(amountIn) > 0
    ? parseUnits(amountIn, 18)
    : 0n;

  const needsApproval = allowance !== undefined && amountInWad > 0n
    ? (allowance as bigint) < amountInWad
    : false;

  return {
    needsApproval,
    balance: balance ? formatUnits(balance as bigint, 18) : "0",
  };
}

export function useApprove(coinIn: SwapCoin) {
  const { writeContractAsync, isPending } = useWriteContract();

  async function approve() {
    return writeContractAsync({
      address: ADDRESSES.tokens[coinIn] as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [ADDRESSES.router as `0x${string}`, WAD * 1_000_000n],
    });
  }

  return { approve, isPending };
}

export function useExactInput(
  coinIn: SwapCoin,
  coinOut: SwapCoin,
  amountIn: string,
  amountOutMin: string,
) {
  const { address } = useAccount();
  const { writeContractAsync, isPending, data: txHash } = useWriteContract();

  const amountInWad    = amountIn    && parseFloat(amountIn)    > 0 ? parseUnits(amountIn,    18) : 0n;
  const amountOutMinWad = amountOutMin && parseFloat(amountOutMin) > 0 ? parseUnits(amountOutMin, 18) : 0n;
  // 1% slippage on amountOut
  const slippedOut = amountOutMinWad * 99n / 100n;

  async function swap() {
    if (!address || amountInWad === 0n) return;
    return writeContractAsync({
      address: ADDRESSES.router as `0x${string}`,
      abi: ROUTER_ABI,
      functionName: "exactInput",
      args: [{
        pool:         ADDRESSES.pool as `0x${string}`,
        assetIn:      BigInt(TOKEN_INDEX[coinIn]),
        assetOut:     BigInt(TOKEN_INDEX[coinOut]),
        amountIn:     amountInWad,
        amountOutMin: slippedOut,
        recipient:    address,
        deadline:     BigInt(Math.floor(Date.now() / 1000) + 300),
      }],
    });
  }

  return { swap, isPending, txHash };
}
