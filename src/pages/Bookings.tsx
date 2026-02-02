import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDateOnly, formatTime12hr, formatDateTimeFull } from '@/lib/date';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Calendar, Search, Phone, MapPin, Car, Eye, Edit, FileText, Loader2 } from 'lucide-react';
import { useBookings } from '@/hooks/use-bookings';
import { BookingStatusBadge } from '@/components/bookings/BookingStatusBadge';
import { BookingDetailsDrawer } from '@/components/bookings/BookingDetailsDrawer';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TRIP_TYPE_LABELS, type BookingWithDetails, type BookingStatus } from '@/types/booking';
import { useSystemConfig } from '@/hooks/use-dashboard';

export default function Bookings() {
  const navigate = useNavigate();
  const { data: bookings, isLoading } = useBookings();
  const { data: minKmPerKm } = useSystemConfig('minimum_km_per_km');
  const { data: minKmHybridPerDay } = useSystemConfig('minimum_km_hybrid_per_day');
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedBooking, setSelectedBooking] = useState<BookingWithDetails | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filteredBookings = useMemo(() => {
    if (!bookings) return [];
    return bookings.filter(b => {
      // Status filter
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesCustomer = b.customer_name.toLowerCase().includes(searchLower);
        const matchesPhone = b.customer_phone.includes(search);
        const matchesRef = b.booking_ref.toLowerCase().includes(searchLower);
        const matchesVehicle = b.booking_vehicles?.some(v => 
          v.car?.vehicle_number?.toLowerCase().includes(searchLower)
        );
        if (!matchesCustomer && !matchesPhone && !matchesRef && !matchesVehicle) return false;
      }
      
      return true;
    });
  }, [bookings, search, statusFilter]);

  const formatDateTime = (date: string) => {
    return formatDateTimeFull(date);
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '—';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getTotalAmount = (booking: BookingWithDetails) => {
    // First try to get from assigned vehicles
    if (booking.booking_vehicles && booking.booking_vehicles.length > 0) {
      const total = booking.booking_vehicles.reduce(
        (sum, v) => sum + (v.computed_total || v.rate_total || 0), 
        0
      );
      if (total > 0) return total;
    }

    // If no assigned vehicles or amount is 0, calculate from requested vehicles
    if (booking.booking_requested_vehicles && booking.booking_requested_vehicles.length > 0) {
      const startDate = new Date(booking.start_at);
      const endDate = new Date(booking.end_at);
      const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) || 1;
      const estimatedKm = booking.estimated_km || 0;
      const thresholdKmPerDay = minKmPerKm ? Number(minKmPerKm) : 300;
      const thresholdHybridPerDay = minKmHybridPerDay ? Number(minKmHybridPerDay) : 300;

      return booking.booking_requested_vehicles.reduce((sum, rv) => {
        switch (rv.rate_type) {
          case 'total':
            return sum + (rv.rate_total || 0);
          case 'per_day':
            return sum + (days * (rv.rate_per_day || 0));
          case 'per_km':
            // Apply threshold: days × threshold_km_per_day
            const totalMinKm = thresholdKmPerDay * days;
            const kmToCharge = Math.max(estimatedKm, totalMinKm);
            return sum + ((rv.rate_per_km || 0) * kmToCharge);
          case 'hybrid':
            const hybridMinKm = Math.max(estimatedKm, thresholdHybridPerDay * days);
            return sum + (days * (rv.rate_per_day || 0)) + ((rv.rate_per_km || 0) * hybridMinKm);
          default:
            return sum;
        }
      }, 0);
    }

    return 0;
  };

  const handleViewBooking = (booking: BookingWithDetails) => {
    setSelectedBooking(booking);
    setDrawerOpen(true);
  };

  // Stats
  const stats = useMemo(() => {
    if (!bookings) return { total: 0, confirmed: 0, ongoing: 0, pending: 0 };
    return {
      total: bookings.length,
      confirmed: bookings.filter(b => b.status === 'confirmed').length,
      ongoing: bookings.filter(b => b.status === 'ongoing').length,
      pending: bookings.filter(b => b.status === 'inquiry' || b.status === 'tentative').length,
    };
  }, [bookings]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Bookings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage all customer bookings
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/app/bookings/calendar')}>
            <Calendar className="h-4 w-4 mr-2" />
            Calendar View
          </Button>
          <Button onClick={() => navigate('/app/bookings/new')}>
            <Plus className="h-4 w-4 mr-2" />
            New Booking
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-sm text-muted-foreground">Total Bookings</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-blue-600">{stats.confirmed}</p>
            <p className="text-sm text-muted-foreground">Confirmed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-purple-600">{stats.ongoing}</p>
            <p className="text-sm text-muted-foreground">Ongoing</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-warning">{stats.pending}</p>
            <p className="text-sm text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by customer, phone, booking ref, or vehicle..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="inquiry">Inquiry</SelectItem>
                <SelectItem value="tentative">Tentative</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="ongoing">Ongoing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Bookings Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredBookings.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Booking Ref</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Trip Dates</TableHead>
                    <TableHead>Vehicles</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date Created</TableHead>
                    <TableHead>Booked By</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBookings.map((booking) => (
                    <TableRow key={booking.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleViewBooking(booking)}>
                      <TableCell className="font-mono text-sm font-medium">
                        {booking.booking_ref}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{booking.customer_name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {booking.customer_phone}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{formatDateOnly(booking.start_at)} {formatTime12hr(booking.start_at)}</p>
                          <p className="text-xs text-muted-foreground">
                            to {formatDateOnly(booking.end_at)} {formatTime12hr(booking.end_at)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {booking.booking_vehicles && booking.booking_vehicles.length > 0 ? (
                          <div className="flex items-center gap-1">
                            <Car className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              {booking.booking_vehicles.length === 1 
                                ? booking.booking_vehicles[0].car?.vehicle_number 
                                : `${booking.booking_vehicles.length} vehicles`}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(getTotalAmount(booking))}
                      </TableCell>
                      <TableCell>
                        <BookingStatusBadge status={booking.status} />
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{formatDateOnly(booking.created_at)}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatTime12hr(booking.created_at)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {booking.created_by_profile?.name || 'Unknown'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => handleViewBooking(booking)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>View Details</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => navigate(`/app/bookings/${booking.id}/edit`)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Edit Booking</p>
                              </TooltipContent>
                            </Tooltip>
                            {(booking.status === 'confirmed' || booking.status === 'ongoing' || booking.status === 'completed') && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" onClick={() => navigate(`/bookings/${booking.id}/bills`)}>
                                    <FileText className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>View Bills</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <p className="text-muted-foreground">No bookings found</p>
              <Button onClick={() => navigate('/app/bookings/new')}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Booking
              </Button>
            </div>
          )}
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
        onViewHistory={() => {
          if (selectedBooking) navigate(`/app/bookings/${selectedBooking.id}/history`);
        }}
      />
    </div>
  );
}
