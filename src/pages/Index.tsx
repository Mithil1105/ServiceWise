import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  Eye,
  Clock,
  AlertTriangle,
  FileWarning,
  FileText,
  CheckCircle,
  Users,
  BarChart3,
  Zap,
  TrendingUp,
  Shield,
  Star,
  Building2,
  Wallet,
  MapPin,
  Rocket,
} from 'lucide-react';
import { FullBleedBand } from '@/components/landing/FullBleedBand';
import { ScrollReveal } from '@/components/landing/ScrollReveal';
import { StaggerContainer, StaggerItem } from '@/components/landing/StaggerContainer';
import { MockDashboardLarge } from '@/components/landing/MockDashboardLarge';
import { DemoMotionPanel } from '@/components/landing/DemoMotionPanel';

const logoWallItems = [
  { icon: Building2, label: 'Ops Teams' },
  { icon: Wallet, label: 'Finance' },
  { icon: Users, label: 'Admin' },
  { icon: MapPin, label: 'Multi-Branch' },
  { icon: BarChart3, label: 'SMEs' },
  { icon: Rocket, label: 'Startups' },
];

const painPoints = [
  { icon: Eye, text: 'No visibility on who spent what' },
  { icon: Clock, text: 'Manual approvals & delays' },
  { icon: AlertTriangle, text: 'Balance mismatches and errors' },
  { icon: FileWarning, text: 'No audit trail or compliance' },
];

const howItWorksSteps = [
  { icon: FileText, title: 'Submit Expense', desc: 'Employees submit expense reports with receipts in seconds', num: 1 },
  { icon: CheckCircle, title: 'Verify & Review', desc: 'Engineers and managers verify expenses with full context', num: 2 },
  { icon: Users, title: 'Approve & Track', desc: 'Admin approves and balances update automatically', num: 3 },
  { icon: BarChart3, title: 'Report & Audit', desc: 'Generate reports and maintain complete audit trails', num: 4 },
];

const whyItems = [
  { icon: Zap, title: 'Faster Approvals', desc: 'Streamlined workflow moves expenses from submission to approval in hours, not days.' },
  { icon: TrendingUp, title: 'Real-time Balances', desc: 'Always know exactly how much petty cash is available across all your locations.' },
  { icon: Shield, title: 'Audit-ready Records', desc: 'Every transaction is logged with timestamps, actors, and complete documentation.' },
];

const testimonials = [
  { name: 'Maria Santos', role: 'Finance Lead', quote: 'ServiceWise transformed how we handle petty cash. We finally have full visibility and a clear audit trail.' },
  { name: 'Carlos Reyes', role: 'Operations Manager', quote: 'Approval workflow is so much faster. No more chasing people on WhatsApp for receipts.' },
  { name: 'Ana Lim', role: 'Regional Admin', quote: 'Managing multiple branches used to be a nightmare. Now we have real-time oversight in one place.' },
];

function TestimonialCard({ name, role, quote }: { name: string; role: string; quote: string }) {
  const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2);
  return (
    <div className="rounded-xl border bg-card shadow-soft card-hover p-6">
      <div className="flex gap-1 text-warning mb-3" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} className="h-4 w-4 fill-current" />
        ))}
      </div>
      <blockquote className="text-sm text-muted-foreground mb-4">&ldquo;{quote}&rdquo;</blockquote>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">
          {initials}
        </div>
        <div>
          <p className="font-medium text-foreground">{name}</p>
          <p className="text-xs text-muted-foreground">{role}</p>
        </div>
      </div>
    </div>
  );
}

