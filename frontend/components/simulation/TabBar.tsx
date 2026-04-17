import type { Tab, Coin } from "@/lib/simulation";

interface Props {
  tab:     Tab;
  coinA:   Coin;
  coinB:   Coin;
  rx:      number;
  ry:      number;
  slope:   number;
  alpha:   number;
  onTab:   (t: Tab) => void;
}

const TABS: { id: Tab; label: string }[] = [
  { id: "curve", label: "AMM Curve"  },
  { id: "rings", label: "Tick Rings" },
];

export default function TabBar({ tab, coinA, coinB, rx, ry, slope, alpha, onTab }: Props) {
  const f = (v: number) => v.toFixed(2);
  return (
    <div className="shrink-0 flex items-center justify-between px-4 py-3">
      {/* Tabs */}
      <div className="flex gap-1.5">
        {TABS.map(({ id, label }) => (
          <button key={id} onClick={() => onTab(id)}
            className={`px-3 py-1.5 rounded text-[10px] font-mono transition-all duration-150 ${
              tab === id
                ? "bg-primary text-background"
                : "text-tertiary hover:text-secondary"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Right side: stats for curve, legend for rings */}
      {tab === "curve" && (
        <div className="flex items-center gap-3 text-[10px] font-mono text-tertiary">
          <span>{coinA} <span className="text-primary">{f(rx)}</span></span>
          <span className="opacity-30">·</span>
          <span>{coinB} <span className="text-primary">{f(ry)}</span></span>
          <span className="opacity-30">·</span>
          <span>rate <span className="text-primary">{isFinite(slope) ? f(slope) : "∞"}</span></span>
          <span className="opacity-30">·</span>
          <span>α <span className="text-primary">{f(alpha)}</span></span>
        </div>
      )}

      {tab === "rings" && (
        <div className="flex items-center gap-4 text-[9px] font-mono text-tertiary">
          <span className="flex items-center gap-1.5"><span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/70" /> q</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-4 border-t border-primary/50" /> interior</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-4 border-t border-dashed border-yellow-400/60" /> boundary</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "#4ade80" }} /> reserves</span>
        </div>
      )}
    </div>
  );
}
