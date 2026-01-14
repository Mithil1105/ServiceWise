import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Calendar, Search, Phone, MapPin, Car, Eye, Edit, FileText, Loader2 } from 'lucide-react';
import { useBookings } from '@/hooks/use-bookings';
import { BookingStatusBadge } from '@/components/bookings/BookingStatusBadge';
import { BookingDetailsDrawer } from '@/components/bookings/BookingDetailsDrawer';
import { TRIP_TYPE_LABELS, type BookingWithDetails, type BookingStatus } from '@/types/booking';

export default function Bookings() {
  const navigate = useNavigate();
  const { data: bookings, isLoading } = useBookings();
  
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
    return format(new Date(date), 'dd MMM yyyy, hh:mm a');
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
    return booking.booking_vehicles?.reduce(
      (sum, v) => sum + (v.computed_total || v.rate_total || 0), 
      0
    ) || 0;
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
          <Button variant="outline" onClick={() => navigate('/bookings/calendar')}>
            <Calendar className="h-4 w-4 mr-2" />
            Calendar View
          </Button>
          <Button onClick={() => navigate('/bookings/new')}>
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
                          <p>{format(new Date(booking.start_at), 'dd MMM, HH:mm')}</p>
                          <p className="text-xs text-muted-foreground">
                            to {format(new Date(booking.end_at), 'dd MMM, HH:mm')}
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
                        <span className="text-sm text-muted-foreground">
                          {booking.created_by_profile?.name || 'Unknown'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" onClick={() => handleViewBooking(booking)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => navigate(`/bookings/${booking.id}/edit`)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          {booking.status === 'confirmed' && (
                            <Button variant="ghost" size="icon" onClick={() => navigate(`/bookings/${booking.id}/invoice`)}>
                              <FileText className="h-4 w-4" />
                            </Button>
                          )}
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
              <Button onClick={() => navigate('/bookings/new')}>
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
          if (selectedBooking) navigate(`/bookings/${selectedBooking.id}/edit`);
        }}
        onViewInvoice={() => {
          if (selectedBooking) navigate(`/bookings/${selectedBooking.id}/invoice`);
        }}
        onViewHistory={() => {
          if (selectedBooking) navigate(`/bookings/${selectedBooking.id}/history`);
        }}
      />
    </div>
  );
}
