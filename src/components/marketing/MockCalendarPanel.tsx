import { AppWindowFrame } from '@/components/mock-ui/AppWindowFrame';
import { cn } from '@/lib/utils';

const sampleDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const sampleCells = [
  [], [1], [2, 3], [4], [5], [], [],
  [], [6], [7], [8, 9], [10], [], [],
  [], [11], [12], [13], [14], [15], [],
];

export function MockCalendarPanel({ className }: { className?: string }) {
  return (
    <AppWindowFrame title="ServiceWise Calendar" className={className}>
      <div className="p-3 sm:p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold text-sm text-slate-900">February 2025</span>
          <span className="text-xs text-slate-500">Today</span>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium text-slate-500 mb-2">
          {sampleDays.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: 21 }).map((_, i) => {
            const day = sampleCells.flat()[i] ?? (i < 7 ? i + 20 : i - 6);
            const isToday = day === 2;
            const hasBooking = [2, 5, 9, 12, 15].includes(day);
            return (
              <div
                key={i}
                className={cn(
                  'aspect-square flex items-center justify-center rounded text-xs',
                  isToday && 'bg-slate-900 text-white font-semibold',
                  !isToday && hasBooking && 'bg-slate-100 text-slate-700',
                  !isToday && !hasBooking && 'text-slate-500'
                )}
              >
                {day}
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-slate-500 mt-2 text-center">Bookings shown on dates</p>
      </div>
    </AppWindowFrame>
  );
}
