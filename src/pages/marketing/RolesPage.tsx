import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Shield, UserCheck, UserCog } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionHeading } from '@/components/marketing/SectionHeading';
import { PageFAQ } from '@/components/marketing/PageFAQ';
import { SmartImage } from '@/components/marketing/SmartImage';
import { RolesIllustrationSvg } from '@/components/marketing/illustrations';
import { PAGE_FAQS } from '@/lib/page-faqs';

const roles = [
  {
    name: 'Owner / Admin',
    icon: Shield,
    desc: 'Full control',
    capabilities: ['User management', 'System settings', 'All operations', 'Financials', 'Reports'],
  },
  {
    name: 'Manager',
    icon: UserCog,
    desc: 'Runs daily operations',
    capabilities: ['Bookings & billing', 'Fleet, drivers, services', 'Financial tracking', 'Limited settings'],
  },
  {
    name: 'Supervisor',
    icon: UserCheck,
    desc: 'Handles assigned cars only',
    capabilities: [
      'See assigned cars only',
      'Update odometer',
      'Log service',
      'View critical alerts',
      'No billing, no user/settings access',
    ],
  },
];

const permissionRows = [
  { feature: 'Bookings', admin: true, manager: true, supervisor: false },
  { feature: 'Billing', admin: true, manager: true, supervisor: false },
  { feature: 'Financials', admin: true, manager: true, supervisor: false },
  { feature: 'Fleet', admin: true, manager: true, supervisor: true },
  { feature: 'Drivers', admin: true, manager: true, supervisor: true },
  { feature: 'Odometer', admin: true, manager: true, supervisor: true },
  { feature: 'Services', admin: true, manager: true, supervisor: true },
  { feature: 'Critical Queue', admin: true, manager: true, supervisor: true },
  { feature: 'Settings', admin: true, manager: false, supervisor: false },
  { feature: 'Users', admin: true, manager: false, supervisor: false },
];

function PermissionCell({ has }: { has: boolean }) {
  return has ? (
    <span className="text-primary font-medium">✓</span>
  ) : (
    <span className="text-muted-foreground">—</span>
  );
}

export default function RolesPage() {
  return (
    <div className="animate-fade-in">
      <section className="border-b bg-muted/30 py-12 sm:py-16">
        <div className="container max-w-6xl px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <SectionHeading
                title="Roles & permissions"
                subtitle="Give the right access to the right people."
                as="h1"
              />
            </div>
            <div className="flex justify-center lg:justify-end">
              <RolesIllustrationSvg className="w-full max-w-[240px] text-muted-foreground" />
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="container max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-bold mb-8">Role cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {roles.map((r, i) => (
              <Card key={i} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <r.icon className="h-10 w-10 text-primary mb-3" aria-hidden />
                  <h3 className="font-semibold text-xl">{r.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{r.desc}</p>
                  <ul className="mt-4 space-y-2 list-disc list-inside text-sm text-muted-foreground">
                    {r.capabilities.map((c, j) => (
                      <li key={j}>{c}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16 bg-muted/30">
        <div className="container max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-bold mb-6">Who can do what</h2>
          {/* Desktop: table */}
          <div className="hidden md:block overflow-x-auto rounded-xl border bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-4 font-semibold">Feature</th>
                  <th className="text-center p-4 font-semibold">Owner / Admin</th>
                  <th className="text-center p-4 font-semibold">Manager</th>
                  <th className="text-center p-4 font-semibold">Supervisor</th>
                </tr>
              </thead>
              <tbody>
                {permissionRows.map((row, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="p-4">{row.feature}</td>
                    <td className="p-4 text-center"><PermissionCell has={row.admin} /></td>
                    <td className="p-4 text-center"><PermissionCell has={row.manager} /></td>
                    <td className="p-4 text-center"><PermissionCell has={row.supervisor} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile: per-role cards (Can do / Cannot do) */}
          <div className="md:hidden space-y-6">
            {[
              { role: 'Owner / Admin', getHas: (r: typeof permissionRows[0]) => r.admin },
              { role: 'Manager', getHas: (r: typeof permissionRows[0]) => r.manager },
              { role: 'Supervisor', getHas: (r: typeof permissionRows[0]) => r.supervisor },
            ].map(({ role, getHas }) => {
              const canDo = permissionRows.filter((r) => getHas(r)).map((r) => r.feature);
              const cannotDo = permissionRows.filter((r) => !getHas(r)).map((r) => r.feature);
              return (
                <Card key={role}>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-lg mb-3">{role}</h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Can do</p>
                        <ul className="space-y-1 text-sm">
                          {canDo.map((f) => (
                            <li key={f} className="flex items-center gap-2">
                              <span className="text-primary">✓</span> {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Cannot do</p>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          {cannotDo.map((f) => (
                            <li key={f}>— {f}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="container max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-bold mb-4">Supervisor view</h2>
          <p className="text-muted-foreground mb-4">
            Supervisors see only their assigned cars, with quick actions to log service or update odometer. No billing or user management.
          </p>
          <div className="rounded-xl border bg-muted/20 p-6 min-h-[140px] flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Assigned cars + quick actions</p>
          </div>
        </div>
      </section>

      <PageFAQ items={PAGE_FAQS.roles} />
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
