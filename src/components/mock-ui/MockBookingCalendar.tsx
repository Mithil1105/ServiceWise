import { Badge } from '@/components/ui/badge';
import { AppWindowFrame } from '@/components/mock-ui/AppWindowFrame';
import { cn } from '@/lib/utils';

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const dates = [
  [null, null, 1, 2, 3, 4, 5],
  [6, 7, 8, 9, 10, 11, 12],
  [13, 14, 15, 16, 17, 18, 19],
  [20, 21, 22, 23, 24, 25, 26],
  [27, 28, 29, 30, 31, null, null],
];
const bookingDates = [2, 5, 9, 12, 16, 18, 23, 25];
const today = 16;

export function MockBookingCalendar({ className }: { className?: string }) {
  return (
    <AppWindowFrame title="ServiceWise Calendar" className={className}>
      <div className="p-4">
        <p className="font-semibold text-sm mb-3 text-slate-900">February 2025</p>
        <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium text-slate-500 mb-2">
          {days.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {dates.flat().map((d, i) => {
            if (d == null) return <div key={i} />;
            const hasBooking = bookingDates.includes(d);
            const isToday = d === today;
            return (
              <div
                key={i}
                className={cn(
                  'aspect-square flex items-center justify-center rounded text-xs font-medium',
                  isToday && 'bg-slate-900 text-white',
                  !isToday && hasBooking && 'bg-slate-100 text-slate-700',
                  !isToday && !hasBooking && 'text-slate-500'
                )}
              >
                {d}
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="secondary" className="text-[10px] border-slate-200">Inquiry</Badge>
          <Badge variant="default" className="text-[10px]">Confirmed</Badge>
        </div>
      </div>
    </AppWindowFrame>
  );
}
