import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Check, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PricingTier = {
  name: string;
  bestFor: string;
  features: string[];
  cta: string;
  icon?: LucideIcon;
  highlight?: boolean;
};

type PricingCardsProps = {
  tiers: PricingTier[];
  className?: string;
};

export function PricingCards({ tiers, className }: PricingCardsProps) {
  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-3 gap-6', className)}>
      {tiers.map((tier, i) => (
        <Card
          key={i}
          className={cn(
            'flex flex-col transition-shadow hover:shadow-md',
            tier.highlight && 'ring-2 ring-primary shadow-lg'
          )}
        >
          <CardContent className="p-6 flex flex-col flex-1">
            {tier.highlight && (
              <span className="text-xs font-semibold text-primary mb-2">Most popular</span>
            )}
            {tier.icon && <tier.icon className="h-8 w-8 text-primary mb-2" aria-hidden />}
            <h2 className="text-xl font-bold">{tier.name}</h2>
            <p className="text-sm text-muted-foreground mt-2">{tier.bestFor}</p>
            <ul className="mt-6 space-y-3 flex-1">
              {tier.features.map((f, j) => (
                <li key={j} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary shrink-0" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
            <Button className="mt-6 w-full" variant={tier.highlight ? 'default' : 'outline'} asChild>
              <Link to="/contact">{tier.cta}</Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
