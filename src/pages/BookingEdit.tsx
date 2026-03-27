import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams, Link, Navigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Car, Check, X, Plus, Trash2, Loader2, AlertTriangle, History, MapPin } from 'lucide-react';
import { useBooking, useUpdateBooking, useAvailableCars, useAssignVehicle, useRemoveVehicle } from '@/hooks/use-bookings';
import { useAuth } from '@/lib/auth-context';
import { useAssignedCarIdsForCurrentUser } from '@/hooks/use-car-assignments';
import { BookingStatusBadge } from '@/components/bookings/BookingStatusBadge';
import { DriverAutocomplete } from '@/components/bookings/DriverAutocomplete';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { RATE_TYPE_LABELS, BOOKING_STATUS_LABELS, type RateType, type BookingStatus } from '@/types/booking';
import { useSystemConfig } from '@/hooks/use-dashboard';
import { useOrganizationSettings } from '@/hooks/use-organization-settings';
import { DEFAULT_TRIP_TYPE_OPTIONS } from '@/types/form-config';
import { useBankAccounts } from '@/hooks/use-bank-accounts';
import { getEstimatedKmFromDistance } from '@/lib/estimated-km';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useOpenBookingAccess } from '@/hooks/use-projects';

interface VehicleAssignment {
  id?: string;
  car_id: string;
  vehicle_number: string;
  model: string;
  vehicle_class?: 'lmv' | 'hmv';
  driver_name: string;
  driver_phone: string;
  requested_vehicle_id?: string | null; // Link to requested vehicle
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
  const { isSupervisor, isAdmin, isManager } = useAuth();
  const isSupervisorMode = isSupervisor && !isAdmin && !isManager;
  const { assignedCarIds } = useAssignedCarIdsForCurrentUser();
  const { data: booking, isLoading } = useBooking(id);
  const updateBooking = useUpdateBooking();
  const assignVehicle = useAssignVehicle();
  const removeVehicle = useRemoveVehicle();
  const { data: minKmPerKm } = useSystemConfig('minimum_km_per_km');
  const { data: minKmHybridPerDay } = useSystemConfig('minimum_km_hybrid_per_day');
  const { data: companyAccounts } = useBankAccounts('company');
  const { data: personalAccounts } = useBankAccounts('personal');
  const { data: orgSettings } = useOrganizationSettings();
  const { data: canOpenSupervisorBook = false } = useOpenBookingAccess();
  const tripTypeOptions = (orgSettings?.booking_form_config?.tripTypeOptions?.length ? orgSettings.booking_form_config.tripTypeOptions : DEFAULT_TRIP_TYPE_OPTIONS).filter((o) => o.value && o.label);
  const supervisorAssignmentMode = (orgSettings?.supervisor_assignment_mode ?? 'project') as 'project' | 'legacy';

