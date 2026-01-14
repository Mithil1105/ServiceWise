import { cn } from '@/lib/utils';
import { BOOKING_STATUS_COLORS, BOOKING_STATUS_LABELS, type BookingStatus } from '@/types/booking';

interface BookingStatusBadgeProps {
  status: BookingStatus;
  className?: string;
}

export function BookingStatusBadge({ status, className }: BookingStatusBadgeProps) {
  const colors = BOOKING_STATUS_COLORS[status];
  
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        colors.bg,
        colors.text,
        colors.border,
        className
      )}
    >
      {BOOKING_STATUS_LABELS[status]}
    </span>
  );
}
