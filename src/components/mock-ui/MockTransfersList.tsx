import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { AppWindowFrame } from '@/components/mock-ui/AppWindowFrame';
import { cn } from '@/lib/utils';

const pending = [
  { id: 'BKG-001', amount: '₹5,000', method: 'Cash' },
  { id: 'BKG-002', amount: '₹3,200', method: 'Personal' },
];
const completed = [
  { id: 'BKG-000', amount: '₹8,100', date: 'Jan 28' },
];

export function MockTransfersList({ className }: { className?: string }) {
  const [active, setActive] = useState<'pending' | 'completed'>('pending');
  return (
    <AppWindowFrame title="ServiceWise Transfers" className={className}>
      <div className="p-0">
        <div className="flex border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActive('pending')}
            className={cn(
              'flex-1 py-3 px-4 text-sm font-medium transition-colors',
              active === 'pending'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
            )}
          >
            Pending
          </button>
          <button
            type="button"
            onClick={() => setActive('completed')}
            className={cn(
              'flex-1 py-3 px-4 text-sm font-medium transition-colors',
              active === 'completed'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
            )}
          >
            Completed
          </button>
        </div>
        <div className="p-4">
          {active === 'pending' && (
            <ul className="space-y-2">
              {pending.map((t, i) => (
                <li key={i} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 text-sm">
                  <span className="font-medium text-slate-900">{t.id}</span>
                  <span className="font-semibold text-slate-900">{t.amount}</span>
                  <Badge variant="secondary" className="text-[10px] border-slate-200">{t.method}</Badge>
                </li>
              ))}
            </ul>
          )}
          {active === 'completed' && (
            <ul className="space-y-2">
              {completed.map((t, i) => (
                <li key={i} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 text-sm">
                  <span className="font-medium text-slate-900">{t.id}</span>
                  <span className="font-semibold text-slate-900">{t.amount}</span>
                  <span className="text-xs text-slate-500">{t.date}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppWindowFrame>
  );
}
