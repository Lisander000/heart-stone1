import { ResponsiveContainer, Treemap } from "recharts";

const PALETTE = ["hsl(var(--ember))", "hsl(var(--sun))", "hsl(var(--grape))", "hsl(var(--info))", "hsl(var(--ok))", "hsl(var(--warn))", "hsl(var(--bad))", "hsl(var(--muted-foreground))"];
const eurC = (v: number) => { const a = Math.abs(v), s = v < 0 ? "−" : ""; if (a >= 1000) return s + "€" + (a / 1000).toFixed(a >= 10000 ? 0 : 1).replace(".", ",") + "k"; return s + "€" + Math.round(a); };

/* One treemap block — background rect + crisp, truncated HTML label (foreignObject). */
function Cell(props: any) {
  const { x, y, width, height, index, name, colors } = props;
  if (!width || !height || width <= 0 || height <= 0) return null;
  const c = colors[index % colors.length];
  const showName = width > 42 && height > 20;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={7} ry={7} fill={c} stroke="hsl(var(--card))" strokeWidth={2} />
      {showName && (
        <foreignObject x={x + 2} y={y + 2} width={Math.max(0, width - 4)} height={Math.max(0, height - 4)} style={{ pointerEvents: "none" }}>
          <div style={{ height: "100%", padding: "5px 8px", color: "#fff", overflow: "hidden", display: "flex", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textShadow: "0 1px 2px rgba(0,0,0,0.35)" }}>{name}</span>
          </div>
        </foreignObject>
      )}
    </g>
  );
}

/** Cost composition — bigger block = bigger cost, with a legend so every label reads. */
export function CostTreemap({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;
  const colored = data.map((d, i) => ({ ...d, color: PALETTE[i % PALETTE.length] }));
  return (
    <div>
      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap data={colored} dataKey="value" stroke="hsl(var(--card))" isAnimationActive={false} content={<Cell colors={PALETTE} total={total} />} />
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-1.5 mt-4">
        {colored.map((d) => (
          <div key={d.name} className="flex items-center gap-2 text-xs min-w-0">
            <span className="dot shrink-0" style={{ background: d.color }} />
            <span className="text-muted-foreground flex-1 truncate">{d.name}</span>
            <span className="font-medium text-foreground tabular-nums shrink-0">{eurC(d.value)}</span>
            <span className="text-muted-foreground tabular-nums w-8 text-right shrink-0">{Math.round((d.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground mt-3 text-center">Totale kosten (P&amp;L actual): <span className="font-medium text-foreground tabular-nums">{eurC(total)}</span></p>
    </div>
  );
}
