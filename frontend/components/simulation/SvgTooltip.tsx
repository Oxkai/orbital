interface Props {
  x: number;
  y: number;
  rows: [string, string][];
  width?: number;
  rowHeight?: number;
}

export default function SvgTooltip({ x, y, rows, width = 192, rowHeight = 15 }: Props) {
  const bp = 8;
  const h  = rows.length * rowHeight + bp * 2;
  return (
    <g style={{ pointerEvents: "none" }}>
      <rect x={x} y={y} width={width} height={h} rx={6}
        fill="var(--color-surface)" stroke="var(--color-border)" strokeWidth={0.8} />
      {rows.map(([label, val], i) => (
        <g key={i}>
          <text x={x + bp} y={y + bp + i * rowHeight + 10}
            fontSize={8.5} fontFamily="monospace" fill="var(--color-tertiary)">{label}</text>
          <text x={x + width - bp} y={y + bp + i * rowHeight + 10}
            fontSize={8.5} fontFamily="monospace" fill="var(--color-primary)" textAnchor="end">{val}</text>
          {i < rows.length - 1 && (
            <line
              x1={x + bp}        y1={y + bp + (i + 1) * rowHeight + 2}
              x2={x + width - bp} y2={y + bp + (i + 1) * rowHeight + 2}
              stroke="var(--color-border)" strokeWidth={0.4} />
          )}
        </g>
      ))}
    </g>
  );
}
