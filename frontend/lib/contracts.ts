import { type Address } from "viem";

// ─── Deployed addresses (Base Sepolia) ────────────────────────────────────────

export const POOL_ADDRESS       = "0x9a034ef31254e3c74586b67017edcf9248acbb51" as Address;
export const ROUTER_ADDRESS     = "0xe3f3fc6b64fe618d263f931db052ac8fdbac33b9" as Address;
export const PM_ADDRESS         = "0x0519bc11599afc4571ee053b1609ada6dd81624f" as Address;
export const QUOTER_ADDRESS     = "0x75d20f7bf37017542e90e8ca5083dc1a8fb3f03c" as Address;
export const FACTORY_ADDRESS    = "0x50c64861c68ccffe2f2464de829bca17dba70a1b" as Address;

export const TOKEN_ADDRESSES = {
  USDC: "0x6874393cfe557b9288ef5b0a71a830cc8ce7f0fb" as Address,
  USDT: "0x4a6b63081a2c1933ebb662d5462edb9158654b1e" as Address,
  DAI:  "0x3af83cd2fa7fc93c17be0cfa6a1faaf2c6c5b215" as Address,
  FRAX: "0xedc7917961ce6d4c6922e903ea633fb8b4c9e5cc" as Address,
} as const;

// Block at which the contracts were first deployed on Base Sepolia.
// Used by event log scanners to avoid scanning from genesis.
export const DEPLOY_BLOCK = 40_881_384n;

// ─── Token metadata (static) ──────────────────────────────────────────────────

export const TOKEN_META: Record<string, { symbol: string; name: string; color: string; decimals: number }> = {
  "0x6874393cfe557b9288ef5b0a71a830cc8ce7f0fb": { symbol: "USDC", name: "USD Coin",   color: "#4A8FBF", decimals: 18 },
  "0x4a6b63081a2c1933ebb662d5462edb9158654b1e": { symbol: "USDT", name: "Tether USD", color: "#3A8F6E", decimals: 18 },
  "0x3af83cd2fa7fc93c17be0cfa6a1faaf2c6c5b215": { symbol: "DAI",  name: "Dai",        color: "#B07E2A", decimals: 18 },
  "0xedc7917961ce6d4c6922e903ea633fb8b4c9e5cc": { symbol: "FRAX", name: "Frax",       color: "#555555", decimals: 18 },
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
