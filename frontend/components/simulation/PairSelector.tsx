import { COINS, type Coin } from "@/lib/simulation";

interface Props {
  coinA:    Coin;
  coinB:    Coin;
  onCoinA:  (c: Coin) => void;
  onCoinB:  (c: Coin) => void;
}

export default function PairSelector({ coinA, coinB, onCoinA, onCoinB }: Props) {
  return (
    <div className="shrink-0 flex items-center gap-2.5 px-4 py-2">
      <div className="flex gap-1">
        {COINS.map(c => (
          <button key={c} onClick={() => { if (c === coinB) onCoinB(coinA); onCoinA(c); }}
            className={`px-2.5 py-1 rounded-sm text-[10px] font-mono transition-all duration-150 ${
              coinA === c ? "bg-primary text-background" : "text-tertiary hover:text-secondary"
            }`}>{c}</button>
        ))}
      </div>
      <span className="text-tertiary text-[10px] font-mono opacity-30">↔</span>
      <div className="flex gap-1">
        {COINS.map(c => (
          <button key={c} onClick={() => { if (c === coinA) onCoinA(coinB); onCoinB(c); }}
            className={`px-2.5 py-1 rounded-sm text-[10px] font-mono transition-all duration-150 ${
              coinB === c ? "bg-primary text-background" : "text-tertiary hover:text-secondary"
            }`}>{c}</button>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-3 text-[9px] font-mono text-tertiary opacity-50">
        <span className="flex items-center gap-1"><span className="inline-block w-4 border-t-2 border-primary/70" /> curve</span>
        <span className="flex items-center gap-1"><span className="inline-block w-4 border-t border-primary/40" /> interior</span>
        <span className="flex items-center gap-1"><span className="inline-block w-4 border-t border-dashed border-yellow-400/60" /> boundary</span>
        <span className="flex items-center gap-1"><span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "#4ade80" }} /> reserves</span>
      </div>
    </div>
  );
}
