export const CHAIN_ID = 84532; // Base Sepolia

export const ADDRESSES = {
  factory:         "0x7e1B4FE6170AccA1789e249eAB3D247182D30B44",
  router:          "0x60CEC0218b501Cf4E045CbDbA3eF021374e1aFAc",
  quoter:          "0x713cd4D1a453705fa31D81A89817174d1c37d489",
  positionManager: "0x08AC49be269F1c6C2821D56c4C729C9843152EE3",
  pool:            "0x285398F9Ac1D317Bca922691316BDf5B1493dA71", // 0.05% fee pool
  tokens: {
    USDC: "0x44406ad771b05827F5fd95b002189e51EEbEDC91",
    DAI:  "0x60Cb112631Ce92f9fe164878d690FAc1FD1C295d",
    FRAX: "0x39855B7DE333de50A7b2e97a3A3E2Ec1CF0411a9",
    USDT: "0x168DEB69184ea184AadB8a626DC4d3013dc08Fe8",
  },
} as const;

// Token index in pool (address-sorted by factory — verified on-chain)
export const TOKEN_INDEX: Record<string, number> = {
  USDT: 0,
  FRAX: 1,
  USDC: 2,
  DAI:  3,
};

export const WAD = BigInt("1000000000000000000"); // 1e18

export const POOL_ABI = [
  {
    type: "function", name: "slot0", inputs: [],
    outputs: [
      { name: "sumX",     type: "uint256" },
      { name: "sumXSq",   type: "uint256" },
      { name: "rInt",     type: "uint256" },
      { name: "kBound",   type: "uint256" },
      { name: "sBound",   type: "uint256" },
      { name: "unlocked", type: "bool"    },
    ],
    stateMutability: "view",
  },
  {
    type: "function", name: "reserves",
    inputs:  [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function", name: "n", inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function", name: "fee", inputs: [],
    outputs: [{ name: "", type: "uint24" }],
    stateMutability: "view",
  },
  {
    type: "function", name: "numTicks", inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function", name: "ticks",
    inputs:  [{ name: "", type: "uint256" }],
    outputs: [
      { name: "k",               type: "uint256" },
      { name: "r",               type: "uint256" },
      { name: "isInterior",      type: "bool"    },
      { name: "feeGrowthInside", type: "uint256" },
      { name: "liquidityGross",  type: "uint128" },
    ],
    stateMutability: "view",
  },
  {
    type: "function", name: "n", inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event", name: "Swap",
    inputs: [
      { name: "sender",    type: "address", indexed: true  },
      { name: "recipient", type: "address", indexed: true  },
      { name: "assetIn",   type: "uint256", indexed: false },
      { name: "assetOut",  type: "uint256", indexed: false },
      { name: "amountIn",  type: "uint256", indexed: false },
      { name: "amountOut", type: "uint256", indexed: false },
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

export const ERC20_ABI = [
  {
    type: "function", name: "approve",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function", name: "allowance",
    inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function", name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;
