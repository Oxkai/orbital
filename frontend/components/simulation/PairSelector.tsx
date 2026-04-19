import { COINS, type Coin } from "@/lib/simulation";

interface Props {
  coinA:    Coin;
  coinB:    Coin;
  onCoinA:  (c: Coin) => void;
  onCoinB:  (c: Coin) => void;
}

export default function PairSelector({ coinA, coinB, onCoinA, onCoinB }: Props) {
  return (
    <div className="shrink-0 flex items-center gap-3 px-4 py-2.5">
      {/* CoinA group */}
      <div className="flex gap-1">
        {COINS.map(c => (
          <button
            key={c}
            onClick={() => { if (c === coinB) onCoinB(coinA); onCoinA(c); }}
            className="px-2.5 py-1 rounded-md text-[10px] font-mono font-semibold transition-all duration-150"
            style={{
              background: coinA === c ? "var(--color-primary)" : "transparent",
              color: coinA === c ? "var(--color-background)" : "var(--color-tertiary)",
            }}
          >
            {c}
          </button>
        ))}
      </div>

      <svg width="12" height="10" viewBox="0 0 12 10" fill="none" style={{ color: "var(--color-tertiary)", flexShrink: 0 }}>
        <path d="M1 3h10M8 1l2 2-2 2M11 7H1M4 5l-2 2 2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>

      {/* CoinB group */}
      <div className="flex gap-1">
        {COINS.map(c => (
          <button
            key={c}
            onClick={() => { if (c === coinA) onCoinA(coinB); onCoinB(c); }}
            className="px-2.5 py-1 rounded-md text-[10px] font-mono font-semibold transition-all duration-150"
            style={{
              background: coinB === c ? "var(--color-primary)" : "transparent",
              color: coinB === c ? "var(--color-background)" : "var(--color-tertiary)",
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="ml-auto flex items-center gap-3 text-[9px] font-mono" style={{ color: "var(--color-tertiary)" }}>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-px" style={{ background: "var(--color-primary)", opacity: 0.9 }} />
          curve
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-px" style={{ background: "var(--color-primary)", opacity: 0.35 }} />
          interior
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-4 h-px"
            style={{
              backgroundImage: "repeating-linear-gradient(90deg, #facc15 0, #facc15 3px, transparent 3px, transparent 6px)",
              opacity: 0.7,
            }}
          />
          boundary
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: "#4ade80" }} />
          reserves
        </span>
      </div>
    </div>
  );
}
