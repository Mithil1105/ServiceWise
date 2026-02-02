import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, isSameDay, eachDayOfInterval, startOfDay, endOfDay } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon } from 'lucide-react';
import { useBookingsForCalendar } from '@/hooks/use-bookings';
import { useCars } from '@/hooks/use-cars';
import { BookingStatusBadge } from '@/components/bookings/BookingStatusBadge';
import { BookingDetailsDrawer } from '@/components/bookings/BookingDetailsDrawer';
import { AvailabilityPopover } from '@/components/bookings/AvailabilityPopover';
import { cn } from '@/lib/utils';
import { BOOKING_STATUS_COLORS, type BookingWithDetails, type BookingStatus } from '@/types/booking';

type ViewType = 'month' | 'week' | 'day';

export default function BookingCalendar() {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewType>('month');
  const [selectedCar, setSelectedCar] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedBooking, setSelectedBooking] = useState<BookingWithDetails | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hoveredSlot, setHoveredSlot] = useState<{ start: Date; end: Date } | null>(null);

  const { data: cars } = useCars();

  // Calculate date range for query
  const dateRange = useMemo(() => {
    let start: Date, end: Date;
    if (view === 'month') {
      start = startOfWeek(startOfMonth(currentDate));
      end = endOfWeek(endOfMonth(currentDate));
    } else if (view === 'week') {
      start = startOfWeek(currentDate);
      end = endOfWeek(currentDate);
    } else {
      start = startOfDay(currentDate);
      end = endOfDay(currentDate);
    }
    return { start, end };
  }, [currentDate, view]);

  const { data: bookings, isLoading } = useBookingsForCalendar(dateRange.start, dateRange.end);

  // Filter bookings
  const filteredBookings = useMemo(() => {
    if (!bookings) return [];
    return bookings.filter(b => {
      if (selectedCar !== 'all') {
        const hasCar = b.booking_vehicles?.some(v => v.car_id === selectedCar);
        if (!hasCar) return false;
      }
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      return true;
    });
  }, [bookings, selectedCar, statusFilter]);

  // Navigation
  const navigateDate = useCallback((direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      if (view === 'month') return direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1);
      if (view === 'week') return direction === 'prev' ? subWeeks(prev, 1) : addWeeks(prev, 1);
      return direction === 'prev' ? subDays(prev, 1) : addDays(prev, 1);
    });
  }, [view]);

  // Get days for calendar grid
  const calendarDays = useMemo(() => {
    return eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
  }, [dateRange]);

  // Get bookings for a specific day
  const getBookingsForDay = useCallback((day: Date) => {
    return filteredBookings.filter(b => {
      const start = new Date(b.start_at);
      const end = new Date(b.end_at);
      return day >= startOfDay(start) && day <= endOfDay(end);
    });
  }, [filteredBookings]);

  const handleBookingClick = (booking: BookingWithDetails) => {
    setSelectedBooking(booking);
    setDrawerOpen(true);
  };

  const handleSlotHover = (day: Date) => {
    setHoveredSlot({ start: startOfDay(day), end: endOfDay(day) });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Booking Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visual view of all bookings
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/app/bookings')}>
            List View
          </Button>
          <Button onClick={() => navigate('/app/bookings/new')}>
            <Plus className="h-4 w-4 mr-2" />
            New Booking
          </Button>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => navigateDate('prev')}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => setCurrentDate(new Date())}>
                Today
              </Button>
              <Button variant="outline" size="icon" onClick={() => navigateDate('next')}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-semibold ml-2">
                {view === 'month' && format(currentDate, 'MMMM yyyy')}
                {view === 'week' && `${format(startOfWeek(currentDate), 'dd MMM')} - ${format(endOfWeek(currentDate), 'dd MMM yyyy')}`}
                {view === 'day' && format(currentDate, 'EEEE, dd MMMM yyyy')}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <Select value={view} onValueChange={(v) => setView(v as ViewType)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Month</SelectItem>
                  <SelectItem value="week">Week</SelectItem>
                  <SelectItem value="day">Day</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedCar} onValueChange={setSelectedCar}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Cars" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cars</SelectItem>
                  {cars?.map(car => (
                    <SelectItem key={car.id} value={car.id}>
                      {car.vehicle_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="inquiry">Inquiry</SelectItem>
                  <SelectItem value="tentative">Tentative</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="ongoing">Ongoing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-0">
          {/* Week day headers */}
          <div className="grid grid-cols-7 border-b">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground border-r last:border-r-0">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, idx) => {
              const dayBookings = getBookingsForDay(day);
              const isCurrentMonth = day.getMonth() === currentDate.getMonth();
              const isToday = isSameDay(day, new Date());

              return (
                <Popover key={idx}>
                  <PopoverTrigger asChild>
                    <div
                      className={cn(
                        'min-h-[100px] p-1 border-r border-b cursor-pointer hover:bg-muted/30 transition-colors',
                        !isCurrentMonth && 'bg-muted/10',
                        isToday && 'bg-primary/5'
                      )}
                      onMouseEnter={() => handleSlotHover(day)}
                      onMouseLeave={() => setHoveredSlot(null)}
                    >
                      <div className={cn(
                        'text-sm font-medium p-1',
                        !isCurrentMonth && 'text-muted-foreground',
                        isToday && 'text-primary'
                      )}>
                        {format(day, 'd')}
                      </div>
                      <div className="space-y-0.5 max-h-[80px] overflow-hidden">
                        {dayBookings.slice(0, 3).map(booking => (
                          <div
                            key={booking.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBookingClick(booking);
                            }}
                            className={cn(
                              'text-xs p-1 rounded truncate cursor-pointer',
                              BOOKING_STATUS_COLORS[booking.status].bg,
                              BOOKING_STATUS_COLORS[booking.status].text
                            )}
                          >
                            {booking.customer_name}
                          </div>
                        ))}
                        {dayBookings.length > 3 && (
                          <div className="text-xs text-muted-foreground px-1">
                            +{dayBookings.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-auto" align="start">
                    <AvailabilityPopover
                      startAt={startOfDay(day)}
                      endAt={endOfDay(day)}
                      onCheckAvailability={() => navigate(`/app/bookings/new?date=${format(day, 'yyyy-MM-dd')}`)}
                    />
                  </PopoverContent>
                </Popover>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Status Legend */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-4 text-sm">
            {(['inquiry', 'tentative', 'confirmed', 'ongoing', 'completed', 'cancelled'] as BookingStatus[]).map(status => (
              <div key={status} className="flex items-center gap-2">
                <div className={cn('w-3 h-3 rounded', BOOKING_STATUS_COLORS[status].bg)} />
                <BookingStatusBadge status={status} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Booking Details Drawer */}
      <BookingDetailsDrawer
        booking={selectedBooking}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onEdit={() => {
          setDrawerOpen(false);
          if (selectedBooking) navigate(`/app/bookings/${selectedBooking.id}/edit`);
        }}
        onViewInvoice={() => {
          if (selectedBooking) navigate(`/app/bookings/${selectedBooking.id}/bills`);
        }}
      />
    </div>
  );
}
