import { Car, Calendar, Receipt, AlertTriangle } from 'lucide-react';
import { MiniBarChartSvg } from './illustrations';
import { AppWindowFrame } from '@/components/mock-ui/AppWindowFrame';
import { cn } from '@/lib/utils';

type Kpi = { label: string; value: string; icon: React.ComponentType<{ className?: string }> };

const defaultKpis: Kpi[] = [
  { label: 'Active vehicles', value: '24', icon: Car },
  { label: 'Bookings this week', value: '12', icon: Calendar },
  { label: 'Pending transfers', value: '3', icon: Receipt },
  { label: 'Critical queue', value: '2', icon: AlertTriangle },
];

const defaultAttention = [
  'MH-01-AB-1234: Service overdue by 500 km',
  'MH-01-CD-5678: Due soon (200 km)',
  'Transfer pending: ₹5,000 from personal',
  'Booking BKG-001: Advance not yet deposited',
];

type MockDashboardPanelProps = {
  kpis?: Kpi[];
  attention?: string[];
  className?: string;
};

export function MockDashboardPanel({
  kpis = defaultKpis,
  attention = defaultAttention,
  className,
}: MockDashboardPanelProps) {
  return (
    <AppWindowFrame title="ServiceWise Dashboard" className={className}>
      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-3 mb-4">
          {kpis.map((kpi, i) => {
            const Icon = kpi.icon;
            return (
              <div key={i} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 shadow-sm">
                <Icon className="h-5 w-5 text-slate-400 mb-1" aria-hidden />
                <p className="text-lg font-bold text-slate-900">{kpi.value}</p>
                <p className="text-xs text-slate-500">{kpi.label}</p>
              </div>
            );
          })}
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 h-[80px] flex items-center justify-center mb-4">
          <MiniBarChartSvg className="w-full h-full max-h-14 text-slate-400" />
        </div>
        <div>
          <p className="font-semibold text-sm mb-2 text-slate-900">Attention today</p>
          <ul className="space-y-1.5">
            {attention.map((item, i) => (
              <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppWindowFrame>
  );
}
