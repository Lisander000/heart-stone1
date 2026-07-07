/** Gooodboys collapsed-sidebar mark: a rounded bordeaux "G" with a dot.
 *  Uses the primary token so it follows the theme. */
export function GbMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 132 108" className={className} fill="none" role="img" aria-label="Gooodboys">
      <g stroke="hsl(var(--primary))" strokeWidth="19" strokeLinecap="round" strokeLinejoin="round">
        {/* open "G" ring (gap on the right) */}
        <path d="M84 30 A 38 38 0 1 0 84 78" />
        {/* crossbar */}
        <path d="M88 54 L 60 54" />
      </g>
      {/* dot */}
      <circle cx="114" cy="38" r="15" fill="hsl(var(--primary))" />
    </svg>
  );
}
