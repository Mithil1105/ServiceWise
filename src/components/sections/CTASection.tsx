import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export function CTASection() {
  return (
    <section
      className="section-padding bg-primary text-primary-foreground"
      aria-labelledby="cta-heading"
    >
      <div className="section-container text-center">
        <h2 id="cta-heading" className="text-3xl md:text-4xl font-bold mb-6">
          Ready to simplify your fleet?
        </h2>
        <p className="text-lg text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
          Book a demo and we&apos;ll walk you through ServiceWise with your actual workflows.
        </p>
        <Button asChild size="lg" className="btn-accent bg-primary-foreground text-primary hover:bg-primary-foreground/90">
          <Link to="/contact">
            Request Demo <ArrowRight className="ml-2 w-5 h-5 inline-block" aria-hidden />
          </Link>
        </Button>
      </div>
    </section>
  );
}
