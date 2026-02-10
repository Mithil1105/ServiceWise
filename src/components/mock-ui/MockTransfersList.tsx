import { useState } from 'react';
import { AppWindowFrame } from '@/components/mock-ui/AppWindowFrame';
import { cn } from '@/lib/utils';
import { Check, ArrowLeftRight, Clock, Filter } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

type Tab = 'all' | 'deposits' | 'transfers';

const rows = [
  { id: 'TRF-001', client: 'Grand Hotels', type: 'deposit' as const, amount: '$2,850', status: 'completed' as const, date: 'Feb 1, 2026' },
  { id: 'TRF-002', client: 'City Tours Ltd', type: 'transfer' as const, amount: '$1,200', status: 'pending' as const, date: 'Feb 2, 2026' },
  { id: 'TRF-003', client: 'Event Corp', type: 'deposit' as const, amount: '$4,500', status: 'completed' as const, date: 'Jan 30, 2026' },
  { id: 'TRF-004', client: 'Wedding Planners', type: 'transfer' as const, amount: '$3,200', status: 'pending' as const, date: 'Feb 2, 2026' },
  { id: 'TRF-005', client: 'Airport Services', type: 'deposit' as const, amount: '$890', status: 'completed' as const, date: 'Jan 29, 2026' },
];

export function MockTransfersList({ className }: { className?: string }) {
  const [tab, setTab] = useState<Tab>('all');

  const handleFilter = () => toast({ title: 'Filter', description: 'Filter options would open.' });

  const filtered =
    tab === 'deposits'
      ? rows.filter((r) => r.type === 'deposit')
      : tab === 'transfers'
        ? rows.filter((r) => r.type === 'transfer')
        : rows;
  const visibleRows = filtered.slice(0, 3);

  return (
    <AppWindowFrame title="Money Transfers" className={className}>
      <div className="p-0 flex flex-col">
        <div className="p-3 sm:p-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
              <Check className="h-4 w-4 text-emerald-600 mb-1" aria-hidden />
              <p className="text-lg font-bold text-emerald-800">$8,240</p>
              <p className="text-[10px] text-slate-600">This week</p>
            </div>
            <div className="rounded-lg bg-sky-50 border border-sky-100 p-3">
              <ArrowLeftRight className="h-4 w-4 text-sky-600 mb-1" aria-hidden />
              <p className="text-lg font-bold text-sky-800">$4,400</p>
              <p className="text-[10px] text-slate-600">Pending</p>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
              <Clock className="h-4 w-4 text-slate-600 mb-1" aria-hidden />
              <p className="text-lg font-bold text-slate-800">4</p>
              <p className="text-[10px] text-slate-600">Transactions</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(['all', 'deposits', 'transfers'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize',
                  tab === t
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                {t}
              </button>
            ))}
            <button
              type="button"
              onClick={handleFilter}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
            >
              <Filter className="h-3.5 w-3.5" aria-hidden />
              Filter
            </button>
          </div>
        </div>

        <div className="overflow-hidden border-t border-slate-200">
          <table className="w-full text-left text-[10px] sm:text-xs min-w-[280px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="py-1.5 px-2 font-semibold text-slate-700">ID</th>
                <th className="py-1.5 px-2 font-semibold text-slate-700">Client</th>
                <th className="py-1.5 px-2 font-semibold text-slate-700">Type</th>
                <th className="py-1.5 px-2 font-semibold text-slate-700">Amount</th>
                <th className="py-1.5 px-2 font-semibold text-slate-700">Status</th>
                <th className="py-1.5 px-2 font-semibold text-slate-700">Date</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r, i) => (
                <tr
                  key={r.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 cursor-pointer transition-colors"
                  onClick={() => toast({ title: r.id, description: `${r.client} — ${r.amount}` })}
                >
                  <td className="py-1.5 px-2 font-medium text-slate-800">{r.id}</td>
                  <td className="py-1.5 px-2 text-slate-800">{r.client}</td>
                  <td className="py-1.5 px-2">
                    {r.type === 'deposit' ? (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                        <Check className="h-3 w-3" /> deposit
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-sky-100 text-sky-700">
                        <ArrowLeftRight className="h-3 w-3" /> transfer
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 px-2 font-semibold text-slate-900">{r.amount}</td>
                  <td className="py-1.5 px-2">
                    {r.status === 'completed' ? (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                        <Check className="h-3 w-3" /> completed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                        <Clock className="h-3 w-3" /> pending
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 px-2 text-slate-500">{r.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppWindowFrame>
  );
}
