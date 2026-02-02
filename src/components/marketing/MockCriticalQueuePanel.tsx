import { AlertTriangle, Wrench } from 'lucide-react';
import { AppWindowFrame } from '@/components/mock-ui/AppWindowFrame';
import { cn } from '@/lib/utils';

const sampleItems = [
  { id: 'MH-01-AB-1234', status: 'Overdue', km: '500 km', icon: AlertTriangle },
  { id: 'MH-01-CD-5678', status: 'Due soon', km: '200 km', icon: AlertTriangle },
  { id: 'MH-02-XY-9012', status: 'Due soon', km: '150 km', icon: Wrench },
];

export function MockCriticalQueuePanel({ className }: { className?: string }) {
  return (
    <AppWindowFrame title="ServiceWise Service Alerts" className={className}>
      <div className="p-4">
        <p className="font-semibold text-sm mb-3 text-slate-900">Service alerts</p>
        <ul className="space-y-2">
          {sampleItems.map((item, i) => (
            <li
              key={i}
              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-2 text-sm"
            >
              <item.icon className="h-4 w-4 text-amber-500 shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900 truncate">{item.id}</p>
                <p className="text-xs text-slate-500">{item.status} · {item.km}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </AppWindowFrame>
  );
}
