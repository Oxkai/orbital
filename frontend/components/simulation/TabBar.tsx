export default function TabBar() {
  return (
    <div className="shrink-0 flex items-center justify-between px-4 py-3 gap-4">
      <span className="text-[11px] font-mono font-semibold" style={{ color: "var(--color-primary)" }}>
        Tick Rings
      </span>
      <div className="flex items-center gap-3 text-[9px] font-mono" style={{ color: "var(--color-tertiary)" }}>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: "var(--color-primary)", opacity: 0.6 }} />
          q
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 border-t" style={{ borderColor: "var(--color-secondary)", opacity: 0.5 }} />
          interior
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 border-t border-dashed" style={{ borderColor: "#facc15", opacity: 0.7 }} />
          boundary
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: "#4ade80" }} />
          reserves
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 border-t" style={{ borderColor: "#60a5fa", opacity: 0.7 }} />
          rInt
        </span>
      </div>
    </div>
  );
}
