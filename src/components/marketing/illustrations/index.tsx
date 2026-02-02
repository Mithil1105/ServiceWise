import { cn } from '@/lib/utils';

/** Hero: calendar + car + check mark — clean line style */
export function HeroIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 280 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('w-full max-w-sm', className)}
      aria-hidden
    >
      <rect x="40" y="20" width="120" height="100" rx="8" stroke="currentColor" strokeWidth="2" fill="none" className="text-muted-foreground/40" />
      <line x1="40" y1="45" x2="160" y2="45" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/60" />
      <rect x="55" y="55" width="25" height="18" rx="2" fill="currentColor" className="text-primary/20" />
      <rect x="90" y="55" width="25" height="18" rx="2" fill="currentColor" className="text-primary/30" />
      <rect x="125" y="55" width="25" height="18" rx="2" fill="currentColor" className="text-primary/20" />
      <path d="M160 80 L220 80 L220 160 L160 160 Z" stroke="currentColor" strokeWidth="2" fill="none" rx="6" className="text-muted-foreground/50" />
      <circle cx="190" cy="115" r="18" stroke="currentColor" strokeWidth="2" fill="none" className="text-primary" />
      <path d="M185 115 L189 119 L197 111" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary" />
      <circle cx="190" cy="160" r="8" fill="currentColor" className="text-primary/60" />
    </svg>
  );
}

/** Simple lock */
export function LockIconSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={cn('w-full h-full', className)} aria-hidden>
      <rect x="8" y="22" width="32" height="22" rx="4" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M14 22 V16 A10 10 0 0 1 34 16 V22" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  );
}

/** Shield */
export function ShieldIconSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={cn('w-full h-full', className)} aria-hidden>
      <path d="M24 4 L42 12 V22 C42 32 34 40 24 44 C14 40 6 32 6 22 V12 Z" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  );
}

/** Stack blocks for Tech page */
export function StackBlocksSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg" className={cn('w-full max-w-xs', className)} aria-hidden>
      <rect x="20" y="70" width="160" height="24" rx="4" fill="currentColor" className="text-muted-foreground/30" />
      <rect x="30" y="42" width="140" height="24" rx="4" fill="currentColor" className="text-muted-foreground/50" />
      <rect x="40" y="14" width="120" height="24" rx="4" fill="currentColor" className="text-primary/40" />
    </svg>
  );
}

/** Chat + calendar for Contact hero */
export function ContactHeroSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg" className={cn('w-full max-w-[200px]', className)} aria-hidden>
      <rect x="20" y="20" width="90" height="70" rx="8" stroke="currentColor" strokeWidth="2" fill="none" className="text-muted-foreground/40" />
      <line x1="20" y1="40" x2="110" y2="40" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/50" />
      <circle cx="45" cy="62" r="8" fill="currentColor" className="text-primary/30" />
      <rect x="58" y="56" width="40" height="8" rx="2" fill="currentColor" className="text-muted-foreground/30" />
      <path d="M90 100 L130 100 L150 120 L130 100 L90 100 Z" stroke="currentColor" strokeWidth="2" fill="none" className="text-primary/50" />
      <rect x="110" y="30" width="70" height="50" rx="6" stroke="currentColor" strokeWidth="2" fill="none" className="text-muted-foreground/30" />
      <line x1="110" y1="45" x2="180" y2="45" stroke="currentColor" strokeWidth="1" className="text-muted-foreground/40" />
      <rect x="118" y="55" width="20" height="14" rx="2" fill="currentColor" className="text-primary/20" />
    </svg>
  );
}

/** Mini bar chart for dashboard mock */
export function MiniBarChartSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 80" fill="none" xmlns="http://www.w3.org/2000/svg" className={cn('w-full h-full', className)} aria-hidden>
      <rect x="20" y="50" width="24" height="24" rx="2" fill="currentColor" className="text-primary/50" />
      <rect x="52" y="38" width="24" height="36" rx="2" fill="currentColor" className="text-primary/70" />
      <rect x="84" y="30" width="24" height="44" rx="2" fill="currentColor" className="text-primary" />
      <rect x="116" y="42" width="24" height="32" rx="2" fill="currentColor" className="text-primary/60" />
      <rect x="148" y="34" width="24" height="40" rx="2" fill="currentColor" className="text-primary/50" />
    </svg>
  );
}

/** Three role cards + lock for Roles page */
export function RolesIllustrationSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={cn('w-full max-w-[240px]', className)} aria-hidden>
      <rect x="10" y="20" width="65" height="60" rx="8" stroke="currentColor" strokeWidth="1.5" fill="none" className="text-muted-foreground/30" />
      <circle cx="42" cy="42" r="10" stroke="currentColor" strokeWidth="1.5" className="text-primary/50" />
      <rect x="25" y="58" width="35" height="6" rx="2" fill="currentColor" className="text-muted-foreground/40" />
      <rect x="87" y="25" width="65" height="55" rx="8" stroke="currentColor" strokeWidth="1.5" fill="none" className="text-muted-foreground/30" />
      <circle cx="119" cy="48" r="10" stroke="currentColor" strokeWidth="1.5" className="text-primary/50" />
      <rect x="102" y="63" width="35" height="6" rx="2" fill="currentColor" className="text-muted-foreground/40" />
      <rect x="164" y="22" width="65" height="58" rx="8" stroke="currentColor" strokeWidth="1.5" fill="none" className="text-muted-foreground/30" />
      <circle cx="196" cy="48" r="10" stroke="currentColor" strokeWidth="1.5" className="text-primary/50" />
      <rect x="179" y="63" width="35" height="6" rx="2" fill="currentColor" className="text-muted-foreground/40" />
      <circle cx="200" cy="90" r="12" stroke="currentColor" strokeWidth="2" fill="none" className="text-primary/60" />
      <path d="M195 90 L199 94 L206 87" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary/60" />
    </svg>
  );
}

/** Before vs After simple illustration */
export function BeforeAfterSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 280 80" fill="none" xmlns="http://www.w3.org/2000/svg" className={cn('w-full', className)} aria-hidden>
      <rect x="10" y="10" width="120" height="60" rx="8" stroke="currentColor" strokeWidth="1.5" fill="none" className="text-muted-foreground/40" />
      <line x1="25" y1="25" x2="115" y2="25" stroke="currentColor" strokeWidth="1" className="text-muted-foreground/50" />
      <line x1="25" y1="38" x2="90" y2="38" stroke="currentColor" strokeWidth="1" className="text-muted-foreground/50" />
      <line x1="25" y1="51" x2="100" y2="51" stroke="currentColor" strokeWidth="1" className="text-muted-foreground/50" />
      <text x="70" y="72" textAnchor="middle" className="fill-muted-foreground text-[10px] font-medium">Before</text>
      <path d="M140 40 L150 30 L150 50 Z" fill="currentColor" className="text-primary/50" />
      <rect x="160" y="10" width="110" height="60" rx="8" stroke="currentColor" strokeWidth="1.5" fill="none" className="text-primary/20" />
      <rect x="175" y="22" width="80" height="8" rx="2" fill="currentColor" className="text-primary/40" />
      <rect x="175" y="38" width="60" height="8" rx="2" fill="currentColor" className="text-primary/30" />
      <circle cx="230" cy="55" r="6" fill="currentColor" className="text-primary/50" />
      <text x="215" y="72" textAnchor="middle" className="fill-muted-foreground text-[10px] font-medium">After</text>
    </svg>
  );
}
