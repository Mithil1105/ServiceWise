export function FloatingOrbs() {
  return (
    <div className="fixed inset-0 pointer-events-none z-[1] overflow-hidden" aria-hidden>
      <div
        className="absolute w-64 h-64 rounded-full blur-3xl opacity-[0.15] top-[10%] right-[10%] animate-float"
        style={{ background: 'hsl(221 83% 53%)' }}
      />
      <div
        className="absolute w-48 h-48 rounded-full blur-2xl opacity-[0.12] bottom-[20%] left-[5%] animate-float-delayed"
        style={{ background: 'hsl(250 95% 64%)' }}
      />
      <div
        className="absolute w-56 h-56 rounded-full blur-3xl opacity-[0.1] top-[50%] right-[15%] animate-float-slow"
        style={{ background: 'hsl(160 84% 39%)' }}
      />
      <div
        className="absolute w-40 h-40 rounded-full blur-2xl opacity-[0.2] bottom-[10%] right-[20%] animate-float"
        style={{ background: 'hsl(221 83% 53% / 0.5)' }}
      />
    </div>
  );
}
