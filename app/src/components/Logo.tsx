// Inline SVG brand logo - no <img>, no asset URL, no cache, no external
// subresources. Fonts come from the document-level Google Fonts link in
// index.html (inline SVG shares the document's font context).

const TITLE_FONT = "'Squada One', 'Arial Black', sans-serif";
const HUD_FONT = "'Orbitron', sans-serif";

export function Logo({ height = 40, className }: { height?: number; className?: string }) {
  const width = Math.round(height * (1000 / 140));
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1000 140"
      width={width}
      height={height}
      className={className}
      role="img"
      aria-label="Wilderzone Auxiliary Services"
    >
      <defs>
        <linearGradient id="wz-text-metal" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="48%" stopColor="#E5E7EB" />
          <stop offset="52%" stopColor="#9CA3AF" />
          <stop offset="100%" stopColor="#5A616B" />
        </linearGradient>
        <linearGradient id="wz-text-amber" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFBEB" />
          <stop offset="35%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#78350F" />
        </linearGradient>
        <linearGradient id="wz-text-teal" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFBEB" />
          <stop offset="35%" stopColor="#72DCA5" />
          <stop offset="100%" stopColor="#20352D" />
        </linearGradient>
      </defs>

      <g transform="translate(500, 76) scale(0.48, 0.82)">
        <text
          x="0"
          y="0"
          fontFamily={TITLE_FONT}
          fontSize="124"
          fontStyle="italic"
          letterSpacing="2"
          textAnchor="middle"
          stroke="#000000"
          strokeWidth="6"
          strokeLinejoin="miter"
          style={{ paintOrder: "stroke fill", filter: "drop-shadow(0px 5px 4px rgba(0,0,0,1))" }}
        >
          <tspan fill="url(#wz-text-metal)">WILDER</tspan>
          <tspan fill="url(#wz-text-amber)">ZONE</tspan>{" "}
          <tspan fill="url(#wz-text-teal)">AUXILIARY</tspan>
        </text>
      </g>

      <text
        x="500"
        y="115"
        fontFamily={HUD_FONT}
        fontSize="11"
        fontWeight="700"
        letterSpacing="2.5"
        textAnchor="middle"
        fill="#E5E7EB"
        stroke="#000000"
        strokeWidth="2"
        style={{ paintOrder: "stroke fill", filter: "drop-shadow(0px 2px 3px rgba(0,0,0,0.8))" }}
      >
        <tspan fill="url(#wz-text-metal)">BACKGROUND INTERFACING FOR</tspan>{" "}
        <tspan fill="url(#wz-text-amber)">TRIBES</tspan>{" "}
        <tspan fill="url(#wz-text-teal)">2</tspan>{" "}
        <tspan fill="url(#wz-text-metal)">MULTIPLAYER SERVERS</tspan>
      </text>
    </svg>
  );
}
