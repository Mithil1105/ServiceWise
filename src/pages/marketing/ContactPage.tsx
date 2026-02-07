import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, MessageSquare, Calendar, Eye, FileText, Mail, Phone, MapPin } from 'lucide-react';
import { SectionHeading } from '@/components/marketing/SectionHeading';
import { PageFAQ } from '@/components/marketing/PageFAQ';
import { PAGE_FAQS } from '@/lib/page-faqs';

const contactOptions = {
  email: 'info@unimisk.com',
  phones: ['+91 9426049048', '+91 8160325372', '+91 80008 45035'],
  location: '10th Floor, Stratum@Venus Ground, Nr. Janshi Rani Statue, C-1008, West wing, Nehru Nagar, Ahmedabad, Gujarat 380015',
  locationUrl: 'https://maps.google.com/?q=Stratum+Venus+Ground+Nehru+Nagar+Ahmedabad',
};

const demoBullets = [
  'Walkthrough of fleet, bookings, and billing.',
  'No double booking — how availability works.',
  'Advance capture and deposit tracking.',
  'Service rules and critical queue.',
  'Roles and permissions (Owner, Manager, Supervisor).',
];

const whatHappensNext = [
  { step: 'We reply', icon: MessageSquare },
  { step: 'We schedule', icon: Calendar },
  { step: 'You see your workflow', icon: Eye },
  { step: 'You get a quote', icon: FileText },
];

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone: string) {
  return /^[\d\s\-\+\(\)]{8,}$/.test(phone.trim());
}

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    companyName: '',
    fleetSize: '',
    city: '',
    contactPerson: '',
    phone: '',
    email: '',
    message: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!form.companyName.trim()) newErrors.companyName = 'Company name is required.';
    if (!form.contactPerson.trim()) newErrors.contactPerson = 'Contact person is required.';
    if (!form.phone.trim()) newErrors.phone = 'Phone is required.';
    else if (!isValidPhone(form.phone)) newErrors.phone = 'Enter a valid phone number.';
    if (!form.email.trim()) newErrors.email = 'Email is required.';
    else if (!isValidEmail(form.email)) newErrors.email = 'Enter a valid email.';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 800));
    setSubmitting(false);
    setSubmitted(true);
  };

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  if (submitted) {
    return (
      <div className="animate-fade-in">
        <section className="py-16 sm:py-24">
          <div className="container max-w-xl px-4 sm:px-6 text-center">
            <Card className="overflow-hidden shadow-lg border">
              <CardContent className="p-8 sm:p-10">
                <CheckCircle className="h-16 w-16 text-primary mx-auto mb-6" aria-hidden />
                <h1 className="text-2xl font-bold sm:text-3xl">Request received</h1>
                <p className="mt-4 text-muted-foreground">
                  Thanks for your interest. We’ll get back to you shortly to schedule a demo tailored to your fleet size.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Top: title + form & contact info */}
      <section className="border-b bg-muted/30 py-10 sm:py-14">
        <div className="container max-w-6xl px-4 sm:px-6">
          <SectionHeading
            title="Request Demo"
            subtitle="Tell us about your fleet. We’ll show a demo that matches your work."
            as="h1"
            className="text-center mb-10"
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-start">
            {/* Contact info – left */}
            <div className="space-y-6">
              <h2 className="text-xl font-bold">Contact Options</h2>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Mail className="h-5 w-5 text-primary" aria-hidden />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Email</h3>
                    <a href={`mailto:${contactOptions.email}`} className="text-muted-foreground hover:text-primary transition-colors break-all text-sm">
                      {contactOptions.email}
                    </a>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Phone className="h-5 w-5 text-primary" aria-hidden />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">Phone / WhatsApp</h3>
                    <ul className="space-y-2">
                      {contactOptions.phones.map((phone, i) => {
                        const tel = phone.replace(/\s/g, '');
                        const wa = tel.startsWith('+') ? tel.slice(1).replace(/\D/g, '') : tel.replace(/\D/g, '');
                        return (
                          <li key={i} className="text-muted-foreground text-sm">
                            {phone}
                            <span className="ml-2">
                              <a href={`tel:${tel}`} className="text-primary hover:underline">Call</a>
                              {' · '}
                              <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">WhatsApp</a>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-primary" aria-hidden />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Location</h3>
                    <a href={contactOptions.locationUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors block text-sm leading-relaxed">
                      {contactOptions.location}
                    </a>
                  </div>
                </div>
              </div>
            </div>
            {/* Form – right */}
            <Card className="w-full overflow-hidden shadow-md border">
              <CardContent className="p-6">
                <h2 className="text-xl font-bold mb-4">Send a request</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="companyName">Company name *</Label>
                    <Input
                      id="companyName"
                      value={form.companyName}
                      onChange={(e) => handleChange('companyName', e.target.value)}
                      className="mt-1"
                      required
                      aria-invalid={!!errors.companyName}
                    />
                    {errors.companyName && (
                      <p className="text-sm text-destructive mt-1">{errors.companyName}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="fleetSize">Fleet size</Label>
                    <Input
                      id="fleetSize"
                      value={form.fleetSize}
                      onChange={(e) => handleChange('fleetSize', e.target.value)}
                      className="mt-1"
                      placeholder="e.g. 10–50"
                    />
                  </div>
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={form.city}
                      onChange={(e) => handleChange('city', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="contactPerson">Contact person *</Label>
                    <Input
                      id="contactPerson"
                      value={form.contactPerson}
                      onChange={(e) => handleChange('contactPerson', e.target.value)}
                      className="mt-1"
                      required
                      aria-invalid={!!errors.contactPerson}
                    />
                    {errors.contactPerson && (
                      <p className="text-sm text-destructive mt-1">{errors.contactPerson}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={form.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      className="mt-1"
                      required
                      aria-invalid={!!errors.phone}
                    />
                    {errors.phone && (
                      <p className="text-sm text-destructive mt-1">{errors.phone}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      className="mt-1"
                      required
                      aria-invalid={!!errors.email}
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive mt-1">{errors.email}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="message">Message</Label>
                    <Textarea
                      id="message"
                      value={form.message}
                      onChange={(e) => handleChange('message', e.target.value)}
                      className="mt-1 min-h-[100px]"
                      placeholder="Any specific requirements or questions?"
                    />
                  </div>
                  <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
                    {submitting ? 'Sending…' : 'Submit'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* What the demo covers + What happens next – below */}
      <section className="py-12 sm:py-16 bg-muted/20 border-b">
        <div className="container max-w-6xl px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div>
              <h2 className="text-xl font-semibold mb-4">What the demo covers</h2>
              <ul className="space-y-3 list-disc list-inside text-muted-foreground">
                {demoBullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-4">What happens next</h2>
              <ul className="space-y-4">
                {whatHappensNext.map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <item.icon className="h-5 w-5 text-primary shrink-0" aria-hidden />
                    {item.step}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <PageFAQ items={PAGE_FAQS.contact} />
    </div>
  );
}