  // Form state - initialized from booking data
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [tripType, setTripType] = useState<string>('local');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<BookingStatus>('inquiry');
  const [estimatedKm, setEstimatedKm] = useState('');
  const [estimatedKmFormula, setEstimatedKmFormula] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  
  // Advance payment state
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advancePaymentMethod, setAdvancePaymentMethod] = useState<'cash' | 'online' | ''>('');
  const [advanceCollectedBy, setAdvanceCollectedBy] = useState('');
  const [advanceAccountType, setAdvanceAccountType] = useState<'company' | 'personal' | ''>('');
  const [advanceAccountId, setAdvanceAccountId] = useState<string | null>(null);

  // Confirmation dialogs
  const [confirmDialog, setConfirmDialog] = useState<{ type: 'status' | 'dates' | 'vehicle' | null; message: string }>({ type: null, message: '' });
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);

  // Vehicle management
  const [selectedVehicles, setSelectedVehicles] = useState<VehicleAssignment[]>([]);
  const [showVehicleSelect, setShowVehicleSelect] = useState(false);
  const [selectedRequestedVehicleId, setSelectedRequestedVehicleId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when navigating to a different booking
  useEffect(() => {
    setInitialized(false);
  }, [id]);

  // Initialize form from booking data
  if (booking && booking.id === id && !initialized) {
    setCustomerName(booking.customer_name);
    setCustomerPhone(booking.customer_phone);
    setTripType(booking.trip_type ?? 'local');
    setStartAt(format(new Date(booking.start_at), "yyyy-MM-dd'T'HH:mm"));
    setEndAt(format(new Date(booking.end_at), "yyyy-MM-dd'T'HH:mm"));
    setPickup(booking.pickup || '');
    setDropoff(booking.dropoff || '');
    setNotes(booking.notes || '');
    setStatus(booking.status);
    setEstimatedKm(booking.estimated_km != null ? String(booking.estimated_km) : '');
    
    // Initialize advance payment
    setAdvanceAmount(booking.advance_amount ? booking.advance_amount.toString() : '');
    setAdvancePaymentMethod(booking.advance_payment_method || '');
    setAdvanceCollectedBy(booking.advance_collected_by || '');
    setAdvanceAccountType(booking.advance_account_type || '');
    setAdvanceAccountId(booking.advance_account_id || null);
    
    // Initialize vehicles
    if (booking.booking_vehicles) {
      setSelectedVehicles(booking.booking_vehicles.map(v => ({
        id: v.id,
        car_id: v.car_id,
        vehicle_number: v.car?.vehicle_number || 'Unknown',
        model: v.car?.model || '',
        vehicle_class: (v.car as { vehicle_class?: 'lmv' | 'hmv' })?.vehicle_class ?? 'lmv',
        driver_name: v.driver_name || '',
        driver_phone: v.driver_phone || '',
        requested_vehicle_id: (v as any).requested_vehicle_id || null,
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
  
  // Check if advance can be edited (only if advance is 0 or booking is cancelled)
  const canEditAdvance = !booking?.advance_amount || booking.advance_amount === 0 || booking?.status === 'cancelled';

  // Parse dates
  const startDate = startAt ? new Date(startAt) : null;
  const endDate = endAt ? new Date(endAt) : null;

  // Check availability for new vehicles
  const { data: availableCars, isLoading: loadingCars } = useAvailableCars(startDate, endDate, id);

  const availableForSelection = useMemo(() => {
    if (!availableCars) return [];
    let list = availableCars.filter(c => c.is_available);
    if (isSupervisorMode && assignedCarIds) {
      list = list.filter(c => assignedCarIds.includes(c.car_id));
    }
    const selectedIds = new Set(selectedVehicles.map(v => v.car_id));
    return list.filter(c => !selectedIds.has(c.car_id));
  }, [availableCars, selectedVehicles, isSupervisorMode, assignedCarIds]);

  // Calculate totals with threshold logic
  const calculateVehicleTotal = (v: VehicleAssignment): number => {
    if (!startDate || !endDate) return 0;
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) || 1;
    
    // Use booking's estimated_km if available, otherwise fall back to vehicle's estimated_km
    const estimatedKm = booking?.estimated_km || Number(v.estimated_km) || 0;
    const thresholdKmPerDay = minKmPerKm ? Number(minKmPerKm) : 300;
    const thresholdHybridPerDay = minKmHybridPerDay ? Number(minKmHybridPerDay) : 300;
    
    switch (v.rate_type) {
      case 'total': 
        return Number(v.rate_total) || 0;
      
      case 'per_day': 
        return days * (Number(v.rate_per_day) || 0);
      
      case 'per_km': 
        // Apply threshold: days × threshold_km_per_day = minimum KM
        const totalMinKm = thresholdKmPerDay * days;
        const kmToCharge = Math.max(estimatedKm, totalMinKm);
        return (Number(v.rate_per_km) || 0) * kmToCharge;
      
      case 'hybrid': 
        // Apply threshold for hybrid: days × threshold_hybrid_per_day = minimum KM
        const hybridMinKm = Math.max(estimatedKm, thresholdHybridPerDay * days);
        return (days * (Number(v.rate_per_day) || 0)) + ((Number(v.rate_per_km) || 0) * hybridMinKm);
      
      default: 
        return 0;
    }
  };

  const grandTotal = selectedVehicles.reduce((sum, v) => sum + calculateVehicleTotal(v), 0);
  const totalAdvance = selectedVehicles.reduce((sum, v) => sum + (Number(v.advance_amount) || 0), 0);

  const handleAddVehicle = (car: typeof availableForSelection[0], requestedVehicleId?: string) => {
    // If requested vehicle is provided, auto-fill rates from it
    let rateData: Partial<VehicleAssignment> = {
      rate_type: 'total',
      rate_total: '',
      rate_per_day: '',
      rate_per_km: '',
      estimated_km: '',
    };

    if (requestedVehicleId && booking?.booking_requested_vehicles) {
      const requestedVehicle = booking.booking_requested_vehicles.find(rv => rv.id === requestedVehicleId);
      if (requestedVehicle) {
        const estKmValue = estimatedKm.trim() ? estimatedKm : (booking.estimated_km != null ? String(booking.estimated_km) : '');
        rateData = {
          requested_vehicle_id: requestedVehicleId,
          rate_type: requestedVehicle.rate_type,
          rate_total: requestedVehicle.rate_total || '',
          rate_per_day: requestedVehicle.rate_per_day || '',
          rate_per_km: requestedVehicle.rate_per_km || '',
          estimated_km: estKmValue,
        };
      }
    }

    setSelectedVehicles(prev => [...prev, {
      car_id: car.car_id,
      vehicle_number: car.vehicle_number,
      model: car.model,
      vehicle_class: car.vehicle_class ?? 'lmv',
      driver_name: '',
      driver_phone: '',
      ...rateData,
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
    } else if (newStatus === 'cancelled') {
      setConfirmDialog({
        type: 'status',
        message: `Are you sure you want to cancel this booking? This action cannot be undone.`,
      });
      setPendingAction(() => async () => {
        setStatus('cancelled');
        await executeSubmit();
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
    
    const assignPayload = (v: VehicleAssignment) => ({
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
      requested_vehicle_id: v.requested_vehicle_id || null,
    });

    try {
      if (!isSupervisorMode) {
        // Update booking (admin/manager)
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
          estimated_km: estimatedKm.trim() ? Number(estimatedKm) : null,
          status,
          ...(canEditAdvance ? {
            advance_amount: Number(advanceAmount) || 0,
            advance_payment_method: advancePaymentMethod || null,
            advance_collected_by: advanceCollectedBy.trim() || null,
            advance_account_type: advanceAccountType || null,
            advance_account_id: advanceAccountId || null,
          } : {}),
        });
      }

      // Handle vehicle changes: assign new vehicles, upsert existing (driver/rates)
      for (const v of selectedVehicles) {
        await assignVehicle.mutateAsync(assignPayload(v));
      }

      navigate(isSupervisorMode ? '/app/bookings' : '/app/bookings/calendar');
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

  if (isSupervisorMode && booking.status !== 'confirmed' && booking.status !== 'ongoing') {
    return <Navigate to="/app/bookings" replace />;
  }

  if (isSupervisorMode && supervisorAssignmentMode === 'project' && !canOpenSupervisorBook) {
    return <Navigate to="/app/bookings" replace />;
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(isSupervisorMode ? '/app/bookings' : -1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="page-title">{isSupervisorMode ? 'Assign vehicles' : 'Edit Booking'}</h1>
              <BookingStatusBadge status={booking.status} />
            </div>
            <p className="text-sm text-muted-foreground">{booking.booking_ref}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/app/bookings/${id}/history`)}>
            <History className="h-4 w-4 mr-1" />
            History
          </Button>
          {!isSupervisorMode && (
            <Button size="sm" onClick={() => navigate('/app/bookings/new')}>
              <Plus className="h-4 w-4 mr-1" />
              New Booking
            </Button>
          )}
        </div>
      </div>

      {/* Supervisor: read-only booking summary */}
      {isSupervisorMode && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Booking summary</CardTitle>
            <CardDescription>Destination, dates, requested vehicles and creator</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Customer</p>
              <p className="font-medium">{booking.customer_name}</p>
              <p className="text-muted-foreground">{booking.customer_phone}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Dates</p>
              <p className="font-medium">{format(new Date(booking.start_at), 'dd MMM yyyy, HH:mm')}</p>
              <p className="text-muted-foreground">to {format(new Date(booking.end_at), 'dd MMM yyyy, HH:mm')}</p>
            </div>
            <div>
              <p className="text-muted-foreground">From / Pickup</p>
              <p className="font-medium">{booking.pickup || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">To / Dropoff</p>
              <p className="font-medium">{booking.dropoff || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Requested vehicles</p>
              <p className="font-medium">
                {booking.booking_requested_vehicles?.length
                  ? booking.booking_requested_vehicles.map((rv, i) => `${rv.brand} ${rv.model}`).join(', ')
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Created by</p>
              <p className="font-medium">{booking.created_by_profile?.name ?? '—'}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Customer & Trip Details - hidden for supervisor */}
      {!isSupervisorMode && (
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
              <Select value={tripType} onValueChange={setTripType}>
                <SelectTrigger><SelectValue placeholder="Select trip type" /></SelectTrigger>
                <SelectContent>
                  {tripTypeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
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
          {pickup && dropoff && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  const { calculateDistance } = await import('@/lib/google-maps');
                  const result = await calculateDistance(pickup, dropoff);
                  if (result.error) {
                    toast.error(result.error);
                  } else {
                    const { estimatedKm: computed, formulaLabel } = getEstimatedKmFromDistance(result.distance, tripType);
                    setEstimatedKm(computed.toString());
                    setEstimatedKmFormula(formulaLabel);
                    toast.success(formulaLabel);
                  }
                }}
              >
                <MapPin className="h-4 w-4 mr-2" />
                Calculate Distance
              </Button>
            </div>
          )}
          <div className="space-y-2">
            <Label>Estimated KM</Label>
            <Input
              type="number"
              min={0}
              placeholder="Trip estimated km (for per km / hybrid rates)"
              value={estimatedKm}
              onChange={e => {
                setEstimatedKm(e.target.value);
                setEstimatedKmFormula(null);
              }}
            />
            {estimatedKmFormula && (
              <p className="text-xs text-muted-foreground font-medium" role="status">
                {estimatedKmFormula}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
        </CardContent>
      </Card>
      )}

      {/* Requested Vehicles Section - Show rates and estimated KM */}
      {booking?.booking_requested_vehicles && booking.booking_requested_vehicles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Requested Vehicles & Rates</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">These are the original vehicle requirements with pricing</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {booking.booking_requested_vehicles.map((rv, index) => {
              const days = startDate && endDate ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) || 1 : 0;
              const estKm = Number(estimatedKm) || 0;
              
              let calculatedTotal = 0;
              if (rv.rate_type === 'total') {
                calculatedTotal = rv.rate_total || 0;
              } else if (rv.rate_type === 'per_day') {
                calculatedTotal = (rv.rate_per_day || 0) * days;
              } else if (rv.rate_type === 'per_km') {
                calculatedTotal = (rv.rate_per_km || 0) * estKm;
              } else if (rv.rate_type === 'hybrid') {
                calculatedTotal = ((rv.rate_per_day || 0) * days) + ((rv.rate_per_km || 0) * estKm);
              }
              const driverAllowanceTotal = (rv.driver_allowance_per_day || 0) * days;
              const displayTotal = calculatedTotal + driverAllowanceTotal;

              return (
                <div key={rv.id || index} className="p-4 border rounded-lg bg-muted/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Car className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Requested Vehicle {index + 1}</span>
                      <Badge variant="outline">{RATE_TYPE_LABELS[rv.rate_type]}</Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Brand/Model:</span>
                      <p className="font-medium">{rv.brand} {rv.model}</p>
                    </div>
                    {rv.rate_type === 'total' && (
                      <div>
                        <span className="text-muted-foreground">Total Rate:</span>
                        <p className="font-medium">₹{formatCurrency(Number(rv.rate_total || 0))}</p>
                      </div>
                    )}
                    {['per_day', 'hybrid'].includes(rv.rate_type) && (
                      <div>
                        <span className="text-muted-foreground">Rate/Day:</span>
                        <p className="font-medium">₹{formatCurrency(Number(rv.rate_per_day || 0))}</p>
                      </div>
                    )}
                    {['per_km', 'hybrid'].includes(rv.rate_type) && (
                      <>
                        <div>
                          <span className="text-muted-foreground">Rate/KM:</span>
                          <p className="font-medium">₹{formatCurrency(Number(rv.rate_per_km || 0))}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Est. KM:</span>
                          <p className="font-medium">{estKm} km</p>
                        </div>
                      </>
                    )}
                    {rv.rate_type === 'per_day' && (
                      <div>
                        <span className="text-muted-foreground">Days:</span>
                        <p className="font-medium">{days} days</p>
                      </div>
                    )}
                    {rv.driver_allowance_per_day && (
                      <div>
                        <span className="text-muted-foreground">Driver Allowance/Day:</span>
                        <p className="font-medium">₹{formatCurrency(Number(rv.driver_allowance_per_day))}</p>
                      </div>
                    )}
                  </div>
                  <div className="pt-2 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Calculated Total:</span>
                      <span className="font-semibold text-lg">{formatCurrency(displayTotal)}</span>
                    </div>
                    {driverAllowanceTotal > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        (Vehicle: {formatCurrency(calculatedTotal)} + Driver allowance: {formatCurrency(driverAllowanceTotal)})
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Vehicle Assignment - simplified to only driver info */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Assigned Vehicles</CardTitle>
          <Button variant="outline" size="sm" onClick={() => { setShowVehicleSelect(true); setSelectedRequestedVehicleId(null); }} disabled={!startDate || !endDate}>
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
              {booking?.booking_requested_vehicles && booking.booking_requested_vehicles.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs">Link to Requested Vehicle *</Label>
                  <Select value={selectedRequestedVehicleId ?? ''} onValueChange={(value) => setSelectedRequestedVehicleId(value || null)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select requested vehicle to auto-fill rates (required)" />
                    </SelectTrigger>
                    <SelectContent>
                      {booking.booking_requested_vehicles.map((rv, idx) => (
                        <SelectItem key={rv.id || idx} value={rv.id || ''}>
                          Requested Vehicle {idx + 1} - {rv.brand} {rv.model} ({RATE_TYPE_LABELS[rv.rate_type]})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!selectedRequestedVehicleId && (
                    <p className="text-xs text-muted-foreground">You must link to a requested vehicle before selecting a car.</p>
                  )}
                </div>
              )}
              {loadingCars ? (
                <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
              ) : !selectedRequestedVehicleId ? (
                <p className="text-sm text-muted-foreground">Select a requested vehicle above to see available cars.</p>
              ) : availableForSelection.length > 0 ? (
                <div className="space-y-2">
                  <Label className="text-xs">Search and select vehicle</Label>
                  <SearchableSelect
                    options={availableForSelection.map(car => ({
                      value: car.car_id,
                      label: `${car.vehicle_number} (${car.model})`,
                    }))}
                    value=""
                    onValueChange={(carId) => {
                      const car = availableForSelection.find(c => c.car_id === carId);
                      if (car) handleAddVehicle(car, selectedRequestedVehicleId);
                    }}
                    placeholder="Search by vehicle number or model..."
                    searchPlaceholder="Search by vehicle number or model..."
                    emptyText="No vehicles match your search."
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No available vehicles for selected dates</p>
              )}
            </div>
          )}

          {selectedVehicles.map(vehicle => {
            // Find linked requested vehicle to show rate info
            const linkedRequestedVehicle = booking?.booking_requested_vehicles?.find(
              rv => rv.id === vehicle.requested_vehicle_id
            );
            
            return (
              <div key={vehicle.car_id} className="p-4 border rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">{vehicle.vehicle_number}</span>
                    <span className="text-sm text-muted-foreground">({vehicle.model})</span>
                    {vehicle.isNew && <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded">New</span>}
                    {linkedRequestedVehicle && (
                      <Badge variant="outline" className="text-xs">
                        Linked to: {linkedRequestedVehicle.brand} {linkedRequestedVehicle.model}
                      </Badge>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleRemoveVehicle(vehicle)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>

                {/* Show rate info from requested vehicle if linked */}
                {linkedRequestedVehicle && (
                  <div className="p-3 bg-muted/50 rounded-md space-y-2 text-sm">
                    <p className="font-medium text-xs text-muted-foreground">Rate Information (from requested vehicle):</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div>
                        <span className="text-muted-foreground">Rate Type:</span>
                        <p className="font-medium">{RATE_TYPE_LABELS[linkedRequestedVehicle.rate_type]}</p>
                      </div>
                      {linkedRequestedVehicle.rate_type === 'total' && (
                        <div>
                          <span className="text-muted-foreground">Total:</span>
                          <p className="font-medium">₹{formatCurrency(Number(linkedRequestedVehicle.rate_total || 0))}</p>
                        </div>
                      )}
                      {['per_day', 'hybrid'].includes(linkedRequestedVehicle.rate_type) && (
                        <div>
                          <span className="text-muted-foreground">Per Day:</span>
                          <p className="font-medium">₹{formatCurrency(Number(linkedRequestedVehicle.rate_per_day || 0))}</p>
                        </div>
                      )}
                      {['per_km', 'hybrid'].includes(linkedRequestedVehicle.rate_type) && (
                        <>
                          <div>
                            <span className="text-muted-foreground">Per KM:</span>
                            <p className="font-medium">₹{formatCurrency(Number(linkedRequestedVehicle.rate_per_km || 0))}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Est. KM:</span>
                            <p className="font-medium">{booking?.estimated_km || Number(vehicle.estimated_km) || 0} km</p>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="pt-2 border-t">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Computed Total:</span>
                        <span className="font-semibold">{formatCurrency(calculateVehicleTotal(vehicle))}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Only show driver fields - rates are auto-filled from requested vehicle */}
                <DriverAutocomplete
                  driverName={vehicle.driver_name}
                  driverPhone={vehicle.driver_phone}
                  onNameChange={(name) => updateVehicle(vehicle.car_id, 'driver_name', name)}
                  onPhoneChange={(phone) => updateVehicle(vehicle.car_id, 'driver_phone', phone)}
                  vehicleClass={vehicle.vehicle_class}
                />
              </div>
            );
          })}

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

      {/* Advance Payment Section - hidden for supervisor */}
      {!isSupervisorMode && (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Advance Payment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canEditAdvance && booking?.advance_amount && booking.advance_amount > 0 ? (
            <div className="bg-muted p-4 rounded-lg border">
              <p className="text-sm font-medium mb-2">
                Advance Amount: <span className="font-bold">{formatCurrency(booking.advance_amount)}</span>
              </p>
              {booking.advance_payment_method && (
                <p className="text-sm text-muted-foreground">
                  Payment Method: <span className="capitalize">{booking.advance_payment_method}</span>
                </p>
              )}
              {booking.advance_account_type && (
                <p className="text-sm text-muted-foreground">
                  Account Type: <span className="capitalize">{booking.advance_account_type}</span>
                </p>
              )}
              {booking.advance_collected_by && (
                <p className="text-sm text-muted-foreground">
                  Collected By: {booking.advance_collected_by}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Advance payment has already been recorded. To modify advance payment, cancel the booking first.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Advance Amount (₹)</Label>
                  <Input
                    type="number"
                    value={advanceAmount}
                    onChange={e => setAdvanceAmount(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    Payment Method
                    {advanceAmount && Number(advanceAmount) > 0 && <span className="text-destructive"> *</span>}
                  </Label>
                  <Select
                    value={advancePaymentMethod}
                    onValueChange={v => {
                      setAdvancePaymentMethod(v as 'cash' | 'online' | '');
                      if (v === 'cash') {
                        setAdvanceAccountType('');
                        setAdvanceAccountId(null);
                      } else if (v === 'online') {
                        setAdvanceCollectedBy('');
                      }
                    }}
                    disabled={!advanceAmount || Number(advanceAmount) <= 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {advancePaymentMethod === 'cash' && (
                <div className="space-y-2">
                  <Label>Collected By</Label>
                  <Input
                    value={advanceCollectedBy}
                    onChange={e => setAdvanceCollectedBy(e.target.value)}
                    placeholder="Enter name"
                  />
                </div>
              )}

              {advancePaymentMethod === 'online' && (
                <>
                  <div className="space-y-2">
                    <Label>Account Type</Label>
                    <Select
                      value={advanceAccountType}
                      onValueChange={v => {
                        setAdvanceAccountType(v as 'company' | 'personal' | '');
                        setAdvanceAccountId(null);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select account type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="company">Company Account</SelectItem>
                        <SelectItem value="personal">Personal Account</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {advanceAccountType && (
                    <div className="space-y-2">
                      <Label>Select Account</Label>
                      <Select
                        value={advanceAccountId || ''}
                        onValueChange={v => setAdvanceAccountId(v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                        <SelectContent>
                          {(advanceAccountType === 'company' ? companyAccounts : personalAccounts)?.map(account => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.account_name} {account.account_number && `(${account.account_number})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
      )}

      {/* Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {!isSupervisorMode && (
                <>
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
                  {booking && (booking.status === 'confirmed' || booking.status === 'ongoing') && (
                    <Button 
                      variant="destructive" 
                      onClick={() => handleStatusChange('cancelled')}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel Booking
                    </Button>
                  )}
                </>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate(isSupervisorMode ? '/app/bookings' : -1)}>Back</Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isSupervisorMode ? 'Save vehicle assignments' : 'Save Changes'}
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
