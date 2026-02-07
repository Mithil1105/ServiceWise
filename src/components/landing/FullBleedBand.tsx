import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'hero' | 'soft' | 'white' | 'dark' | 'transparent';

const variantClasses: Record<Variant, string> = {
  hero: 'bg-gradient-to-br from-primary/5 via-background to-accent/5',
  soft: 'bg-muted/50',
  white: 'bg-background',
  dark: 'bg-foreground text-background',
  transparent: 'bg-transparent',
};

export function FullBleedBand({
  variant = 'transparent',
  className,
  innerClassName,
  children,
}: {
  variant?: Variant;
  className?: string;
  innerClassName?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn('w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]', variantClasses[variant], className)}
    >
      <div className={cn('max-w-7xl mx-auto px-4 sm:px-6 lg:px-8', innerClassName)}>
        {children}
      </div>
    </section>
  );
}