export default function Index() {
  return (
    <main className="relative">
      {/* Hero */}
      <FullBleedBand variant="hero" className="py-20 md:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <ScrollReveal variant="fade-up">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl text-foreground">
              Petty Cash & Expense Management — <span className="gradient-text">Simplified.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl">
              Track employee expenses, automate approvals, and control balances — all in one secure platform.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Built for modern teams • Secure • Multi-organization ready
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="btn-glow" asChild>
                <Link to="/contact">
                  Get Started Free <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/auth">Login</Link>
              </Button>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fade-left" delay={0.2}>
            <div className="relative">
              <MockDashboardLarge className="w-full" />
              <div className="absolute -bottom-4 -right-4 w-64 md:w-[288px]">
                <DemoMotionPanel />
              </div>
            </div>
          </ScrollReveal>
        </div>
      </FullBleedBand>

      {/* Logo Wall */}
      <FullBleedBand variant="soft">
        <ScrollReveal variant="fade-up">
          <p className="text-center text-sm text-muted-foreground mb-8">
            Trusted by teams across industries
          </p>
          <div className="flex flex-wrap justify-center gap-8 md:gap-12">
            {logoWallItems.map(({ icon: Icon, label }, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden />
                <span className="text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </FullBleedBand>

      {/* Pain Points */}
      <FullBleedBand className="py-20">
        <ScrollReveal variant="fade-up" className="text-center">
          <h2 className="text-2xl font-bold sm:text-3xl text-foreground">
            Still managing petty cash on spreadsheets, WhatsApp, or emails?
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            You&apos;re not alone. Most teams struggle with manual expense tracking that leads to:
          </p>
        </ScrollReveal>
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-12">
          {painPoints.map(({ icon: Icon, text }, i) => (
            <StaggerItem key={i}>
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 flex items-start gap-4">
                <Icon className="h-6 w-6 text-destructive shrink-0 mt-0.5" aria-hidden />
                <p className="text-sm font-medium text-foreground">{text}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </FullBleedBand>

      {/* How It Works */}
      <FullBleedBand variant="soft" className="py-20">
        <ScrollReveal variant="fade-up" className="text-center mb-12">
          <h2 className="text-2xl font-bold sm:text-3xl text-foreground">How ServiceWise Works</h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            A simple, four-step process to streamline your expense management
          </p>
        </ScrollReveal>
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {howItWorksSteps.map(({ icon: Icon, title, desc, num }) => (
            <StaggerItem key={num}>
              <div className="rounded-xl border bg-card shadow-soft card-hover p-6 relative">
                <span className="absolute -top-3 -left-3 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                  {num}
                </span>
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="h-6 w-6 text-primary" aria-hidden />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
        <ScrollReveal variant="fade-up" delay={0.3} className="text-center mt-8">
          <Button variant="outline" size="lg" asChild>
            <Link to="/how-it-works">
              Learn more about the workflow <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </ScrollReveal>
      </FullBleedBand>

      {/* Why ServiceWise */}
      <FullBleedBand className="py-20">
        <ScrollReveal variant="fade-up" className="text-center mb-12">
          <h2 className="text-2xl font-bold sm:text-3xl text-foreground">Why ServiceWise?</h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Purpose-built for fleet and operations management
          </p>
        </ScrollReveal>
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {whyItems.map(({ icon: Icon, title, desc }) => (
            <StaggerItem key={title}>
              <div className="rounded-xl border bg-card shadow-soft card-hover p-8 text-center">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Icon className="h-8 w-8 text-primary" aria-hidden />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </FullBleedBand>

      {/* Testimonials */}
      <FullBleedBand variant="soft">
        <ScrollReveal variant="fade-up" className="text-center mb-10">
          <h2 className="text-2xl font-bold sm:text-3xl text-foreground">Loved by finance teams</h2>
          <p className="mt-4 text-muted-foreground">See what our users have to say</p>
        </ScrollReveal>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <TestimonialCard key={t.name} name={t.name} role={t.role} quote={t.quote} />
          ))}
        </div>
      </FullBleedBand>

      {/* CTA */}
      <FullBleedBand className="py-20">
        <ScrollReveal variant="scale">
          <div className="relative rounded-2xl bg-gradient-to-br from-primary to-primary/80 px-8 py-12 md:px-16 md:py-16 overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/10 blur-3xl -translate-y-1/2 translate-x-1/2" aria-hidden />
            <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-white/10 blur-2xl translate-y-1/2 -translate-x-1/2" aria-hidden />
            <div className="relative text-center text-primary-foreground">
              <h2 className="text-2xl font-bold sm:text-3xl">
                Take control of your expenses — without complexity.
              </h2>
              <p className="mt-4 text-primary-foreground/90 max-w-xl mx-auto">
                Join teams already simplifying their fleet and operations with ServiceWise.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
                <Button size="lg" variant="secondary" className="text-foreground" asChild>
                  <Link to="/contact">
                    Get Started Free <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                  </Link>
                </Button>
                <Button size="lg" variant="ghost" className="text-primary-foreground hover:bg-white/10" asChild>
                  <Link to="/auth">Login to Your Account</Link>
                </Button>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </FullBleedBand>
    </main>
  );
}
