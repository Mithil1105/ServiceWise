export function GradientBackdrop() {
  return (
    <div
      className="fixed inset-0 pointer-events-none z-0"
      aria-hidden
    >
      {/* Top-right ~800px circle */}
      <div
        className="absolute w-[800px] h-[800px] rounded-full opacity-20 -top-[400px] -right-[400px]"
        style={{ background: 'radial-gradient(circle, hsl(221 83% 53% / 0.4) 0%, transparent 70%)' }}
      />
      {/* Bottom-left ~600px circle */}
      <div
        className="absolute w-[600px] h-[600px] rounded-full opacity-[0.15] -bottom-[300px] -left-[300px]"
        style={{ background: 'radial-gradient(circle, hsl(250 95% 64% / 0.3) 0%, transparent 70%)' }}
      />
      {/* Center ~1000px circle */}
      <div
        className="absolute w-[1000px] h-[1000px] rounded-full opacity-[0.05] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ background: 'radial-gradient(circle, hsl(160 84% 39% / 0.3) 0%, transparent 70%)' }}
      />
    </div>
  );
}
