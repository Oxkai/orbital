"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { color, typography } from "@/constants";

const LINKS = [
  { href: "/app/swap",         label: "Swap"         },
  { href: "/app/pools",        label: "Pools"        },
  { href: "/app/positions",    label: "Positions"    },
  { href: "/app/transactions", label: "Transactions" },
] as const;

function short(addr: string) {
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

export function AppNav() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const { connect, isPending }   = useConnect();
  const { disconnect }           = useDisconnect();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const showConnectedWallet = isMounted && isConnected && address;

  return (
    <nav
      className="sticky top-0 z-40 flex items-center h-10 px-5 m-4 gap-6 backdrop-blur-md"
      style={{
        
        backgroundColor: color.surface1,
      }}
    >
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 shrink-0 mr-2">
       
        <span
          style={{
            fontFamily: typography.p2.family,
            fontSize: "14px",
            fontWeight: 500,
            letterSpacing: "0.1em",
            color: color.textPrimary,
          }}
        >
          ORBITAL
        </span>
      </Link>

      {/* Nav links */}
      <div className="flex items-center gap-0.5 flex-1">
        {LINKS.map(({ href, label }) => {
          const active =
            pathname === href ||
            (href !== "/app/swap" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className="px-3 py-1.5 transition-colors"
              style={{
                fontFamily: typography.p2.family,
                fontSize: typography.p2.size,
                letterSpacing: "-0.01em",
                color: active ? color.textPrimary : color.textMuted,
                backgroundColor: active ? color.surface2 : "transparent",
                border: active
                  ? `1px solid ${color.borderSubtle}`
                  : "1px solid transparent",
              }}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {/* Right — network badge + wallet */}
      <div className="flex items-center gap-2 shrink-0">
       

        {showConnectedWallet ? (
          <button
            onClick={() => disconnect()}
            style={{
              border: `1px solid ${color.border}`,
              backgroundColor: color.surface2,
              color: color.textPrimary,
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.04em",
              padding: "6px 14px",
              cursor: "pointer",
            }}
          >
            {short(address)}
          </button>
        ) : (
          <button
            onClick={() => connect({ connector: injected() })}
            disabled={isPending}
            style={{
              
              backgroundColor: color.textPrimary,
              color: isPending ? color.bg : color.bg,
              fontFamily: typography.p2.family,
              fontSize: typography.p2.size,
              letterSpacing: "-0.01em",
              padding: "6px 14px",
              cursor: isPending ? "not-allowed" : "pointer",
            }}
          >
            {isPending ? "Connecting…" : "Connect Wallet"}
          </button>
        )}
      </div>
    </nav>
  );
}
