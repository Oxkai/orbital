import { type Address } from "viem";

// ─── Deployed addresses (Base Sepolia) ────────────────────────────────────────

export const POOL_ADDRESS       = "0xf250ecbe26adc1c03cbffff6af9d20bcaaf6e4e0" as Address;
export const POOL_ADDRESSES     = [POOL_ADDRESS] as const;
export const ROUTER_ADDRESS     = "0x46831b7178bb1719bc9ec9ff6038a4f44b1106da" as Address;
export const PM_ADDRESS         = "0x7a3558170ae4a15523d1e2848aa41aed1c7fa292" as Address;
export const QUOTER_ADDRESS     = "0x18033e198a2b0af2afa75afcc520f42179955a68" as Address;
export const FACTORY_ADDRESS    = "0xe9b2486b38609bb090a7c9ce944e36caca9117eb" as Address;

export const TOKEN_ADDRESSES = {
  USDC:   "0x9aeb218e9f3e4f2366f4a09a9d33823a8856d192" as Address,
  USDT:   "0x7d1c2f283811a0aa7d538e3c859da8bb45330e35" as Address,
  DAI:    "0x31f54f08c8df97d934b6804fab69c98c09898fb9" as Address,
  FRAX:   "0xda585869c1b63f20cb54226cd99b006d90bad784" as Address,
  crvUSD: "0xf27a032aa39d559801ddabf6f65e4db597f26ccd" as Address,
} as const;

// Block at which the contracts were first deployed on Base Sepolia.
// Used by event log scanners to avoid scanning from genesis.
export const DEPLOY_BLOCK = 40_993_661n;

// ─── Token metadata (static) ──────────────────────────────────────────────────

export const TOKEN_META: Record<string, { symbol: string; name: string; color: string; decimals: number }> = {
  "0x9aeb218e9f3e4f2366f4a09a9d33823a8856d192": { symbol: "USDC",   name: "USD Coin",   color: "#4A8FBF", decimals: 18 },
  "0x7d1c2f283811a0aa7d538e3c859da8bb45330e35": { symbol: "USDT",   name: "Tether USD", color: "#3A8F6E", decimals: 18 },
  "0x31f54f08c8df97d934b6804fab69c98c09898fb9": { symbol: "DAI",    name: "Dai",        color: "#B07E2A", decimals: 18 },
  "0xda585869c1b63f20cb54226cd99b006d90bad784": { symbol: "FRAX",   name: "Frax",       color: "#555555", decimals: 18 },
  "0xf27a032aa39d559801ddabf6f65e4db597f26ccd": { symbol: "crvUSD", name: "Curve USD",  color: "#FF6B35", decimals: 18 },
};

// ─── ABIs ─────────────────────────────────────────────────────────────────────

