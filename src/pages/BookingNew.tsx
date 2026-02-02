import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format, addHours } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Car, Check, X, Plus, Trash2, Loader2, Search, Users, ArrowUpDown, Lock, MapPin } from 'lucide-react';
import { useCreateBooking, useAvailableCars, useAssignVehicle, useCreateRequestedVehicle, useDeleteRequestedVehicle } from '@/hooks/use-bookings';
import { useUpsertCustomer } from '@/hooks/use-customers';
import { useUpsertDriver } from '@/hooks/use-drivers';
import { useBankAccounts, useCreateBankAccount } from '@/hooks/use-bank-accounts';
import { useSystemConfig } from '@/hooks/use-dashboard';
import { CustomerAutocomplete } from '@/components/bookings/CustomerAutocomplete';
import { DriverAutocomplete } from '@/components/bookings/DriverAutocomplete';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { TRIP_TYPE_LABELS, RATE_TYPE_LABELS, type TripType, type RateType, type BookingStatus } from '@/types/booking';

interface RequestedVehicle {
  id?: string;
  brand: string;
  model: string;
  rate_type: RateType;
  rate_total: number | string;
  rate_per_day: number | string;
  rate_per_km: number | string;
  driver_allowance_per_day: number | string;
}

interface VehicleAssignment {
  car_id: string;
  vehicle_number: string;
  model: string;
  seats: number;
  driver_name: string;
  driver_phone: string;
  requested_vehicle_id?: string | null;
}

type SortOption = 'vehicle_number' | 'model' | 'seats';

