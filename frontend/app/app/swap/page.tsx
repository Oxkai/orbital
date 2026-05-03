import React from "react";
import { color } from "@/constants";
import { SwapWidget } from "@/components/app/swap/SwapWidget";

export default function SwapPage() {
  return (
    <div className="flex flex-col overflow-hidden w-full" style={{ height: "calc(100vh - 5.5rem)" }}>
      <div className="flex-1 min-h-0 grid grid-cols-3 relative" style={{ border: `1px solid ${color.border}` }}>
        {/* triangle corners */}
        {([
          { top: 0, left: 0,     clipPath: "polygon(0 0, 100% 0, 0 100%)" },
          { top: 0, right: 0,    clipPath: "polygon(0 0, 100% 0, 100% 100%)" },
          { bottom: 0, left: 0,  clipPath: "polygon(0 0, 0 100%, 100% 100%)" },
          { bottom: 0, right: 0, clipPath: "polygon(100% 0, 0 100%, 100% 100%)" },
        ] as React.CSSProperties[]).map((s, i) => (
          <div key={i} style={{ position: "absolute", width: 14, height: 14, backgroundColor: color.textPrimary, ...s }} />
        ))}
        <div style={{ backgroundImage: `repeating-linear-gradient(45deg, ${color.borderSubtle} 0, ${color.borderSubtle} 1px, transparent 0, transparent 50%)`, backgroundSize: "12px 12px", borderRight: `1px solid ${color.border}` }} />
        <div className="flex m-3 flex-col">
          <SwapWidget />
        </div>
        <div style={{ backgroundImage: `repeating-linear-gradient(45deg, ${color.borderSubtle} 0, ${color.borderSubtle} 1px, transparent 0, transparent 50%)`, backgroundSize: "12px 12px", borderLeft: `1px solid ${color.border}` }} />
      </div>
    </div>
  );
}
