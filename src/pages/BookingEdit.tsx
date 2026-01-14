import { useState, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Car, Check, X, Plus, Trash2, Loader2, AlertTriangle, History } from 'lucide-react';
import { useBooking, useUpdateBooking, useAvailableCars, useAssignVehicle, useRemoveVehicle } from '@/hooks/use-bookings';
import { BookingStatusBadge } from '@/components/bookings/BookingStatusBadge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { TRIP_TYPE_LABELS, RATE_TYPE_LABELS, BOOKING_STATUS_LABELS, type TripType, type RateType, type BookingStatus } from '@/types/booking';

interface VehicleAssignment {
  id?: string;
  car_id: string;
  vehicle_number: string;
  model: string;
  driver_name: string;
  driver_phone: string;
  rate_type: RateType;
  rate_total: number | string;
  rate_per_day: number | string;
  rate_per_km: number | string;
  estimated_km: number | string;
  advance_amount: number | string;
  isNew?: boolean;
}

export default function BookingEdit() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: booking, isLoading } = useBooking(id);
  const updateBooking = useUpdateBooking();
  const assignVehicle = useAssignVehicle();
  const removeVehicle = useRemoveVehicle();

  // Form state - initialized from booking data
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [tripType, setTripType] = useState<TripType>('local');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<BookingStatus>('inquiry');
  const [initialized, setInitialized] = useState(false);

  // Confirmation dialogs
  const [confirmDialog, setConfirmDialog] = useState<{ type: 'status' | 'dates' | 'vehicle' | null; message: string }>({ type: null, message: '' });
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);

  // Vehicle management
  const [selectedVehicles, setSelectedVehicles] = useState<VehicleAssignment[]>([]);
  const [showVehicleSelect, setShowVehicleSelect] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form from booking data
  if (booking && !initialized) {
    setCustomerName(booking.customer_name);
    setCustomerPhone(booking.customer_phone);
    setTripType(booking.trip_type);
    setStartAt(format(new Date(booking.start_at), "yyyy-MM-dd'T'HH:mm"));
    setEndAt(format(new Date(booking.end_at), "yyyy-MM-dd'T'HH:mm"));
    setPickup(booking.pickup || '');
    setDropoff(booking.dropoff || '');
    setNotes(booking.notes || '');
    setStatus(booking.status);
    
    // Initialize vehicles
    if (booking.booking_vehicles) {
      setSelectedVehicles(booking.booking_vehicles.map(v => ({
        id: v.id,
        car_id: v.car_id,
        vehicle_number: v.car?.vehicle_number || 'Unknown',
        model: v.car?.model || '',
        driver_name: v.driver_name || '',
        driver_phone: v.driver_phone || '',
        rate_type: v.rate_type,
        rate_total: v.rate_total || '',
        rate_per_day: v.rate_per_day || '',
        rate_per_km: v.rate_per_km || '',
        estimated_km: v.estimated_km || '',
        advance_amount: v.advance_amount || '',
        isNew: false,
      })));
    }
    setInitialized(true);
  }

  // Parse dates
  const startDate = startAt ? new Date(startAt) : null;
  const endDate = endAt ? new Date(endAt) : null;

  // Check availability for new vehicles
  const { data: availableCars, isLoading: loadingCars } = useAvailableCars(startDate, endDate, id);

  const availableForSelection = useMemo(() => {
    if (!availableCars) return [];
    const selectedIds = new Set(selectedVehicles.map(v => v.car_id));
    return availableCars.filter(c => c.is_available && !selectedIds.has(c.car_id));
  }, [availableCars, selectedVehicles]);

  // Calculate totals
  const calculateVehicleTotal = (v: VehicleAssignment): number => {
    if (!startDate || !endDate) return 0;
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) || 1;
    
    switch (v.rate_type) {
      case 'total': return Number(v.rate_total) || 0;
      case 'per_day': return days * (Number(v.rate_per_day) || 0);
      case 'per_km': return (Number(v.rate_per_km) || 0) * (Number(v.estimated_km) || 0);
      case 'hybrid': return (days * (Number(v.rate_per_day) || 0)) + ((Number(v.rate_per_km) || 0) * (Number(v.estimated_km) || 0));
      default: return 0;
    }
  };

  const grandTotal = selectedVehicles.reduce((sum, v) => sum + calculateVehicleTotal(v), 0);
  const totalAdvance = selectedVehicles.reduce((sum, v) => sum + (Number(v.advance_amount) || 0), 0);

  const handleAddVehicle = (car: typeof availableForSelection[0]) => {
    setSelectedVehicles(prev => [...prev, {
      car_id: car.car_id,
      vehicle_number: car.vehicle_number,
      model: car.model,
      driver_name: '',
      driver_phone: '',
      rate_type: 'total',
      rate_total: '',
      rate_per_day: '',
      rate_per_km: '',
      estimated_km: '',
      advance_amount: '',
      isNew: true,
    }]);
    setShowVehicleSelect(false);
  };

  const handleRemoveVehicle = async (vehicle: VehicleAssignment) => {
    if (vehicle.id && !vehicle.isNew) {
      // Existing vehicle - needs confirmation and DB delete
      setConfirmDialog({
        type: 'vehicle',
        message: `Remove ${vehicle.vehicle_number} from this booking?`,
      });
      setPendingAction(() => async () => {
        await removeVehicle.mutateAsync({ vehicleId: vehicle.id!, bookingId: id! });
        setSelectedVehicles(prev => prev.filter(v => v.car_id !== vehicle.car_id));
      });
    } else {
      // New vehicle - just remove from state
      setSelectedVehicles(prev => prev.filter(v => v.car_id !== vehicle.car_id));
    }
  };

  const updateVehicle = (carId: string, field: keyof VehicleAssignment, value: string) => {
    setSelectedVehicles(prev => prev.map(v => 
      v.car_id === carId ? { ...v, [field]: value } : v
    ));
  };

  const handleStatusChange = (newStatus: BookingStatus) => {
    if (newStatus === 'confirmed' || newStatus === 'ongoing') {
      setConfirmDialog({
        type: 'status',
        message: `Change status to "${BOOKING_STATUS_LABELS[newStatus]}"? This action will be logged.`,
      });
      setPendingAction(() => async () => {
        setStatus(newStatus);
      });
    } else {
      setStatus(newStatus);
    }
  };

  const handleDateChange = (field: 'start' | 'end', value: string) => {
    const oldStart = startAt;
    const oldEnd = endAt;
    
    if (field === 'start') setStartAt(value);
    else setEndAt(value);

    // If dates changed significantly, show confirmation
    if (booking && (field === 'start' ? value !== format(new Date(booking.start_at), "yyyy-MM-dd'T'HH:mm") : value !== format(new Date(booking.end_at), "yyyy-MM-dd'T'HH:mm"))) {
      // We'll check on submit instead
    }
  };

  const validateForm = (): boolean => {
    if (!customerName.trim()) { toast.error('Customer name is required'); return false; }
    if (!customerPhone.trim()) { toast.error('Customer phone is required'); return false; }
    if (!startAt || !endAt) { toast.error('Start and end dates are required'); return false; }
    if (new Date(startAt) >= new Date(endAt)) { toast.error('End date must be after start date'); return false; }
    
    for (const v of selectedVehicles) {
      if (v.rate_type === 'per_km' || v.rate_type === 'hybrid') {
        if (!v.estimated_km || Number(v.estimated_km) <= 0) {
          toast.error(`Estimated KM is required for ${v.vehicle_number}`);
          return false;
        }
      }
      const total = calculateVehicleTotal(v);
      if (Number(v.advance_amount) > total) {
        toast.error(`Advance cannot exceed total for ${v.vehicle_number}`);
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !id) return;

    // Check if dates changed
    const datesChanged = booking && (
      startAt !== format(new Date(booking.start_at), "yyyy-MM-dd'T'HH:mm") ||
      endAt !== format(new Date(booking.end_at), "yyyy-MM-dd'T'HH:mm")
    );

    const statusChanged = booking && status !== booking.status;

    if (datesChanged || (statusChanged && (status === 'confirmed' || status === 'ongoing'))) {
      setConfirmDialog({
        type: datesChanged ? 'dates' : 'status',
        message: datesChanged 
          ? 'You are changing the booking dates. This may affect vehicle availability. Continue?'
          : `Confirm status change to "${BOOKING_STATUS_LABELS[status]}"?`,
      });
      setPendingAction(() => executeSubmit);
      return;
    }

    await executeSubmit();
  };

  const executeSubmit = async () => {
    if (!id) return;
    setIsSubmitting(true);
    
    try {
      // Update booking
      await updateBooking.mutateAsync({
        id,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        trip_type: tripType,
        start_at: new Date(startAt).toISOString(),
        end_at: new Date(endAt).toISOString(),
        pickup: pickup.trim() || null,
        dropoff: dropoff.trim() || null,
        notes: notes.trim() || null,
        status,
      });

      // Handle vehicle changes
      for (const v of selectedVehicles) {
        if (v.isNew) {
          // New vehicle assignment
          await assignVehicle.mutateAsync({
            booking_id: id,
            car_id: v.car_id,
            driver_name: v.driver_name || undefined,
            driver_phone: v.driver_phone || undefined,
            rate_type: v.rate_type,
            rate_total: v.rate_type === 'total' ? Number(v.rate_total) : undefined,
            rate_per_day: ['per_day', 'hybrid'].includes(v.rate_type) ? Number(v.rate_per_day) : undefined,
            rate_per_km: ['per_km', 'hybrid'].includes(v.rate_type) ? Number(v.rate_per_km) : undefined,
            estimated_km: ['per_km', 'hybrid'].includes(v.rate_type) ? Number(v.estimated_km) : undefined,
            advance_amount: Number(v.advance_amount) || 0,
          });
        } else {
          // Update existing - use assign which does upsert
          await assignVehicle.mutateAsync({
            booking_id: id,
            car_id: v.car_id,
            driver_name: v.driver_name || undefined,
            driver_phone: v.driver_phone || undefined,
            rate_type: v.rate_type,
            rate_total: v.rate_type === 'total' ? Number(v.rate_total) : undefined,
            rate_per_day: ['per_day', 'hybrid'].includes(v.rate_type) ? Number(v.rate_per_day) : undefined,
            rate_per_km: ['per_km', 'hybrid'].includes(v.rate_type) ? Number(v.rate_per_km) : undefined,
            estimated_km: ['per_km', 'hybrid'].includes(v.rate_type) ? Number(v.estimated_km) : undefined,
            advance_amount: Number(v.advance_amount) || 0,
          });
        }
      }

      navigate('/bookings/calendar');
    } catch (error) {
      // Error handled in mutations
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmAction = async () => {
    if (pendingAction) {
      await pendingAction();
      setPendingAction(null);
    }
    setConfirmDialog({ type: null, message: '' });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  };

  if (isLoading || !booking) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="page-title">Edit Booking</h1>
              <BookingStatusBadge status={booking.status} />
            </div>
            <p className="text-sm text-muted-foreground">{booking.booking_ref}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/bookings/${id}/history`)}>
            <History className="h-4 w-4 mr-1" />
            History
          </Button>
          <Button size="sm" onClick={() => navigate('/bookings/new')}>
            <Plus className="h-4 w-4 mr-1" />
            New Booking
          </Button>
        </div>
      </div>

      {/* Customer & Trip Details */}
      <Card>
        <CardHeader><CardTitle>Trip Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Customer Name *</Label>
              <Input value={customerName} onChange={e => setCustomerName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Phone *</Label>
              <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Trip Type</Label>
              <Select value={tripType} onValueChange={(v) => setTripType(v as TripType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TRIP_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Start Date & Time *</Label>
              <Input type="datetime-local" value={startAt} onChange={e => handleDateChange('start', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>End Date & Time *</Label>
              <Input type="datetime-local" value={endAt} onChange={e => handleDateChange('end', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Pickup Location</Label>
              <Input value={pickup} onChange={e => setPickup(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Drop Location</Label>
              <Input value={dropoff} onChange={e => setDropoff(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
        </CardContent>
      </Card>

      {/* Vehicle Assignment - same as BookingNew */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Assigned Vehicles</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setShowVehicleSelect(true)} disabled={!startDate || !endDate}>
            <Plus className="h-4 w-4 mr-1" /> Add Vehicle
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showVehicleSelect && (
            <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Select a Vehicle</h4>
                <Button variant="ghost" size="sm" onClick={() => setShowVehicleSelect(false)}>Cancel</Button>
              </div>
              {loadingCars ? (
                <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
              ) : availableForSelection.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {availableForSelection.map(car => (
                    <div key={car.car_id} className="flex items-center justify-between p-2 border rounded bg-background hover:bg-muted/50 cursor-pointer" onClick={() => handleAddVehicle(car)}>
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-success" />
                        <span className="font-medium">{car.vehicle_number}</span>
                        <span className="text-sm text-muted-foreground">({car.model})</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No available vehicles for selected dates</p>
              )}
            </div>
          )}

          {selectedVehicles.map(vehicle => (
            <div key={vehicle.car_id} className="p-4 border rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">{vehicle.vehicle_number}</span>
                  <span className="text-sm text-muted-foreground">({vehicle.model})</span>
                  {vehicle.isNew && <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded">New</span>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleRemoveVehicle(vehicle)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Driver Name</Label>
                  <Input value={vehicle.driver_name} onChange={e => updateVehicle(vehicle.car_id, 'driver_name', e.target.value)} placeholder="Optional" className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Driver Phone</Label>
                  <Input value={vehicle.driver_phone} onChange={e => updateVehicle(vehicle.car_id, 'driver_phone', e.target.value)} placeholder="Optional" className="h-8 text-sm" />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Rate Type</Label>
                  <Select value={vehicle.rate_type} onValueChange={v => updateVehicle(vehicle.car_id, 'rate_type', v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(RATE_TYPE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {vehicle.rate_type === 'total' && (
                  <div className="space-y-1">
                    <Label className="text-xs">Total Amount (₹)</Label>
                    <Input type="number" value={vehicle.rate_total} onChange={e => updateVehicle(vehicle.car_id, 'rate_total', e.target.value)} className="h-8 text-sm" />
                  </div>
                )}
                {['per_day', 'hybrid'].includes(vehicle.rate_type) && (
                  <div className="space-y-1">
                    <Label className="text-xs">Rate/Day (₹)</Label>
                    <Input type="number" value={vehicle.rate_per_day} onChange={e => updateVehicle(vehicle.car_id, 'rate_per_day', e.target.value)} className="h-8 text-sm" />
                  </div>
                )}
                {['per_km', 'hybrid'].includes(vehicle.rate_type) && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs">Rate/KM (₹)</Label>
                      <Input type="number" value={vehicle.rate_per_km} onChange={e => updateVehicle(vehicle.car_id, 'rate_per_km', e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Est. KM *</Label>
                      <Input type="number" value={vehicle.estimated_km} onChange={e => updateVehicle(vehicle.car_id, 'estimated_km', e.target.value)} className="h-8 text-sm" />
                    </div>
                  </>
                )}
                <div className="space-y-1">
                  <Label className="text-xs">Advance (₹)</Label>
                  <Input type="number" value={vehicle.advance_amount} onChange={e => updateVehicle(vehicle.car_id, 'advance_amount', e.target.value)} className="h-8 text-sm" />
                </div>
              </div>

              <div className="flex justify-end text-sm">
                <span className="text-muted-foreground mr-2">Computed Total:</span>
                <span className="font-semibold">{formatCurrency(calculateVehicleTotal(vehicle))}</span>
              </div>
            </div>
          ))}

          {selectedVehicles.length === 0 && !showVehicleSelect && (
            <p className="text-center text-muted-foreground py-8">No vehicles assigned.</p>
          )}
        </CardContent>
      </Card>

      {/* Quote Summary */}
      {selectedVehicles.length > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">Quote Summary</p>
                <p className="text-2xl font-bold">{formatCurrency(grandTotal)}</p>
                <p className="text-sm text-success">Advance: {formatCurrency(totalAdvance)} | Due: {formatCurrency(grandTotal - totalAdvance)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Select value={status} onValueChange={v => handleStatusChange(v as BookingStatus)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inquiry">Inquiry</SelectItem>
                <SelectItem value="tentative">Tentative</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="ongoing">Ongoing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.type !== null} onOpenChange={() => setConfirmDialog({ type: null, message: '' })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Confirm Action
            </DialogTitle>
            <DialogDescription>{confirmDialog.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog({ type: null, message: '' })}>Cancel</Button>
            <Button onClick={handleConfirmAction}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
