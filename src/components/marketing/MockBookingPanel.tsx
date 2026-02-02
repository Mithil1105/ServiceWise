import { Car } from 'lucide-react';
import { AppWindowFrame } from '@/components/mock-ui/AppWindowFrame';
import { cn } from '@/lib/utils';

const sampleRows = [
  { customer: 'ABC Travels', car: 'MH-01-AB-1234', dates: 'Feb 2 – Feb 5', status: 'Confirmed' },
  { customer: 'XYZ Tours', car: 'MH-02-CD-5678', dates: 'Feb 3 – Feb 4', status: 'Ongoing' },
];

export function MockBookingPanel({ className }: { className?: string }) {
  return (
    <AppWindowFrame title="ServiceWise Bookings" className={className}>
      <div className="p-4">
        <p className="font-semibold text-sm mb-3 text-slate-900">Recent bookings</p>
        <ul className="space-y-2">
          {sampleRows.map((row, i) => (
            <li key={i} className="rounded-lg border border-slate-200 bg-slate-50/50 p-2 text-xs">
              <p className="font-medium text-slate-900">{row.customer}</p>
              <p className="text-slate-500 flex items-center gap-1 mt-1">
                <Car className="h-3 w-3" aria-hidden /> {row.car} · {row.dates}
              </p>
              <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-medium">
                {row.status}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </AppWindowFrame>
  );
}
