import { cn } from '@/lib/utils';

type SectionHeadingProps = {
  title: string;
  subtitle?: string;
  className?: string;
  as?: 'h1' | 'h2' | 'h3';
};

export function SectionHeading({ title, subtitle, className, as: Tag = 'h2' }: SectionHeadingProps) {
  return (
    <div className={cn('text-center max-w-3xl mx-auto', className)}>
      <Tag className="text-2xl font-bold sm:text-3xl tracking-tight">{title}</Tag>
      {subtitle && (
        <p className="mt-3 text-muted-foreground text-base sm:text-lg">{subtitle}</p>
      )}
    </div>
  );
}
