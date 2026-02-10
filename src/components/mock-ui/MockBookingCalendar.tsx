import { useState } from 'react';
import { AppWindowFrame } from '@/components/mock-ui/AppWindowFrame';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type Status = 'confirmed' | 'ongoing' | 'hold';

const statusPills: { id: Status; label: string; className: string }[] = [
  { id: 'confirmed', label: 'Confirmed', className: 'bg-emerald-500 text-white' },
  { id: 'ongoing', label: 'Ongoing', className: 'bg-sky-100 text-sky-700' },
  { id: 'hold', label: 'Hold', className: 'bg-amber-100 text-amber-800' },
];

// Week view: 7 days with sample bookings (day index 0–6 = Mon–Sun)
const weekBookings: { dayIndex: number; time: string; status: Status }[] = [
  { dayIndex: 0, time: '09:00 ...', status: 'confirmed' },
  { dayIndex: 0, time: '14:00 ...', status: 'ongoing' },
  { dayIndex: 1, time: '10:00 ...', status: 'hold' },
  { dayIndex: 2, time: '08:00 ...', status: 'hold' },
  { dayIndex: 3, time: '15:30 ...', status: 'confirmed' },
  { dayIndex: 4, time: '06:00 ...', status: 'confirmed' },
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function MockBookingCalendar({ className }: { className?: string }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [activeFilter, setActiveFilter] = useState<Status | null>(null);
  const displayYear = 2026 + Math.floor((1 + monthOffset - 1) / 12);
  const monthIndex = (1 + monthOffset + 120) % 12;
  const monthName = `${MONTHS[monthIndex]} ${displayYear}`;

  const handlePrev = () => {
    setMonthOffset((o) => o - 1);
    toast({ title: 'Previous month', description: 'Demo calendar — sign up to use.' });
  };
  const handleNext = () => {
    setMonthOffset((o) => o + 1);
    toast({ title: 'Next month', description: 'Demo calendar — sign up to use.' });
  };
  const handleFilter = (id: Status) => {
    setActiveFilter(activeFilter === id ? null : id);
    toast({ title: id === 'confirmed' ? 'Confirmed' : id === 'ongoing' ? 'Ongoing' : 'Hold', description: 'Filter applied.' });
  };

  return (
    <AppWindowFrame title="Booking Calendar" className={className}>
      <div className="p-3 sm:p-4">
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={handlePrev}
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="font-semibold text-sm text-slate-900">{monthName}</p>
          <button
            type="button"
            onClick={handleNext}
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {statusPills.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleFilter(p.id)}
              className={cn(
                'px-2.5 py-1 rounded-full text-[10px] font-medium transition-all',
                p.className,
                activeFilter && activeFilter !== p.id && 'opacity-50'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium text-slate-500 mb-1">
          {days.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 min-h-[120px]">
          {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => {
            const bookings = weekBookings.filter((b) => b.dayIndex === dayIndex);
            return (
              <div
                key={dayIndex}
                className="rounded-lg border border-slate-200 bg-slate-50/50 p-1.5 space-y-1"
              >
                <span className="text-[10px] font-medium text-slate-500 block">
                  {dayIndex + 1}
                </span>
                {bookings.map((b, i) => {
                  const pill = statusPills.find((p) => p.id === b.status)!;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toast({ title: b.time, description: b.status })}
                      className={cn(
                        'w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium truncate transition-opacity hover:opacity-90',
                        pill.className
                      )}
                    >
                      {b.time}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </AppWindowFrame>
  );
}