export default function BookingNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultDate = searchParams.get('date');
  const { isAdmin, isManager, isSupervisor } = useAuth();

  const createBooking = useCreateBooking();
  const assignVehicle = useAssignVehicle();
  const upsertCustomer = useUpsertCustomer();
  const upsertDriver = useUpsertDriver();
  const createRequestedVehicle = useCreateRequestedVehicle();
  const deleteRequestedVehicle = useDeleteRequestedVehicle();
  const { data: companyAccounts = [], refetch: refetchCompanyAccounts } = useBankAccounts('company');
  const { data: personalAccounts = [], refetch: refetchPersonalAccounts } = useBankAccounts('personal');
  const createBankAccount = useCreateBankAccount();
  const { data: minKmPerKm } = useSystemConfig('minimum_km_per_km');
  const { data: minKmHybridPerDay } = useSystemConfig('minimum_km_hybrid_per_day');

  // Get system defaults for minimum KM (default to 300 km/day as per user requirement)
  const defaultMinKmPerKm = minKmPerKm ? Number(minKmPerKm) : 300;
  const defaultMinKmHybridPerDay = minKmHybridPerDay ? Number(minKmHybridPerDay) : 300;

  // Check if user can edit requested vehicles (admin or manager only)
  const canEditRequestedVehicles = isAdmin || isManager;

  // Form state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [tripType, setTripType] = useState<TripType>('local');
  // Separate date and time states
  const defaultStartDate = defaultDate || format(new Date(), "yyyy-MM-dd");
  const defaultStartTime = "09:00";
  const defaultEndDate = defaultDate || format(new Date(), "yyyy-MM-dd");
  const defaultEndTime = "18:00";
  
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [startTime, setStartTime] = useState(defaultStartTime);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [endTime, setEndTime] = useState(defaultEndTime);
  
  // Combine date and time for API
  const startAt = `${startDate}T${startTime}`;
  const endAt = `${endDate}T${endTime}`;
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [estimatedKm, setEstimatedKm] = useState<string>(''); // Booking-level estimated KM
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<BookingStatus | ''>('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advancePaymentMethod, setAdvancePaymentMethod] = useState<'cash' | 'online' | ''>('');
  const [advanceCollectedBy, setAdvanceCollectedBy] = useState('');
  const [advanceAccountType, setAdvanceAccountType] = useState<'company' | 'personal' | ''>('');
  const [advanceAccountId, setAdvanceAccountId] = useState<string | null>(null);
  const [requestedVehicles, setRequestedVehicles] = useState<RequestedVehicle[]>([]);
  const [selectedVehicles, setSelectedVehicles] = useState<VehicleAssignment[]>([]);
  const [showVehicleSelect, setShowVehicleSelect] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [selectedCarIds, setSelectedCarIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortOption>('vehicle_number');
  const [sortAsc, setSortAsc] = useState(true);
  const [minSeats, setMinSeats] = useState<number | ''>('');
  
  // Bank account creation dialog state
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [accountDialogType, setAccountDialogType] = useState<'company' | 'personal' | null>(null);
  const [accountDialogVehicleIndex, setAccountDialogVehicleIndex] = useState<number | null>(null);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [newBankName, setNewBankName] = useState('');
  const [newIfscCode, setNewIfscCode] = useState('');
  const [newAccountNotes, setNewAccountNotes] = useState('');

  // Parse dates (combined from date + time)
  const startDateTime = startAt ? new Date(startAt) : null;
  const endDateTime = endAt ? new Date(endAt) : null;

  // Check availability
  const { data: availableCars, isLoading: loadingCars } = useAvailableCars(startDateTime, endDateTime);

  const availableForSelection = useMemo(() => {
    if (!availableCars) return [];
    const selectedIds = new Set(selectedVehicles.map(v => v.car_id));
    let cars = availableCars.filter(c => c.is_available && !selectedIds.has(c.car_id));

    // Apply search filter
    if (vehicleSearch.trim()) {
      const search = vehicleSearch.toLowerCase();
      cars = cars.filter(c =>
        c.vehicle_number.toLowerCase().includes(search) ||
        c.model.toLowerCase().includes(search)
      );
    }

    // Apply minimum seats filter
    if (minSeats) {
      cars = cars.filter(c => ((c as any).seats || 5) >= minSeats);
    }

    // Apply sorting
    cars.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'vehicle_number': comparison = a.vehicle_number.localeCompare(b.vehicle_number); break;
        case 'model': comparison = a.model.localeCompare(b.model); break;
        case 'seats': comparison = ((a as any).seats || 5) - ((b as any).seats || 5); break;
      }
      return sortAsc ? comparison : -comparison;
    });

    return cars;
  }, [availableCars, selectedVehicles, vehicleSearch, sortBy, sortAsc, minSeats]);

  const unavailableCars = useMemo(() => {
    if (!availableCars) return [];
    return availableCars.filter(c => !c.is_available);
  }, [availableCars]);

  const toggleCarSelection = (carId: string) => {
    setSelectedCarIds(prev => {
      const next = new Set(prev);
      if (next.has(carId)) next.delete(carId);
      else next.add(carId);
      return next;
    });
  };

  const handleAddSelectedVehicles = () => {
    if (!availableCars) return;
    // Only add cars that are still available to prevent double-booking
    const carsToAdd = availableCars.filter(
      c => selectedCarIds.has(c.car_id) && c.is_available
    );
    const skipped = [...selectedCarIds].filter(
      id => !availableCars.find(c => c.car_id === id && c.is_available)
    ).length;
    if (skipped > 0) {
      toast.warning(
        `${skipped} vehicle${skipped === 1 ? '' : 's'} no longer available and ${skipped === 1 ? 'was' : 'were'} not added.`
      );
    }
    const newVehicles: VehicleAssignment[] = carsToAdd.map(car => ({
      car_id: car.car_id,
      vehicle_number: car.vehicle_number,
      model: car.model,
      seats: (car as any).seats || 5,
      driver_name: '',
      driver_phone: '',
    }));
    setSelectedVehicles(prev => [...prev, ...newVehicles]);
    setSelectedCarIds(new Set());
    setVehicleSearch('');
    setMinSeats('');
    setShowVehicleSelect(false);
  };

  const toggleSortBy = (field: SortOption) => {
    if (sortBy === field) setSortAsc(!sortAsc);
    else { setSortBy(field); setSortAsc(true); }
  };

  // Calculate totals for requested vehicles with system-wide minimum KM thresholds
  // Returns both the total amount and breakdown details
  const calculateRequestedVehicleTotal = (v: RequestedVehicle): { 
    total: number; 
    breakdown?: {
      rateType: string;
      days?: number;
      estimatedKm?: number;
      thresholdKmPerDay?: number;
      totalMinKm?: number;
      kmCharged?: number;
      ratePerKm?: number;
      thresholdApplied?: boolean;
      baseAmount?: number;
      kmAmount?: number;
    }
  } => {
    if (!startDateTime || !endDateTime) return { total: 0 };
    const days = Math.ceil((endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60 * 24)) || 1;
    const bookingEstimatedKm = Number(estimatedKm) || 0; // Use booking-level estimated KM

    switch (v.rate_type) {
      case 'total':
        return { 
          total: Number(v.rate_total) || 0,
          breakdown: { rateType: 'total' }
        };
      case 'per_day':
        const perDayTotal = days * (Number(v.rate_per_day) || 0);
        return { 
          total: perDayTotal,
          breakdown: {
            rateType: 'per_day',
            days,
            baseAmount: perDayTotal
          }
        };
      case 'per_km':
        // Threshold calculation: days × threshold_km_per_day = total minimum KM
        const thresholdKmPerDay = defaultMinKmPerKm; // e.g., 300 km/day
        const totalMinKm = thresholdKmPerDay * days; // e.g., 300 × 15 = 4,500 km
        const kmToCharge = Math.max(bookingEstimatedKm, totalMinKm);
        const thresholdApplied = bookingEstimatedKm < totalMinKm;
        const perKmTotal = (Number(v.rate_per_km) || 0) * kmToCharge;
        return { 
          total: perKmTotal,
          breakdown: {
            rateType: 'per_km',
            days,
            estimatedKm: bookingEstimatedKm,
            thresholdKmPerDay,
            totalMinKm,
            kmCharged: kmToCharge,
            ratePerKm: Number(v.rate_per_km) || 0,
            thresholdApplied,
            kmAmount: perKmTotal
          }
        };
      case 'hybrid':
        const hybridMinKm = Math.max(bookingEstimatedKm, defaultMinKmHybridPerDay * days);
        const hybridThresholdApplied = bookingEstimatedKm < (defaultMinKmHybridPerDay * days);
        const hybridBaseAmount = days * (Number(v.rate_per_day) || 0);
        const hybridKmAmount = (Number(v.rate_per_km) || 0) * hybridMinKm;
        const hybridTotal = hybridBaseAmount + hybridKmAmount;
        return { 
          total: hybridTotal,
          breakdown: {
            rateType: 'hybrid',
            days,
            estimatedKm: bookingEstimatedKm,
            thresholdKmPerDay: defaultMinKmHybridPerDay,
            totalMinKm: defaultMinKmHybridPerDay * days,
            kmCharged: hybridMinKm,
            ratePerKm: Number(v.rate_per_km) || 0,
            thresholdApplied: hybridThresholdApplied,
            baseAmount: hybridBaseAmount,
            kmAmount: hybridKmAmount
          }
        };
      default:
        return { total: 0 };
    }
  };

  // Calculate totals for assigned vehicles (use requested vehicle price if linked)
  const calculateVehicleTotal = (v: VehicleAssignment): number => {
    // If vehicle is linked to a requested vehicle, use requested vehicle price
    if (v.requested_vehicle_id) {
      // Find by ID or by temp index
      let requestedVehicle: RequestedVehicle | undefined;
      if (v.requested_vehicle_id.startsWith('temp-')) {
        const idx = parseInt(v.requested_vehicle_id.replace('temp-', ''));
        requestedVehicle = requestedVehicles[idx];
      } else {
        requestedVehicle = requestedVehicles.find(rv => rv.id === v.requested_vehicle_id);
      }
      if (requestedVehicle) {
        return calculateRequestedVehicleTotal(requestedVehicle).total;
      }
    }

    // Otherwise use assigned vehicle's own pricing
    if (!startDateTime || !endDateTime) return 0;
    const days = Math.ceil((endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60 * 24)) || 1;
    const bookingEstimatedKm = Number(estimatedKm) || 0; // Use booking-level estimated KM

    switch (v.rate_type) {
      case 'total': return Number(v.rate_total) || 0;
      case 'per_day': return days * (Number(v.rate_per_day) || 0);
      case 'per_km': return (Number(v.rate_per_km) || 0) * bookingEstimatedKm;
      case 'hybrid': return (days * (Number(v.rate_per_day) || 0)) + ((Number(v.rate_per_km) || 0) * bookingEstimatedKm);
      default: return 0;
    }
  };

  // Calculate grand total using requested vehicle prices (for billing)
  const grandTotal = useMemo(() => {
    // Use requested vehicles for billing if they exist
    if (requestedVehicles.length > 0) {
      return requestedVehicles.reduce((sum, v) => sum + calculateRequestedVehicleTotal(v).total, 0);
    }
    // Otherwise use assigned vehicles
    return selectedVehicles.reduce((sum, v) => sum + calculateVehicleTotal(v), 0);
  }, [requestedVehicles, selectedVehicles, startDateTime, endDateTime, estimatedKm, defaultMinKmPerKm, defaultMinKmHybridPerDay]);

  // Get detailed breakdown for quote summary
  const quoteBreakdown = useMemo(() => {
    if (requestedVehicles.length === 0) return null;
    
    const days = startDateTime && endDateTime 
      ? Math.ceil((endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60 * 24)) || 1 
      : 0;
    const bookingEstimatedKm = Number(estimatedKm) || 0;
    
    return requestedVehicles.map(v => ({
      vehicle: `${v.brand} ${v.model}`,
      ...calculateRequestedVehicleTotal(v)
    }));
  }, [requestedVehicles, startDateTime, endDateTime, estimatedKm, defaultMinKmPerKm, defaultMinKmHybridPerDay]);

  const totalAdvance = useMemo(() => {
    return Number(advanceAmount) || 0;
  }, [advanceAmount]);

  const handleAddVehicle = (car: typeof availableForSelection[0]) => {
    setSelectedVehicles(prev => [...prev, {
      car_id: car.car_id,
      vehicle_number: car.vehicle_number,
      model: car.model,
      seats: (car as any).seats || 5,
      driver_name: '',
      driver_phone: '',
    }]);
    setSelectedCarIds(prev => { const n = new Set(prev); n.delete(car.car_id); return n; });
  };

  const handleRemoveVehicle = (carId: string) => {
    setSelectedVehicles(prev => prev.filter(v => v.car_id !== carId));
  };

  const updateVehicle = (carId: string, field: keyof VehicleAssignment, value: string) => {
    setSelectedVehicles(prev => prev.map(v =>
      v.car_id === carId ? { ...v, [field]: value } : v
    ));
  };

  const handleAddRequestedVehicle = () => {
    setRequestedVehicles(prev => [...prev, {
      brand: '',
      model: '',
      rate_type: 'total' as RateType,
      rate_total: '',
      rate_per_day: '',
      rate_per_km: '',
      driver_allowance_per_day: '',
    }]);
  };

  const handleRemoveRequestedVehicle = (index: number) => {
    const vehicle = requestedVehicles[index];
    if (vehicle.id) {
      deleteRequestedVehicle.mutate(vehicle.id);
    }
    setRequestedVehicles(prev => prev.filter((_, i) => i !== index));
    // Unlink any assigned vehicles linked to this requested vehicle
    setSelectedVehicles(prev => prev.map(v =>
      v.requested_vehicle_id === vehicle.id ? { ...v, requested_vehicle_id: null } : v
    ));
  };

  const updateRequestedVehicle = (index: number, field: keyof RequestedVehicle, value: string) => {
    setRequestedVehicles(prev => prev.map((v, i) =>
      i === index ? { ...v, [field]: value } : v
    ));
  };

  const validateForm = (): boolean => {
    if (!customerName.trim()) { toast.error('Customer name is required'); return false; }
    if (!customerPhone.trim()) { toast.error('Customer phone is required'); return false; }
    if (!startAt || !endAt) { toast.error('Start and end dates are required'); return false; }
    if (new Date(startAt) >= new Date(endAt)) { toast.error('End date must be after start date'); return false; }
    if (!status) { toast.error('Please select a booking status (Save as Inquiry, Hold, or Confirm Booking)'); return false; }
    
    // Validate advance payment
    const totalBookingAmount = requestedVehicles.reduce((sum, rv) => sum + calculateRequestedVehicleTotal(rv), 0);
    if (Number(advanceAmount) > totalBookingAmount) {
      toast.error('Advance amount cannot exceed total booking amount');
      return false;
    }
    if (Number(advanceAmount) > 0 && !advancePaymentMethod) {
      toast.error('Payment method is required when advance amount is entered');
      return false;
    }

    // Validate requested vehicles
    for (let i = 0; i < requestedVehicles.length; i++) {
      const rv = requestedVehicles[i];
      if (!rv.brand.trim()) {
        toast.error(`Brand is required for requested vehicle ${i + 1}`);
        return false;
      }
      if (!rv.model.trim()) {
        toast.error(`Model is required for requested vehicle ${i + 1}`);
        return false;
      }
      if (rv.rate_type === 'per_km' || rv.rate_type === 'hybrid') {
        if (!estimatedKm || Number(estimatedKm) <= 0) {
          toast.error('Estimated KM is required for per_km or hybrid rate types');
          return false;
        }
      }
      if (Number(rv.advance_amount) > 0 && !rv.advance_payment_method) {
        toast.error(`Payment method is required when advance amount is entered for requested vehicle ${i + 1}`);
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      // Save customer to phonebook
      await upsertCustomer.mutateAsync({
        name: customerName.trim(),
        phone: customerPhone.trim(),
      });

      const booking = await createBooking.mutateAsync({
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        trip_type: tripType,
        start_at: new Date(startAt).toISOString(),
        end_at: new Date(endAt).toISOString(),
        pickup: pickup.trim() || undefined,
        dropoff: dropoff.trim() || undefined,
        notes: notes.trim() || undefined,
        status: status as BookingStatus,
        // Save advance payment at booking level
        advance_amount: Number(advanceAmount) || 0,
        advance_payment_method: advancePaymentMethod || null,
        advance_collected_by: advanceCollectedBy.trim() || null,
        advance_account_type: advanceAccountType || null,
        advance_account_id: advanceAccountId || null,
      });

      // Save requested vehicles (if admin/manager) and create mapping for linking
      const requestedVehicleIdMap: Record<string, string> = {};
      if (canEditRequestedVehicles && requestedVehicles.length > 0) {
        for (let idx = 0; idx < requestedVehicles.length; idx++) {
          const rv = requestedVehicles[idx];
          if (rv.brand.trim() && rv.model.trim()) {
            const tempId = rv.id || `temp-${idx}`;
            const created = await createRequestedVehicle.mutateAsync({
              booking_id: booking.id,
              brand: rv.brand.trim(),
              model: rv.model.trim(),
              rate_type: rv.rate_type,
              rate_total: rv.rate_type === 'total' ? Number(rv.rate_total) || null : null,
              rate_per_day: ['per_day', 'hybrid'].includes(rv.rate_type) ? Number(rv.rate_per_day) || null : null,
              rate_per_km: ['per_km', 'hybrid'].includes(rv.rate_type) ? Number(rv.rate_per_km) || null : null,
              estimated_km: ['per_km', 'hybrid'].includes(rv.rate_type) ? Number(estimatedKm) || null : null,
              driver_allowance_per_day: Number(rv.driver_allowance_per_day) || null,
              // Save advance payment only to the first requested vehicle (for whole booking)
              advance_amount: idx === 0 ? (Number(advanceAmount) || 0) : 0,
              advance_payment_method: idx === 0 ? (advancePaymentMethod || null) : null,
              advance_collected_by: idx === 0 ? (advanceCollectedBy.trim() || null) : null,
              advance_account_type: idx === 0 ? (advanceAccountType || null) : null,
              advance_account_id: idx === 0 ? advanceAccountId : null,
            });
            requestedVehicleIdMap[tempId] = created.id;
          }
        }
      }

      // Assign vehicles
      for (const v of selectedVehicles) {
        // Save driver to phonebook if provided
        if (v.driver_name.trim() && v.driver_phone.trim()) {
          await upsertDriver.mutateAsync({
            name: v.driver_name.trim(),
            phone: v.driver_phone.trim(),
          });
        }

        // Map temporary ID to actual ID if needed
        let requestedVehicleId = v.requested_vehicle_id;
        if (requestedVehicleId && requestedVehicleId.startsWith('temp-')) {
          requestedVehicleId = requestedVehicleIdMap[requestedVehicleId] || null;
        }

        // Get rate details from linked requested vehicle if available
        let rateType: RateType = 'total';
        let rateTotal: number | undefined = undefined;
        let ratePerDay: number | undefined = undefined;
        let ratePerKm: number | undefined = undefined;
        let vehicleEstimatedKm: number | undefined = undefined;
        let advanceAmount = 0;

        if (requestedVehicleId) {
          const requestedVehicle = requestedVehicles.find(rv => {
            const tempId = rv.id || `temp-${requestedVehicles.indexOf(rv)}`;
            return tempId === requestedVehicleId || rv.id === requestedVehicleId;
          });
          if (requestedVehicle) {
            rateType = requestedVehicle.rate_type;
            rateTotal = requestedVehicle.rate_type === 'total' ? Number(requestedVehicle.rate_total) || undefined : undefined;
            ratePerDay = ['per_day', 'hybrid'].includes(requestedVehicle.rate_type) ? Number(requestedVehicle.rate_per_day) || undefined : undefined;
            ratePerKm = ['per_km', 'hybrid'].includes(requestedVehicle.rate_type) ? Number(requestedVehicle.rate_per_km) || undefined : undefined;
            vehicleEstimatedKm = ['per_km', 'hybrid'].includes(requestedVehicle.rate_type) ? Number(estimatedKm) || undefined : undefined;
            advanceAmount = Number(requestedVehicle.advance_amount) || 0;
          }
        }

        await assignVehicle.mutateAsync({
          booking_id: booking.id,
          car_id: v.car_id,
          driver_name: v.driver_name.trim() || undefined,
          driver_phone: v.driver_phone.trim() || undefined,
          rate_type: rateType,
          rate_total: rateTotal,
          rate_per_day: ratePerDay,
          rate_per_km: ratePerKm,
          estimated_km: vehicleEstimatedKm,
          advance_amount: advanceAmount,
          requested_vehicle_id: requestedVehicleId || null,
        });
      }

      navigate('/app/bookings/calendar');
    } catch (error) {
      // Error handled in mutation
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="page-title">New Booking</h1>
          <p className="text-sm text-muted-foreground">Create a new booking with vehicle assignment</p>
        </div>
      </div>

      {/* Customer & Trip Details */}
      <Card>
        <CardHeader><CardTitle>Trip Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <CustomerAutocomplete
            customerName={customerName}
            customerPhone={customerPhone}
            onNameChange={setCustomerName}
            onPhoneChange={setCustomerPhone}
          />

          <div className="space-y-4">
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Start Date *</Label>
                  <Input 
                    type="date" 
                    value={startDate} 
                    onChange={e => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Start Time *</Label>
                  <Input 
                    type="time" 
                    value={startTime} 
                    onChange={e => setStartTime(e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date *</Label>
                  <Input 
                    type="date" 
                    value={endDate} 
                    onChange={e => setEndDate(e.target.value)} 
                    min={startDate}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time *</Label>
                  <Input 
                    type="time" 
                    value={endTime} 
                    onChange={e => setEndTime(e.target.value)} 
                  />
                </div>
              </div>
              {startDateTime && endDateTime && endDateTime > startDateTime && (
                <div className="pt-2">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">Total Trip Duration: </span>
                    {(() => {
                      const days = Math.ceil((endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60 * 24)) || 1;
                      const hours = Math.floor((endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60)) % 24;
                      if (days === 1 && hours === 0) {
                        return '1 day';
                      } else if (days === 1) {
                        return `1 day ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
                      } else if (hours === 0) {
                        return `${days} days`;
                      } else {
                        return `${days} days ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
                      }
                    })()}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pickup">Pickup Location</Label>
              <Input
                id="pickup"
                value={pickup}
                onChange={(e) => setPickup(e.target.value)}
                placeholder="Enter pickup location"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dropoff">Drop Location</Label>
              <Input
                id="dropoff"
                value={dropoff}
                onChange={(e) => setDropoff(e.target.value)}
                placeholder="Enter drop location"
              />
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
                    const calculatedKm = Math.round(result.distance);
                    setEstimatedKm(calculatedKm.toString());
                    toast.success(`Distance calculated: ${calculatedKm} km`);
                  }
                }}
              >
                  <MapPin className="h-4 w-4 mr-2" />
                  Calculate Distance
                </Button>
              </div>
            )}
            
            {/* Estimated KM Field */}
            <div className="space-y-2">
              <Label htmlFor="estimated-km">Estimated KM</Label>
              <Input
                id="estimated-km"
                type="number"
                value={estimatedKm}
                onChange={e => setEstimatedKm(e.target.value)}
                placeholder="Enter estimated kilometers"
              />
              <p className="text-xs text-muted-foreground">
                This will be used for all vehicles with per_km or hybrid rate types
              </p>
            </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any special requirements..." rows={2} />
          </div>

          <Separator />

          {/* Advance Payment Section - For Whole Booking */}
          <div className="space-y-4">
            <div>
              <Label className="text-base font-semibold">Advance Payment</Label>
              <p className="text-xs text-muted-foreground mt-1">Advance payment applies to the entire booking</p>
            </div>
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
                  required={advanceAmount && Number(advanceAmount) > 0}
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
                      onValueChange={v => {
                        if (v === 'add-new') {
                          setAccountDialogType(advanceAccountType as 'company' | 'personal');
                          setAccountDialogVehicleIndex(-1); // -1 indicates booking level
                          setAccountDialogOpen(true);
                        } else {
                          setAdvanceAccountId(v);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {(advanceAccountType === 'company' ? companyAccounts : personalAccounts).map(account => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.account_name} {account.account_number && `(${account.account_number})`}
                          </SelectItem>
                        ))}
                        <SelectItem value="add-new" className="text-primary font-medium">
                          + Add New Account
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}
          </div>

          <Separator />

          {/* Requested Vehicles Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className="text-base font-semibold">Requested Vehicles</Label>
                {!canEditRequestedVehicles && (
                  <Lock className="h-4 w-4 text-muted-foreground" title="Read-only for supervisors" />
                )}
              </div>
              {canEditRequestedVehicles && (
                <Button variant="outline" size="sm" onClick={handleAddRequestedVehicle}>
                  <Plus className="h-4 w-4 mr-1" /> Add Requested Vehicle
                </Button>
              )}
            </div>

            {requestedVehicles.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {canEditRequestedVehicles
                  ? 'No vehicles requested. Click "Add Requested Vehicle" to add one.'
                  : 'No vehicles requested yet.'}
              </p>
            ) : (
              <div className="space-y-3">
                {requestedVehicles.map((rv, index) => (
                  <div key={index} className="p-4 border rounded-lg space-y-3 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Car className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Requested Vehicle {index + 1}</span>
                      </div>
                      {canEditRequestedVehicles && (
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveRequestedVehicle(index)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Brand *</Label>
                        <Input
                          value={rv.brand}
                          onChange={e => updateRequestedVehicle(index, 'brand', e.target.value)}
                          placeholder="e.g., Toyota"
                          className="h-8 text-sm"
                          disabled={!canEditRequestedVehicles}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Model *</Label>
                        <Input
                          value={rv.model}
                          onChange={e => updateRequestedVehicle(index, 'model', e.target.value)}
                          placeholder="e.g., Innova"
                          className="h-8 text-sm"
                          disabled={!canEditRequestedVehicles}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Rate Type</Label>
                      <Select
                        value={rv.rate_type}
                        onValueChange={v => updateRequestedVehicle(index, 'rate_type', v)}
                        disabled={!canEditRequestedVehicles}
                      >
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(RATE_TYPE_LABELS).filter(([k]) => k !== 'hybrid').map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {rv.rate_type === 'total' && (
                        <div className="space-y-1">
                          <Label className="text-xs">Total Amount (₹)</Label>
                          <Input
                            type="number"
                            value={rv.rate_total}
                            onChange={e => updateRequestedVehicle(index, 'rate_total', e.target.value)}
                            placeholder="0"
                            className="h-8 text-sm"
                            disabled={!canEditRequestedVehicles}
                          />
                        </div>
                      )}
                      {['per_day', 'hybrid'].includes(rv.rate_type) && (
                        <div className="space-y-1">
                          <Label className="text-xs">Rate/Day (₹)</Label>
                          <Input
                            type="number"
                            value={rv.rate_per_day}
                            onChange={e => updateRequestedVehicle(index, 'rate_per_day', e.target.value)}
                            placeholder="0"
                            className="h-8 text-sm"
                            disabled={!canEditRequestedVehicles}
                          />
                        </div>
                      )}
                          {['per_km', 'hybrid'].includes(rv.rate_type) && (
                        <div className="space-y-1">
                          <Label className="text-xs">Rate/KM (₹)</Label>
                          <Input
                            type="number"
                            value={rv.rate_per_km}
                            onChange={e => updateRequestedVehicle(index, 'rate_per_km', e.target.value)}
                            placeholder="0"
                            className="h-8 text-sm"
                            disabled={!canEditRequestedVehicles}
                          />
                        </div>
                      )}
                    </div>

                    {/* Driver Allowance Section */}
                    <div className="space-y-3 pt-2 border-t">
                      <Label className="text-xs font-semibold">Driver Allowance</Label>
                      <div className="space-y-1">
                        <Label className="text-xs">Driver Allowance Per Day (₹)</Label>
                        <Input
                          type="number"
                          value={rv.driver_allowance_per_day}
                          onChange={e => updateRequestedVehicle(index, 'driver_allowance_per_day', e.target.value)}
                          placeholder="0"
                          className="h-8 text-sm"
                          disabled={!canEditRequestedVehicles}
                        />
                        {startDateTime && endDateTime && Number(rv.driver_allowance_per_day) > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Total: ₹{(
                              Number(rv.driver_allowance_per_day) * 
                              Math.ceil((endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60 * 24)) || 1
                            ).toLocaleString('en-IN')} 
                            ({Math.ceil((endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60 * 24)) || 1} days)
                          </p>
                        )}
                      </div>
                    </div>


                    <div className="flex justify-end text-sm">
                      <span className="text-muted-foreground mr-2">Computed Total:</span>
                      <span className="font-semibold">{formatCurrency(calculateRequestedVehicleTotal(rv).total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Vehicle Assignment */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Assign Vehicles</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setShowVehicleSelect(true)} disabled={!startDate || !endDate}>
            <Plus className="h-4 w-4 mr-1" /> Add Vehicle
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Available cars for selection */}
          {showVehicleSelect && (
            <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="font-medium">Select Vehicles</h4>
                <div className="flex items-center gap-2">
                  {selectedCarIds.size > 0 && (
                    <Button size="sm" onClick={handleAddSelectedVehicles}>
                      <Plus className="h-4 w-4 mr-1" /> Add {selectedCarIds.size} Selected
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => { setShowVehicleSelect(false); setSelectedCarIds(new Set()); setVehicleSearch(''); setMinSeats(''); }}>Cancel</Button>
                </div>
              </div>

              {/* Search bar and filters */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by vehicle number or model..."
                    value={vehicleSearch}
                    onChange={e => setVehicleSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground whitespace-nowrap">Min Seats:</Label>
                  <Select value={minSeats === '' ? 'any' : minSeats.toString()} onValueChange={v => setMinSeats(v === 'any' ? '' : parseInt(v))}>
                    <SelectTrigger className="w-20 h-9">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="4">4+</SelectItem>
                      <SelectItem value="5">5+</SelectItem>
                      <SelectItem value="6">6+</SelectItem>
                      <SelectItem value="7">7+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Sort options */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Sort by:</span>
                <Button variant={sortBy === 'vehicle_number' ? 'secondary' : 'ghost'} size="sm" className="h-7 text-xs" onClick={() => toggleSortBy('vehicle_number')}>
                  Number {sortBy === 'vehicle_number' && <ArrowUpDown className="h-3 w-3 ml-1" />}
                </Button>
                <Button variant={sortBy === 'model' ? 'secondary' : 'ghost'} size="sm" className="h-7 text-xs" onClick={() => toggleSortBy('model')}>
                  Model {sortBy === 'model' && <ArrowUpDown className="h-3 w-3 ml-1" />}
                </Button>
                <Button variant={sortBy === 'seats' ? 'secondary' : 'ghost'} size="sm" className="h-7 text-xs" onClick={() => toggleSortBy('seats')}>
                  Seats {sortBy === 'seats' && <ArrowUpDown className="h-3 w-3 ml-1" />}
                </Button>
              </div>

              {loadingCars ? (
                <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
              ) : availableForSelection.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
                  {availableForSelection.map(car => {
                    const isSelected = selectedCarIds.has(car.car_id);
                    const seats = (car as any).seats || 5;
                    return (
                      <div
                        key={car.car_id}
                        className={cn(
                          "flex items-center gap-3 p-2 border rounded bg-background hover:bg-muted/50 cursor-pointer transition-colors",
                          isSelected && "border-primary bg-primary/5"
                        )}
                        onClick={() => toggleCarSelection(car.car_id)}
                      >
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleCarSelection(car.car_id)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{car.vehicle_number}</span>
                            <span className="inline-flex items-center gap-0.5 text-xs bg-muted px-1.5 py-0.5 rounded">
                              <Users className="h-3 w-3" /> {seats}
                            </span>
                          </div>
                          <span className="text-sm text-muted-foreground truncate block">{car.model}</span>
                        </div>
                        <Check className={cn("h-4 w-4 text-success", !isSelected && "opacity-0")} />
                      </div>
                    );
                  })}
                </div>
              ) : vehicleSearch ? (
                <p className="text-sm text-muted-foreground">No vehicles match "{vehicleSearch}"</p>
              ) : (
                <p className="text-sm text-muted-foreground">No available vehicles for selected dates</p>
              )}
              {unavailableCars.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Unavailable ({unavailableCars.length}):</p>
                  <div className="max-h-[100px] overflow-y-auto space-y-1">
                    {unavailableCars.map(car => (
                      <div key={car.car_id} className="flex items-center gap-2 text-sm text-destructive">
                        <X className="h-3 w-3 flex-shrink-0" />
                        <span>{car.vehicle_number}</span>
                        <span className="text-xs truncate">- {car.conflict_booking_ref} ({car.conflict_booked_by})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Selected vehicles */}
          {selectedVehicles.map(vehicle => (
            <div key={vehicle.car_id} className="p-4 border rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">{vehicle.vehicle_number}</span>
                  <span className="inline-flex items-center gap-0.5 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                    <Users className="h-3 w-3" /> {vehicle.seats}
                  </span>
                  <span className="text-sm text-muted-foreground">• {vehicle.model}</span>
                  {vehicle.requested_vehicle_id && (
                    <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                      <Check className="h-3 w-3" /> Linked
                    </span>
                  )}
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleRemoveVehicle(vehicle.car_id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>

              {/* Link to requested vehicle (for supervisors) */}
              {requestedVehicles.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs">Link to Requested Vehicle</Label>
                  <Select
                    value={vehicle.requested_vehicle_id || 'none'}
                    onValueChange={v => {
                      const value = v === 'none' ? null : v;
                      updateVehicle(vehicle.car_id, 'requested_vehicle_id', value || '');
                    }}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Select requested vehicle..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {requestedVehicles.map((rv, idx) => {
                        const tempId = rv.id || `temp-${idx}`;
                        return (
                          <SelectItem key={tempId} value={tempId}>
                            {rv.brand} {rv.model} - {formatCurrency(calculateRequestedVehicleTotal(rv).total)}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Driver Details */}
              <DriverAutocomplete
                driverName={vehicle.driver_name}
                driverPhone={vehicle.driver_phone}
                onNameChange={(name) => updateVehicle(vehicle.car_id, 'driver_name', name)}
                onPhoneChange={(phone) => updateVehicle(vehicle.car_id, 'driver_phone', phone)}
                onSelectDriver={async (driver) => {
                  await upsertDriver.mutateAsync({
                    name: driver.name,
                    phone: driver.phone,
                  });
                }}
              />
            </div>
          ))}

          {selectedVehicles.length === 0 && !showVehicleSelect && (
            <p className="text-center text-muted-foreground py-8">No vehicles assigned. Click "Add Vehicle" to assign.</p>
          )}
        </CardContent>
      </Card>

      {/* Quote Summary */}
      {(requestedVehicles.length > 0 || selectedVehicles.length > 0) && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">
                  Quote Summary
                  {requestedVehicles.length > 0 && (
                    <span className="ml-2 text-xs">(based on requested vehicles)</span>
                  )}
                </p>
                <p className="text-2xl font-bold">{formatCurrency(grandTotal)}</p>
                <p className="text-sm text-success">Advance: {formatCurrency(totalAdvance)} | Due: {formatCurrency(grandTotal - totalAdvance)}</p>
              </div>
            </div>

            {/* Detailed Breakdown */}
            {quoteBreakdown && quoteBreakdown.length > 0 && (
              <div className="pt-4 border-t space-y-3">
                <p className="text-sm font-medium text-muted-foreground">Payment Calculation Breakdown:</p>
                {quoteBreakdown.map((item, idx) => {
                  const breakdown = item.breakdown;
                  if (!breakdown) return null;

                  return (
                    <div key={idx} className="bg-background/50 p-3 rounded-md space-y-2 text-sm">
                      <p className="font-medium">{item.vehicle}</p>
                      
                      {breakdown.rateType === 'total' && (
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div className="flex justify-between">
                            <span>Rate Type:</span>
                            <span className="font-medium">Fixed Total</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Amount:</span>
                            <span className="font-medium">{formatCurrency(item.total)}</span>
                          </div>
                        </div>
                      )}

                      {breakdown.rateType === 'per_day' && (
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div className="flex justify-between">
                            <span>Rate Type:</span>
                            <span className="font-medium">Per Day</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Days:</span>
                            <span className="font-medium">{breakdown.days} days</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Rate per Day:</span>
                            <span className="font-medium">{formatCurrency(breakdown.baseAmount! / breakdown.days!)}</span>
                          </div>
                          <div className="flex justify-between pt-1 border-t font-medium">
                            <span>Total:</span>
                            <span>{formatCurrency(item.total)}</span>
                          </div>
                        </div>
                      )}

                      {breakdown.rateType === 'per_km' && (
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div className="flex justify-between">
                            <span>Rate Type:</span>
                            <span className="font-medium">Per Kilometer</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Trip Duration:</span>
                            <span className="font-medium">{breakdown.days} days</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Threshold (from settings):</span>
                            <span className="font-medium">{breakdown.thresholdKmPerDay} km/day</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Minimum KM Required:</span>
                            <span className="font-medium">{breakdown.totalMinKm?.toLocaleString()} km</span>
                            <span className="text-xs">({breakdown.thresholdKmPerDay} × {breakdown.days} days)</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Estimated/Actual KM:</span>
                            <span className="font-medium">{breakdown.estimatedKm?.toLocaleString()} km</span>
                          </div>
                          {breakdown.thresholdApplied && (
                            <div className="bg-warning/10 text-warning p-2 rounded text-xs">
                              ⚠️ Threshold Applied: Actual KM ({breakdown.estimatedKm?.toLocaleString()} km) is below minimum ({breakdown.totalMinKm?.toLocaleString()} km)
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span>KM Charged:</span>
                            <span className="font-medium">{breakdown.kmCharged?.toLocaleString()} km</span>
                            <span className="text-xs">
                              {breakdown.thresholdApplied ? '(Minimum threshold)' : '(Actual KM)'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Rate per KM:</span>
                            <span className="font-medium">{formatCurrency(breakdown.ratePerKm)}</span>
                          </div>
                          <div className="flex justify-between pt-1 border-t font-medium">
                            <span>Calculation:</span>
                            <span>{formatCurrency(breakdown.ratePerKm)} × {breakdown.kmCharged?.toLocaleString()} km = {formatCurrency(item.total)}</span>
                          </div>
                        </div>
                      )}

                      {breakdown.rateType === 'hybrid' && (
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div className="flex justify-between">
                            <span>Rate Type:</span>
                            <span className="font-medium">Hybrid (Per Day + Per KM)</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Days:</span>
                            <span className="font-medium">{breakdown.days} days</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Threshold (from settings):</span>
                            <span className="font-medium">{breakdown.thresholdKmPerDay} km/day</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Minimum KM Required:</span>
                            <span className="font-medium">{breakdown.totalMinKm?.toLocaleString()} km</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Estimated/Actual KM:</span>
                            <span className="font-medium">{breakdown.estimatedKm?.toLocaleString()} km</span>
                          </div>
                          {breakdown.thresholdApplied && (
                            <div className="bg-warning/10 text-warning p-2 rounded text-xs">
                              ⚠️ Threshold Applied: Actual KM ({breakdown.estimatedKm?.toLocaleString()} km) is below minimum ({breakdown.totalMinKm?.toLocaleString()} km)
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span>KM Charged:</span>
                            <span className="font-medium">{breakdown.kmCharged?.toLocaleString()} km</span>
                          </div>
                          <div className="flex justify-between pt-1 border-t">
                            <span>Base Amount ({breakdown.days} days):</span>
                            <span className="font-medium">{formatCurrency(breakdown.baseAmount)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>KM Amount ({formatCurrency(breakdown.ratePerKm)} × {breakdown.kmCharged?.toLocaleString()} km):</span>
                            <span className="font-medium">{formatCurrency(breakdown.kmAmount)}</span>
                          </div>
                          <div className="flex justify-between pt-1 border-t font-medium">
                            <span>Total:</span>
                            <span>{formatCurrency(item.total)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Select 
              value={status} 
              onValueChange={v => setStatus(v as BookingStatus)}
              required
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select status *" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inquiry">Save as Inquiry</SelectItem>
                <SelectItem value="tentative">Hold (Tentative - 2hr)</SelectItem>
                <SelectItem value="confirmed">Confirm Booking</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => navigate('/app/bookings/calendar')}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Booking
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Bank Account Dialog */}
      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New {accountDialogType === 'company' ? 'Company' : 'Personal'} Account</DialogTitle>
            <DialogDescription>
              Create a new bank account for {accountDialogType === 'company' ? 'company' : 'personal'} use.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Account Name *</Label>
              <Input
                value={newAccountName}
                onChange={e => setNewAccountName(e.target.value)}
                placeholder="e.g., HDFC Savings Account"
              />
            </div>
            <div className="space-y-2">
              <Label>Account Number</Label>
              <Input
                value={newAccountNumber}
                onChange={e => setNewAccountNumber(e.target.value)}
                placeholder="Enter account number"
              />
            </div>
            <div className="space-y-2">
              <Label>Bank Name</Label>
              <Input
                value={newBankName}
                onChange={e => setNewBankName(e.target.value)}
                placeholder="e.g., HDFC Bank"
              />
            </div>
            <div className="space-y-2">
              <Label>IFSC Code</Label>
              <Input
                value={newIfscCode}
                onChange={e => setNewIfscCode(e.target.value)}
                placeholder="e.g., HDFC0001234"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={newAccountNotes}
                onChange={e => setNewAccountNotes(e.target.value)}
                placeholder="Any additional notes..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAccountDialogOpen(false);
              setNewAccountName('');
              setNewAccountNumber('');
              setNewBankName('');
              setNewIfscCode('');
              setNewAccountNotes('');
            }}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!newAccountName.trim()) {
                  toast.error('Account name is required');
                  return;
                }
                if (!accountDialogType) return;

                try {
                  const newAccount = await createBankAccount.mutateAsync({
                    account_name: newAccountName.trim(),
                    account_number: newAccountNumber.trim() || null,
                    bank_name: newBankName.trim() || null,
                    ifsc_code: newIfscCode.trim() || null,
                    account_type: accountDialogType,
                    notes: newAccountNotes.trim() || null,
                  });

                  // Refresh accounts list
                  if (accountDialogType === 'company') {
                    await refetchCompanyAccounts();
                  } else {
                    await refetchPersonalAccounts();
                  }

                  // Auto-select the newly created account
                  if (accountDialogVehicleIndex !== null) {
                    if (accountDialogVehicleIndex === -1) {
                      // Booking level account
                      setAdvanceAccountId(newAccount.id);
                    } else {
                      // This shouldn't happen anymore, but keep for safety
                      updateRequestedVehicle(accountDialogVehicleIndex, 'advance_account_id', newAccount.id);
                    }
                  }

                  // Reset form and close dialog
                  setNewAccountName('');
                  setNewAccountNumber('');
                  setNewBankName('');
                  setNewIfscCode('');
                  setNewAccountNotes('');
                  setAccountDialogOpen(false);
                  setAccountDialogType(null);
                  setAccountDialogVehicleIndex(null);
                } catch (error) {
                  // Error is handled by the mutation
                }
              }}
              disabled={createBankAccount.isPending}
            >
              {createBankAccount.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Account'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
