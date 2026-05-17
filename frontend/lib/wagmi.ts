import { createConfig, http, fallback, type Config } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { injected, coinbaseWallet } from "wagmi/connectors";

export function createWagmiConfig(): Config {
  const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;
  return createConfig({
    chains: [baseSepolia],
    connectors: [
      injected(),
      coinbaseWallet({ appName: "Orbital" }),
    ],
    transports: {
      [baseSepolia.id]: RPC_URL
        ? fallback([http(RPC_URL), http()])
        : http(),
    },
  });
}

export type WagmiConfig = ReturnType<typeof createWagmiConfig>;

declare module "wagmi" {
  interface Register {
    config: WagmiConfig;
  }
}
