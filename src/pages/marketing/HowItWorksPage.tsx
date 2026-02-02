import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  MessageSquare,
  Clock,
  CheckCircle,
  MapPin,
  FileCheck,
  FileText,
  Wallet,
  CreditCard,
  ArrowDown,
} from 'lucide-react';
import { PageFAQ } from '@/components/marketing/PageFAQ';
import { MockDashboard } from '@/components/mock-ui/MockDashboard';
import { MockServiceAlerts } from '@/components/mock-ui/MockServiceAlerts';
import { PAGE_FAQS } from '@/lib/page-faqs';
import type { LucideIcon } from 'lucide-react';

type FlowStep = {
  lane: string;
  icon: LucideIcon;
  label: string;
  description: string;
  color: string;
  lightColor: string;
  textColor: string;
};

const flowSteps: FlowStep[] = [
  { lane: 'Booking', icon: MessageSquare, label: 'Inquiry', description: 'Customer reaches out', color: 'bg-blue-500', lightColor: 'bg-blue-50', textColor: 'text-blue-700' },
  { lane: 'Booking', icon: Clock, label: 'Hold', description: 'Provisional booking', color: 'bg-amber-500', lightColor: 'bg-amber-50', textColor: 'text-amber-700' },
  { lane: 'Booking', icon: CheckCircle, label: 'Confirmed', description: 'Booking locked in', color: 'bg-emerald-500', lightColor: 'bg-emerald-50', textColor: 'text-emerald-700' },
  { lane: 'Trip', icon: MapPin, label: 'Ongoing', description: 'Trip in progress', color: 'bg-purple-500', lightColor: 'bg-purple-50', textColor: 'text-purple-700' },
  { lane: 'Trip', icon: FileCheck, label: 'Completed', description: 'Trip finished', color: 'bg-teal-500', lightColor: 'bg-teal-50', textColor: 'text-teal-700' },
  { lane: 'Money', icon: FileText, label: 'Bill', description: 'Invoice generated', color: 'bg-orange-500', lightColor: 'bg-orange-50', textColor: 'text-orange-700' },
  { lane: 'Money', icon: Wallet, label: 'Deposit/Transfer', description: 'Payment received', color: 'bg-indigo-500', lightColor: 'bg-indigo-50', textColor: 'text-indigo-700' },
  { lane: 'Money', icon: CreditCard, label: 'Paid', description: 'Booking closed', color: 'bg-green-500', lightColor: 'bg-green-50', textColor: 'text-green-700' },
];

const lanes = ['Booking', 'Trip', 'Money'];

const laneColors: Record<string, string> = {
  Booking: 'border-blue-300 bg-blue-50/50',
  Trip: 'border-purple-300 bg-purple-50/50',
  Money: 'border-green-300 bg-green-50/50',
};