export const POOL_ABI = [
  { type: "function", name: "n",        inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "fee",      inputs: [], outputs: [{ type: "uint24"  }], stateMutability: "view" },
  { type: "function", name: "numTicks", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  {
    type: "function", name: "slot0", inputs: [],
    outputs: [
      { name: "sumX",    type: "uint256" },
      { name: "sumXSq",  type: "uint256" },
      { name: "rInt",    type: "uint256" },
      { name: "kBound",  type: "uint256" },
      { name: "sBound",  type: "uint256" },
      { name: "unlocked",type: "bool"    },
    ],
    stateMutability: "view",
  },
  { type: "function", name: "tokens",   inputs: [{ name: "", type: "uint256" }], outputs: [{ type: "address" }], stateMutability: "view" },
  { type: "function", name: "reserves", inputs: [{ name: "", type: "uint256" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  {
    type: "function", name: "ticks", inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "k",               type: "uint256" },
      { name: "r",               type: "uint256" },
      { name: "isInterior",      type: "bool"    },
      { name: "feeGrowthInside", type: "uint256" },
      { name: "liquidityGross",  type: "uint128" },
    ],
    stateMutability: "view",
  },
  { type: "function", name: "feeGrowthGlobal", inputs: [{ name: "", type: "uint256" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
] as const;

export const ERC20_ABI = [
  { type: "function", name: "balanceOf", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "allowance", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "approve",   inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
  { type: "function", name: "decimals",  inputs: [], outputs: [{ type: "uint8" }], stateMutability: "view" },
  { type: "function", name: "symbol",    inputs: [], outputs: [{ type: "string" }], stateMutability: "view" },
] as const;

export const MOCK_ERC20_ABI = [
  { type: "function", name: "balanceOf", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "allowance", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "approve",   inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
  { type: "function", name: "decimals",  inputs: [], outputs: [{ type: "uint8" }], stateMutability: "view" },
  { type: "function", name: "symbol",    inputs: [], outputs: [{ type: "string" }], stateMutability: "view" },
  { type: "function", name: "mint",      inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
] as const;

export const PM_ABI = [
  {
    type: "function", name: "mint",
    inputs: [{
      name: "params", type: "tuple",
      components: [
        { name: "pool",       type: "address"   },
        { name: "kWad",       type: "uint256"   },
        { name: "rWad",       type: "uint256"   },
        { name: "amountsMin", type: "uint256[]" },
        { name: "recipient",  type: "address"   },
        { name: "deadline",   type: "uint256"   },
      ],
    }],
    outputs: [{ name: "tokenId", type: "uint256" }, { name: "amounts", type: "uint256[]" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function", name: "positions",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      { name: "pool",      type: "address" },
      { name: "tickIndex", type: "uint256" },
      { name: "kWad",      type: "uint256" },
      { name: "rWad",      type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function", name: "increaseLiquidity",
    inputs: [{
      name: "params", type: "tuple",
      components: [
        { name: "tokenId",    type: "uint256"   },
        { name: "rWad",       type: "uint256"   },
        { name: "amountsMin", type: "uint256[]" },
        { name: "deadline",   type: "uint256"   },
      ],
    }],
    outputs: [{ name: "amounts", type: "uint256[]" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function", name: "decreaseLiquidity",
    inputs: [{
      name: "params", type: "tuple",
      components: [
        { name: "tokenId",    type: "uint256"   },
        { name: "rWad",       type: "uint256"   },
        { name: "amountsMin", type: "uint256[]" },
        { name: "deadline",   type: "uint256"   },
      ],
    }],
    outputs: [{ name: "amounts", type: "uint256[]" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function", name: "collect",
    inputs: [{
      name: "params", type: "tuple",
      components: [
        { name: "tokenId",   type: "uint256" },
        { name: "recipient", type: "address" },
      ],
    }],
    outputs: [{ name: "total", type: "uint256[]" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function", name: "burn",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  { type: "function", name: "balanceOf", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "ownerOf",   inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "address" }], stateMutability: "view" },
  {
    type: "event", name: "Transfer",
    inputs: [
      { name: "from",    type: "address", indexed: true },
      { name: "to",      type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
    ],
  },
] as const;

export const QUOTER_ABI = [
  {
    type: "function", name: "quoteExactInput",
    inputs: [
      { name: "pool",     type: "address" },
      { name: "assetIn",  type: "uint256" },
      { name: "assetOut", type: "uint256" },
      { name: "amountIn", type: "uint256" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function", name: "kBounds",
    inputs: [
      { name: "r", type: "uint256" },
      { name: "n", type: "uint256" },
    ],
    outputs: [
      { name: "kMinVal", type: "uint256" },
      { name: "kMaxVal", type: "uint256" },
    ],
    stateMutability: "pure",
  },
  {
    type: "function", name: "kForDepegPrice",
    inputs: [
      { name: "r",    type: "uint256" },
      { name: "n",    type: "uint256" },
      { name: "pWad", type: "uint256" },
    ],
    outputs: [{ name: "k", type: "uint256" }],
    stateMutability: "pure",
  },
] as const;

export const ROUTER_ABI = [
  {
    type: "function", name: "exactInput",
    inputs: [{
      name: "params", type: "tuple",
      components: [
        { name: "pool",         type: "address" },
        { name: "assetIn",      type: "uint256" },
        { name: "assetOut",     type: "uint256" },
        { name: "amountIn",     type: "uint256" },
        { name: "amountOutMin", type: "uint256" },
        { name: "recipient",    type: "address" },
        { name: "deadline",     type: "uint256" },
      ],
    }],
    outputs: [{ name: "amountOut", type: "uint256" }],
    stateMutability: "nonpayable",
  },
] as const;
