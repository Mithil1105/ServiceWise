import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Shield, Lock, FileText, Key, Check } from 'lucide-react';
import { SectionHeading } from '@/components/marketing/SectionHeading';
import { PageFAQ } from '@/components/marketing/PageFAQ';
import { LockIconSvg, ShieldIconSvg } from '@/components/marketing/illustrations';
import { PAGE_FAQS } from '@/lib/page-faqs';

const points = [
  {
    icon: Shield,
    title: 'Login security',
    desc: 'Only your team can sign in. Sessions are secure.',
  },
  {
    icon: Lock,
    title: 'Access control',
    desc: 'People only see what they should. Owner, manager, and supervisor have different views.',
  },
  {
    icon: FileText,
    title: 'Safe actions',
    desc: 'Sensitive actions (e.g. creating users) are protected and run on secure servers.',
  },
  {
    icon: FileText,
    title: 'History',
    desc: 'Changes and payments have a record. You can trace what changed and when.',
  },
  {
    icon: Key,
    title: 'No secret leakage',
    desc: 'Private keys are never shown in the browser. They stay on the server.',
  },
];

const trustChecklist = [
  'Secure sign-in',
  'Role-based access',
  'Sensitive actions protected',
  'Change history kept',
  'Secrets never exposed to the browser',
];

export default function SecurityPage() {
  return (
    <div className="animate-fade-in">
      <section className="border-b bg-muted/30 py-12 sm:py-16">
        <div className="container max-w-6xl px-4 sm:px-6">
          <SectionHeading
            title="Security & compliance"
            subtitle="Your data stays protected."
            as="h1"
          />
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="container max-w-6xl px-4 sm:px-6">
          <div className="space-y-6">
            {points.map((p, i) => {
              const Icon = p.icon;
              return (
                <Card key={i}>
                  <CardContent className="p-6 flex gap-4 items-start">
                    <div className="h-10 w-10 shrink-0 flex items-center justify-center text-primary">
                      {i === 0 ? <ShieldIconSvg className="h-8 w-8" /> : i === 1 ? <LockIconSvg className="h-8 w-8" /> : <Icon className="h-8 w-8" aria-hidden />}
                    </div>
                    <div>
                      <h2 className="font-semibold text-lg">{p.title}</h2>
                      <p className="text-muted-foreground mt-1">{p.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16 bg-muted/30">
        <div className="container max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-bold mb-6">Trust checklist</h2>
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {trustChecklist.map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary shrink-0" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <PageFAQ items={PAGE_FAQS.security} />
      <section className="py-12 border-t">
        <div className="container max-w-6xl px-4 sm:px-6 text-center">
          <Button asChild>
            <Link to="/contact">Request Demo</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
