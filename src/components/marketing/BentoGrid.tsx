import { cn } from '@/lib/utils';

type BentoGridProps = {
  children: React.ReactNode;
  className?: string;
  cols?: 1 | 2 | 3;
};

export function BentoGrid({ children, className, cols = 3 }: BentoGridProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-4 sm:gap-6',
        cols === 2 && 'sm:grid-cols-2',
        cols === 3 && 'sm:grid-cols-2 lg:grid-cols-3',
        className
      )}
    >
      {children}
    </div>
  );
}
