import { Calendar, DollarSign, FileText, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { AppWindowFrame } from '@/components/mock-ui/AppWindowFrame';
import { cn } from '@/lib/utils';

const kpis = [
  { value: '24', label: 'Active Bookings', change: '+12%', trend: 'up' as const, icon: Calendar },
  { value: '$4,280', label: 'Revenue Today', change: '+8%', trend: 'up' as const, icon: DollarSign },
  { value: '7', label: 'Pending Bills', change: '-3', trend: 'down' as const, icon: FileText },
  { value: '3', label: 'Alerts', change: 'urgent', trend: 'neutral' as const, icon: AlertTriangle },
];

const attentionItems = [
  { title: 'Vehicle #12 service due in 2 days', time: '2h ago', dotColor: 'bg-amber-500' },
  { title: 'Booking #458 payment overdue', time: '4h ago', dotColor: 'bg-red-500' },
  { title: 'Driver John completed 5 trips today', time: '5h ago', dotColor: 'bg-blue-500' },
];

export function MockDashboard({ className }: { className?: string }) {
  return (
    <AppWindowFrame title="ServiceWise Dashboard" className={className}>
      <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
        {/* KPI grid: 2×2 desktop, 1 col mobile */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {kpis.map((kpi, i) => {
            const Icon = kpi.icon;
            return (
              <div
                key={i}
                className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm min-w-0"
              >
                <div className="flex items-start justify-between gap-2">
                  <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-slate-400 shrink-0 mt-0.5" aria-hidden />
                  {kpi.trend !== 'neutral' && (
                    <span className="shrink-0" aria-hidden>
                      {kpi.trend === 'up' ? (
                        <TrendingUp className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      )}
                    </span>
                  )}
                  {kpi.trend === 'neutral' && (
                    <span className="text-[10px] sm:text-xs font-medium text-amber-600 shrink-0">urgent</span>
                  )}
                </div>
                <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{kpi.value}</p>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{kpi.label}</p>
                {kpi.trend !== 'neutral' && (
                  <p className={cn(
                    'text-[10px] sm:text-xs font-medium mt-1',
                    kpi.trend === 'up' ? 'text-emerald-600' : 'text-red-500'
                  )}>
                    {kpi.change}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Needs Attention */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden min-w-0">
          <div className="px-3 py-2 sm:px-4 border-b border-slate-100">
            <p className="font-semibold text-xs sm:text-sm text-slate-900">Needs Attention</p>
          </div>
          <ul className="divide-y divide-slate-100">
            {attentionItems.map((item, i) => (
              <li key={i} className="flex items-center gap-2 px-3 py-2 sm:px-4 min-w-0">
                <span className={cn('h-2 w-2 shrink-0 rounded-full', item.dotColor)} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-slate-900 truncate">{item.title}</p>
                  <p className="text-[10px] sm:text-xs text-slate-500">{item.time}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppWindowFrame>
  );
}
