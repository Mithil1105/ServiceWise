import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { AppWindowFrame } from '@/components/mock-ui/AppWindowFrame';
import { cn } from '@/lib/utils';

const items = [
  { id: 'MH-01-AB-1234', status: 'Overdue', km: '500 km', variant: 'destructive' as const },
  { id: 'MH-01-CD-5678', status: 'Due soon', km: '200 km', variant: 'warning' as const },
  { id: 'MH-02-XY-9012', status: 'Due soon', km: '150 km', variant: 'warning' as const },
];

export function MockServiceAlerts({ className }: { className?: string }) {
  return (
    <AppWindowFrame title="ServiceWise Service Alerts" className={className}>
      <div className="p-4">
        <p className="font-semibold text-sm mb-3 text-slate-900">Service alerts</p>
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li
              key={i}
              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 sm:p-3"
            >
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-xs sm:text-sm truncate text-slate-900">{item.id}</p>
                <p className="text-[10px] sm:text-xs text-slate-500">{item.status} · {item.km}</p>
              </div>
              <Badge variant={item.variant} className="text-[10px] shrink-0">
                {item.status}
              </Badge>
            </li>
          ))}
        </ul>
      </div>
    </AppWindowFrame>
  );
}
