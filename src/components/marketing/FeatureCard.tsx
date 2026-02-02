import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type FeatureCardProps = {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  className?: string;
};

export function FeatureCard({ icon: Icon, title, children, className }: FeatureCardProps) {
  return (
    <Card
      className={cn(
        'overflow-hidden transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        className
      )}
    >
      <CardContent className="p-6">
        <Icon className="h-10 w-10 text-primary mb-3" aria-hidden />
        <h3 className="font-semibold text-lg">{title}</h3>
        <div className="mt-2 text-sm text-muted-foreground">{children}</div>
      </CardContent>
    </Card>
  );
}
