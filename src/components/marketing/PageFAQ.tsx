import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import type { FaqItem } from '@/lib/page-faqs';

type PageFAQProps = {
  items: FaqItem[];
  title?: string;
  subtitle?: string;
  className?: string;
};

export function PageFAQ({ items, title = 'Frequently asked questions', subtitle, className = '' }: PageFAQProps) {
  if (!items.length) return null;

  return (
    <section className={`py-12 sm:py-16 border-t bg-muted/20 ${className}`} aria-labelledby="faq-heading">
      <div className="container max-w-3xl px-4 sm:px-6 mx-auto">
        <h2 id="faq-heading" className="text-2xl font-bold mb-2">
          {title}
        </h2>
        {subtitle && <p className="text-muted-foreground mb-6">{subtitle}</p>}
        <Accordion type="single" collapsible className="w-full">
          {items.map((faq, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-left">{faq.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{faq.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
