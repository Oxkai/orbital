import { createConfig, http, fallback } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { injected, coinbaseWallet } from "wagmi/connectors";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;

export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  connectors: [
    injected(),
    coinbaseWallet({ appName: "Orbital" }),
  ],
  transports: {
    // Use configured RPC first; fall back to the public endpoint so the app
    // still works without an env var (useful for local dev / demos)
    [baseSepolia.id]: RPC_URL
      ? fallback([http(RPC_URL), http()])
      : http(),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
