export function NoiseOverlay() {
  return (
    <div className="fixed inset-0 pointer-events-none z-[2]" aria-hidden>
      <svg className="absolute inset-0 w-full h-full opacity-[0.015]">
        <filter id="noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#noise)" />
      </svg>
    </div>
  );
}
