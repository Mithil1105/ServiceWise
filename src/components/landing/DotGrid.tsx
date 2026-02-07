export function DotGrid() {
  return (
    <div className="fixed inset-0 pointer-events-none z-[1]" aria-hidden>
      <svg className="absolute inset-0 w-full h-full opacity-[0.4]">
        <defs>
          <pattern id="dot-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="hsl(var(--muted-foreground))" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dot-grid)" />
      </svg>
    </div>
  );
}