export default function HowItWorksPage() {
  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <section
        className="py-16 md:py-24 bg-gradient-to-b from-primary/10 via-background to-muted/30"
        aria-label="Page header"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
              How ServiceWise Works
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground">
              From first inquiry to final payment — see the complete journey.
            </p>
          </div>
        </div>
      </section>

      {/* Main Flowchart */}
      <section className="py-16 md:py-24 bg-background" aria-labelledby="flow-heading">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-12">
            <h2 id="flow-heading" className="text-2xl md:text-3xl font-bold mb-4 text-foreground">
              The Complete Booking Flow
            </h2>
            <p className="text-muted-foreground">
              Every step organized by lane: Booking, Trip, and Money
            </p>
          </div>

          {/* Desktop: lane rows with horizontal nodes + arrows */}
          <div className="hidden lg:block">
            <div className="space-y-4">
              {lanes.map((lane) => (
                <div
                  key={lane}
                  className={`p-6 rounded-2xl border-2 ${laneColors[lane]}`}
                  role="region"
                  aria-label={`${lane} lane`}
                >
                  <div className="flex items-center gap-6">
                    <div className="w-24 flex-shrink-0">
                      <span className="font-bold text-lg text-foreground">{lane}</span>
                    </div>
                    <div className="flex-1 flex items-center gap-4 min-w-0 overflow-x-hidden">
                      {flowSteps
                        .filter((s) => s.lane === lane)
                        .map((step, idx, arr) => (
                          <div key={`${lane}-${step.label}`} className="flex items-center gap-4 flex-shrink-0">
                            <div
                              className={`${step.lightColor} rounded-2xl p-4 flex items-center gap-3 shadow-sm border border-border transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 min-w-[140px]`}
                              role="listitem"
                              aria-label={`${step.label}: ${step.description}`}
                            >
                              <div className={`w-12 h-12 rounded-xl ${step.color} flex items-center justify-center flex-shrink-0`}>
                                <step.icon className="w-6 h-6 text-white" aria-hidden />
                              </div>
                              <div className="min-w-0">
                                <p className={`font-semibold text-sm ${step.textColor}`}>{step.label}</p>
                                <p className="text-xs text-muted-foreground truncate">{step.description}</p>
                              </div>
                            </div>
                            {idx < arr.length - 1 && (
                              <ArrowRight className="w-6 h-6 text-muted-foreground flex-shrink-0" aria-hidden />
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-center my-4" aria-hidden>
              <div className="flex flex-col items-center">
                <ArrowDown className="w-6 h-6 text-accent" />
                <span className="text-xs text-muted-foreground mt-1">Flow continues</span>
              </div>
            </div>
          </div>

          {/* Mobile: stacked lanes with down arrows */}
          <div className="lg:hidden space-y-6">
            {lanes.map((lane) => (
              <div
                key={lane}
                className={`p-4 rounded-2xl border-2 ${laneColors[lane]}`}
                role="region"
                aria-label={`${lane} lane`}
              >
                <h3 className="font-bold text-lg mb-4 text-foreground">{lane} Lane</h3>
                <div className="space-y-3">
                  {flowSteps
                    .filter((s) => s.lane === lane)
                    .map((step, idx, arr) => (
                      <div key={`${lane}-${step.label}`}>
                        <div
                          className={`${step.lightColor} rounded-xl p-3 flex items-center gap-3 shadow-sm border border-border transition-all duration-200 active:scale-[0.99]`}
                          role="listitem"
                          aria-label={`${step.label}: ${step.description}`}
                        >
                          <div className={`w-10 h-10 rounded-lg ${step.color} flex items-center justify-center flex-shrink-0`}>
                            <step.icon className="w-5 h-5 text-white" aria-hidden />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`font-semibold text-sm ${step.textColor}`}>{step.label}</p>
                            <p className="text-xs text-muted-foreground">{step.description}</p>
                          </div>
                        </div>
                        {idx < arr.length - 1 && (
                          <div className="flex justify-center py-2" aria-hidden>
                            <ArrowDown className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What You'll See - Mock UI */}
      <section className="py-16 md:py-24 bg-muted/30" aria-labelledby="what-you-see-heading">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-12">
            <h2 id="what-you-see-heading" className="text-2xl md:text-3xl font-bold mb-4 text-foreground">
              What You&apos;ll See
            </h2>
            <p className="text-muted-foreground">Real screens from ServiceWise</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4 text-foreground">Dashboard Overview</h3>
              <MockDashboard />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4 text-foreground">Service Alerts</h3>
              <MockServiceAlerts />
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <PageFAQ items={PAGE_FAQS['how-it-works']} />
      <section
        className="py-16 md:py-24 bg-primary text-primary-foreground"
        aria-labelledby="cta-heading"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <h2 id="cta-heading" className="text-3xl md:text-4xl font-bold mb-6">
            Ready to see it in action?
          </h2>
          <p className="text-lg text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
            Book a demo and we&apos;ll walk you through the entire flow with your actual business scenarios.
          </p>
          <Button asChild size="lg" variant="secondary" className="bg-primary-foreground text-primary hover:bg-primary-foreground/90">
            <Link to="/contact">
              Request Demo <ArrowRight className="ml-2 w-5 h-5 inline-block" aria-hidden />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
