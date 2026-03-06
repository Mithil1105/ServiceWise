import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format, addHours, parseISO } from 'date-fns';
import { formatDateDMY } from '@/lib/date';
import { getEstimatedKmFromDistance } from '@/lib/estimated-km';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Car, Check, X, Plus, Trash2, Loader2, Search, Users, ArrowUpDown, Lock, MapPin, Share2, Copy, MessageCircle, CalendarIcon } from 'lucide-react';
import { useCreateBooking, useAvailableCars, useAssignVehicle, useCreateRequestedVehicle, useDeleteRequestedVehicle } from '@/hooks/use-bookings';
import { useCar } from '@/hooks/use-cars';
import { useUpsertCustomer } from '@/hooks/use-customers';
import { useUpsertDriver } from '@/hooks/use-drivers';
import { useBankAccounts, useCreateBankAccount } from '@/hooks/use-bank-accounts';
import { useSystemConfig } from '@/hooks/use-dashboard';
import { CustomerAutocomplete } from '@/components/bookings/CustomerAutocomplete';
import { DriverAutocomplete } from '@/components/bookings/DriverAutocomplete';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import { cn, formatCarLabel } from '@/lib/utils';
import { RATE_TYPE_LABELS, type TripType, type RateType, type BookingStatus } from '@/types/booking';
import { useOrganizationSettings } from '@/hooks/use-organization-settings';
import { type BookingFormBuiltInFieldKey, BOOKING_FORM_FIELD_LABELS, DEFAULT_TRIP_TYPE_OPTIONS } from '@/types/form-config';

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
  vehicle_class?: 'lmv' | 'hmv';
  driver_name: string;
  driver_phone: string;
  requested_vehicle_id?: string | null;
}

type SortOption = 'vehicle_number' | 'model' | 'seats';

export default function BookingNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultDate = searchParams.get('date');
  const paramStart = searchParams.get('start');
  const paramEnd = searchParams.get('end');
  const paramCarId = searchParams.get('carId');
  const { isAdmin, isManager, isSupervisor, organization } = useAuth();
  const appliedCarIdRef = useRef(false);
  const [shareEstimateOpen, setShareEstimateOpen] = useState(false);

  const { data: orgSettings } = useOrganizationSettings();
  const bookingFormConfig = orgSettings?.booking_form_config ?? null;
  const defaultTermsText = 'This is just an estimate. Actual values may differ. Parking and toll charges are separate and will be added and shown directly in the final bill.';
  const effectiveTerms = (orgSettings?.terms_and_conditions?.trim() || defaultTermsText);
  const bookingFieldOverrides = bookingFormConfig?.fieldOverrides ?? {};
  const bookingCustomFields = (bookingFormConfig?.customFields ?? []).sort((a, b) => a.order - b.order);
  const tripTypeOptions = (bookingFormConfig?.tripTypeOptions?.length ? bookingFormConfig.tripTypeOptions : DEFAULT_TRIP_TYPE_OPTIONS).filter((o) => o.value && o.label);
  const getBookingFieldLabel = (key: BookingFormBuiltInFieldKey) => bookingFieldOverrides[key]?.label ?? BOOKING_FORM_FIELD_LABELS[key];
  const isBookingFieldHidden = (key: BookingFormBuiltInFieldKey) => bookingFieldOverrides[key]?.hidden === true;
  const isBookingFieldRequired = (key: BookingFormBuiltInFieldKey) => bookingFieldOverrides[key]?.required ?? true;

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
  const defaultTripValue = tripTypeOptions[0]?.value ?? 'local';
  const [tripType, setTripType] = useState<string>(defaultTripValue);
  useEffect(() => {
    const values = tripTypeOptions.map((o) => o.value);
    if (values.length && !values.includes(tripType)) setTripType(values[0]);
  }, [tripTypeOptions, tripType]);
  // Separate date and time states (support range from calendar: start, end with 9am–6pm)
  const defaultStartDate = paramStart || defaultDate || format(new Date(), "yyyy-MM-dd");
  const defaultStartTime = "09:00";
  const defaultEndDate = paramEnd || defaultDate || format(new Date(), "yyyy-MM-dd");
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
  const [estimatedKmFormula, setEstimatedKmFormula] = useState<string | null>(null); // Shown when calculated from distance
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
  const [bookingCustomValues, setBookingCustomValues] = useState<Record<string, string | number>>({});

  // Pre-fill from calendar availability: one requested + one assigned when carId in URL
  const { data: prefilledCar } = useCar(paramCarId ?? '');
  useEffect(() => {
    if (!paramCarId || !prefilledCar || appliedCarIdRef.current) return;
    appliedCarIdRef.current = true;
    setRequestedVehicles([{
      id: 'temp-0',
      brand: prefilledCar.brand ?? '',
      model: prefilledCar.model ?? '',
      rate_type: 'per_km',
      rate_total: '',
      rate_per_day: '',
      rate_per_km: '',
      driver_allowance_per_day: '',
    }]);
    setSelectedVehicles([{
      car_id: prefilledCar.id,
      vehicle_number: prefilledCar.vehicle_number,
      model: prefilledCar.model ?? '',
      seats: prefilledCar.seats ?? 5,
      vehicle_class: (prefilledCar.vehicle_class ?? 'lmv') as 'lmv' | 'hmv',
      driver_name: '',
      driver_phone: '',
      requested_vehicle_id: 'temp-0',
    }]);
  }, [paramCarId, prefilledCar]);

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
      seats: car.seats ?? 5,
      vehicle_class: car.vehicle_class ?? 'lmv',
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

  // Driver allowance total (per day × days for each requested vehicle)
  const totalDriverAllowance = useMemo(() => {
    if (requestedVehicles.length === 0) return 0;
    const days = startDateTime && endDateTime
      ? Math.ceil((endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60 * 24)) || 1
      : 0;
    return requestedVehicles.reduce(
      (sum, v) => sum + (Number(v.driver_allowance_per_day) || 0) * days,
      0
    );
  }, [requestedVehicles, startDateTime, endDateTime]);

  // Calculate grand total using requested vehicle prices + driver allowance (for billing)
  const grandTotal = useMemo(() => {
    // Use requested vehicles for billing if they exist
    if (requestedVehicles.length > 0) {
      const vehicleTotal = requestedVehicles.reduce((sum, v) => sum + calculateRequestedVehicleTotal(v).total, 0);
      return vehicleTotal + totalDriverAllowance;
    }
    // Otherwise use assigned vehicles
    return selectedVehicles.reduce((sum, v) => sum + calculateVehicleTotal(v), 0);
  }, [requestedVehicles, selectedVehicles, startDateTime, endDateTime, estimatedKm, defaultMinKmPerKm, defaultMinKmHybridPerDay, totalDriverAllowance]);

  // Get detailed breakdown for quote summary — use assigned vehicle name when linked, not requested
  const quoteBreakdown = useMemo(() => {
    if (requestedVehicles.length === 0) return null;

    const days = startDateTime && endDateTime
      ? Math.ceil((endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60 * 24)) || 1
      : 0;
    const bookingEstimatedKm = Number(estimatedKm) || 0;

    return requestedVehicles.map((rv, idx) => {
      const tempId = rv.id || `temp-${idx}`;
      const assigned = selectedVehicles.find(sv => sv.requested_vehicle_id === tempId);
      const vehicleDisplay = assigned
        ? assigned.model
        : `Requested: ${rv.brand} ${rv.model}`;

      const vehicleTotal = calculateRequestedVehicleTotal(rv);
      const driverAllowance = (Number(rv.driver_allowance_per_day) || 0) * days;
      return {
        vehicle: vehicleDisplay,
        ...vehicleTotal,
        driverAllowance,
      };
    });
  }, [requestedVehicles, selectedVehicles, startDateTime, endDateTime, estimatedKm, defaultMinKmPerKm, defaultMinKmHybridPerDay]);

  const totalAdvance = useMemo(() => {
    return Number(advanceAmount) || 0;
  }, [advanceAmount]);

  const handleAddVehicle = (car: typeof availableForSelection[0]) => {
    setSelectedVehicles(prev => [...prev, {
      car_id: car.car_id,
      vehicle_number: car.vehicle_number,
      model: car.model,
      seats: car.seats ?? 5,
      vehicle_class: car.vehicle_class ?? 'lmv',
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
      rate_type: 'per_km' as RateType,
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
    const totalBookingAmount = requestedVehicles.length > 0
      ? grandTotal
      : selectedVehicles.reduce((sum, v) => sum + calculateVehicleTotal(v), 0);
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

      const customAttrs: Record<string, string | number | boolean | null> = {};
      for (const f of bookingCustomFields) {
        const val = bookingCustomValues[f.key];
        if (f.required && (val === undefined || val === '')) {
          toast.error(`${f.label} is required`);
          return;
        }
        if (val !== undefined && val !== '') customAttrs[f.key] = typeof val === 'number' ? val : String(val);
      }

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
        advance_amount: Number(advanceAmount) || 0,
        advance_payment_method: advancePaymentMethod || null,
        advance_collected_by: advanceCollectedBy.trim() || null,
        advance_account_type: advanceAccountType || null,
        advance_account_id: advanceAccountId || null,
        custom_attributes: Object.keys(customAttrs).length ? customAttrs : undefined,
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

  /** Build detailed billing lines for the shared estimate so the customer understands threshold, km charged, etc. */
  const getEstimateBreakdownDetailLines = (
    breakdown: { rateType: string; days?: number; estimatedKm?: number; thresholdKmPerDay?: number; totalMinKm?: number; kmCharged?: number; ratePerKm?: number; thresholdApplied?: boolean; baseAmount?: number; kmAmount?: number } | undefined
  ): string[] => {
    if (!breakdown) return [];
    const lines: string[] = [];
    switch (breakdown.rateType) {
      case 'total':
        lines.push('  Rate: Fixed total for the trip.');
        break;
      case 'per_day':
        lines.push(`  Rate: Per day. Trip duration: ${breakdown.days} days.`);
        const perDayRate = breakdown.days && breakdown.baseAmount != null ? breakdown.baseAmount / breakdown.days : 0;
        lines.push(`  Calculation: ${breakdown.days} days × ${formatCurrency(perDayRate)}/day = ${formatCurrency(breakdown.baseAmount ?? 0)}.`);
        break;
      case 'per_km':
        lines.push('  Rate: Per kilometer.');
        lines.push(`  Trip duration: ${breakdown.days} days. Minimum chargeable km: ${breakdown.thresholdKmPerDay} km/day × ${breakdown.days} days = ${breakdown.totalMinKm?.toLocaleString()} km total.`);
        lines.push(`  Your estimated km for this trip: ${breakdown.estimatedKm?.toLocaleString()} km.`);
        if (breakdown.thresholdApplied) {
          lines.push(`  Since your estimate is below the minimum, we charge for ${breakdown.kmCharged?.toLocaleString()} km (minimum applies).`);
        } else {
          lines.push(`  We charge the higher of estimated or minimum → ${breakdown.kmCharged?.toLocaleString()} km charged.`);
        }
        lines.push(`  Rate per km: ${formatCurrency(breakdown.ratePerKm ?? 0)}. Vehicle charge: ${breakdown.kmCharged?.toLocaleString()} km × ${formatCurrency(breakdown.ratePerKm ?? 0)} = ${formatCurrency(breakdown.kmAmount ?? 0)}.`);
        break;
      case 'hybrid':
        lines.push('  Rate: Hybrid (per day + per km).');
        const hybridPerDayRate = breakdown.days && breakdown.baseAmount != null ? breakdown.baseAmount / breakdown.days : 0;
        lines.push(`  Per day part: ${breakdown.days} days × ${formatCurrency(hybridPerDayRate)}/day = ${formatCurrency(breakdown.baseAmount ?? 0)}.`);
        lines.push(`  Per km part: Minimum chargeable km = ${breakdown.thresholdKmPerDay} km/day × ${breakdown.days} days = ${breakdown.totalMinKm?.toLocaleString()} km. Your estimated km: ${breakdown.estimatedKm?.toLocaleString()} km → km charged: ${breakdown.kmCharged?.toLocaleString()} km${breakdown.thresholdApplied ? ' (minimum applied).' : '.'}`);
        lines.push(`  Per km: ${breakdown.kmCharged?.toLocaleString()} km × ${formatCurrency(breakdown.ratePerKm ?? 0)} = ${formatCurrency(breakdown.kmAmount ?? 0)}.`);
        lines.push(`  Subtotal for this vehicle: ${formatCurrency((breakdown.baseAmount ?? 0) + (breakdown.kmAmount ?? 0))}.`);
        break;
      default:
        break;
    }
    return lines;
  };

  /** Build full estimate text with WhatsApp-style *bold* so copy-paste to WhatsApp looks good. */
  const getFormattedEstimateText = (): string => {
    const companyName = organization?.company_name || organization?.name || 'Company';
    const tripDates = startDate && endDate
      ? `${formatDateDMY(startDate)} – ${formatDateDMY(endDate)}`
      : '—';
    let t = `*${companyName}*\n*Trip estimate*\n${'─'.repeat(28)}\n\n`;
    if (customerName.trim()) t += `*Customer:* ${customerName.trim()}\n`;
    if (customerPhone.trim()) t += `*Phone:* ${customerPhone.trim()}\n`;
    t += `*Trip dates:* ${tripDates}\n\n`;
    t += `*Total estimate:* ${formatCurrency(grandTotal)}\n`;
    if (totalDriverAllowance > 0) t += `(includes driver allowance: ${formatCurrency(totalDriverAllowance)})\n`;
    t += `*Advance:* ${formatCurrency(totalAdvance)}  |  *Due:* ${formatCurrency(grandTotal - totalAdvance)}\n\n`;
    if (quoteBreakdown && quoteBreakdown.length > 0) {
      t += `*Vehicle-wise estimate:*\n\n`;
      quoteBreakdown.forEach((item) => {
        const b = item.breakdown;
        const why = b?.rateType === 'total' ? 'Fixed total' : b?.rateType === 'per_day' && b.days ? `Per day × ${b.days} days` : b?.rateType === 'per_km' && b.kmCharged != null ? `Per km × ${b.kmCharged.toLocaleString()} km` : b?.rateType === 'hybrid' ? `Hybrid (${b.days} days + ${b.kmCharged?.toLocaleString()} km)` : '';
        t += `• *${item.vehicle}:* ${formatCurrency(item.total)}${why ? ` (${why})` : ''}\n`;
        if ('driverAllowance' in item && (item as { driverAllowance?: number }).driverAllowance) {
          t += `  *Driver allowance:* ${formatCurrency((item as { driverAllowance: number }).driverAllowance)}\n`;
        }
        getEstimateBreakdownDetailLines(b).forEach((line) => { t += line + '\n'; });
        t += '\n';
      });
    }
    t += `*Terms & conditions:*\n${effectiveTerms}\n`;
    return t;
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Start Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !startDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? formatDateDMY(startDate) : 'Select start date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate ? parseISO(startDate) : undefined}
                        onSelect={(d) => d && setStartDate(format(d, 'yyyy-MM-dd'))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
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
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !endDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? formatDateDMY(endDate) : 'Select end date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate ? parseISO(endDate) : undefined}
                        onSelect={(d) => d && setEndDate(format(d, 'yyyy-MM-dd'))}
                        disabled={(date) => startDate ? date < parseISO(startDate) : false}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
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
            
            {/* Estimated KM Field */}
            <div className="space-y-2">
              <Label htmlFor="estimated-km">Estimated KM</Label>
              <Input
                id="estimated-km"
                type="number"
                value={estimatedKm}
                onChange={e => {
                  setEstimatedKm(e.target.value);
                  setEstimatedKmFormula(null);
                }}
                placeholder="Enter estimated kilometers"
              />
              {estimatedKmFormula && (
                <p className="text-xs text-muted-foreground font-medium" role="status">
                  {estimatedKmFormula}
                </p>
              )}
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

          {bookingCustomFields.length > 0 && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {bookingCustomFields.map((f) => (
                  <div key={f.id} className="space-y-1">
                    <Label className="text-xs">{f.label}{f.required ? ' *' : ''}</Label>
                    {f.type === 'text' && (
                      <Input
                        value={String(bookingCustomValues[f.key] ?? '')}
                        onChange={(e) => setBookingCustomValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                        placeholder={f.label}
                      />
                    )}
                    {f.type === 'number' && (
                      <Input
                        type="number"
                        value={bookingCustomValues[f.key] !== undefined && bookingCustomValues[f.key] !== '' ? Number(bookingCustomValues[f.key]) : ''}
                        onChange={(e) => setBookingCustomValues((prev) => ({ ...prev, [f.key]: e.target.value === '' ? '' : Number(e.target.value) }))}
                        placeholder={f.label}
                      />
                    )}
                    {f.type === 'date' && (
                      <Input
                        type="date"
                        value={typeof bookingCustomValues[f.key] === 'string' ? bookingCustomValues[f.key] : ''}
                        onChange={(e) => setBookingCustomValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      />
                    )}
                    {f.type === 'select' && (
                      <Select
                        value={String(bookingCustomValues[f.key] ?? '')}
                        onValueChange={(v) => setBookingCustomValues((prev) => ({ ...prev, [f.key]: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {(f.options ?? []).map((opt) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

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
                        <span>{formatCarLabel({ vehicle_number: car.vehicle_number, model: car.model })}</span>
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

              {/* Assigned vehicle name + link to requested vehicle (one requested vehicle per assigned vehicle) */}
              {requestedVehicles.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs">Assigned vehicle</Label>
                  <Select
                    value={vehicle.requested_vehicle_id || 'none'}
                    onValueChange={v => {
                      const value = v === 'none' ? null : v;
                      updateVehicle(vehicle.car_id, 'requested_vehicle_id', value || '');
                    }}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue>
                        {vehicle.requested_vehicle_id ? vehicle.model : 'Select requested vehicle to link...'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {requestedVehicles.map((rv, idx) => {
                        const tempId = rv.id || `temp-${idx}`;
                        const isTakenByOther = selectedVehicles.some(
                          sv => sv.car_id !== vehicle.car_id && sv.requested_vehicle_id === tempId
                        );
                        return (
                          <SelectItem key={tempId} value={tempId} disabled={isTakenByOther}>
                            {rv.brand} {rv.model} - {formatCurrency(calculateRequestedVehicleTotal(rv).total)}
                            {isTakenByOther && ' (already linked)'}
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
                vehicleClass={vehicle.vehicle_class}
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
            <div className="flex justify-between items-start gap-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  Quote Summary
                  {requestedVehicles.length > 0 && (
                    <span className="ml-2 text-xs">(based on requested vehicles)</span>
                  )}
                </p>
                <p className="text-sm font-medium text-muted-foreground mt-1">Estimated total</p>
                <p className="text-2xl font-bold">{formatCurrency(grandTotal)}</p>
                {totalDriverAllowance > 0 && (
                  <p className="text-xs text-muted-foreground">Includes {formatCurrency(totalDriverAllowance)} driver allowance</p>
                )}
                <p className="text-sm text-success">Advance: {formatCurrency(totalAdvance)} | Due: {formatCurrency(grandTotal - totalAdvance)}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShareEstimateOpen(true)}
                className="shrink-0"
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share estimate
              </Button>
            </div>

            {/* Detailed Breakdown */}
            {quoteBreakdown && quoteBreakdown.length > 0 && (
              <div className="pt-4 border-t space-y-3">
                <p className="text-sm font-medium text-muted-foreground">Payment Calculation Breakdown:</p>
                {quoteBreakdown.map((item, idx) => {
                  const breakdown = item.breakdown;
                  if (!breakdown) return null;

                  const whySummary = breakdown.rateType === 'total'
                    ? `Fixed total → ${formatCurrency(item.total)}`
                    : breakdown.rateType === 'per_day' && breakdown.days
                    ? `Per day × ${breakdown.days} days → ${formatCurrency(item.total)}`
                    : breakdown.rateType === 'per_km' && breakdown.kmCharged != null
                    ? `Per km × ${breakdown.kmCharged.toLocaleString()} km → ${formatCurrency(item.total)}`
                    : breakdown.rateType === 'hybrid'
                    ? `Per day + Per km (${breakdown.days} days, ${breakdown.kmCharged?.toLocaleString()} km) → ${formatCurrency(item.total)}`
                    : null;

                  return (
                    <div key={idx} className="bg-background/50 p-3 rounded-md space-y-2 text-sm">
                      <p className="font-medium">{item.vehicle}</p>
                      {whySummary && (
                        <p className="text-xs text-muted-foreground font-medium border-b pb-2">{whySummary}</p>
                      )}
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
                      {'driverAllowance' in item && Number((item as { driverAllowance?: number }).driverAllowance) > 0 && (
                        <div className="flex justify-between pt-2 border-t text-xs text-muted-foreground">
                          <span>Driver allowance:</span>
                          <span className="font-medium">{formatCurrency((item as { driverAllowance: number }).driverAllowance)}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-2 border-t-2 font-semibold text-sm mt-2">
                        <span>Computed total (this vehicle):</span>
                        <span>
                          {formatCurrency(
                            item.total + (Number((item as { driverAllowance?: number }).driverAllowance) || 0)
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Terms and conditions: default disclaimer when empty; fully editable by admin in Settings → Branding */}
            <div className="pt-4 border-t">
              <p className="text-sm font-medium text-muted-foreground mb-2">Terms and conditions</p>
              <div className="text-xs text-muted-foreground whitespace-pre-wrap rounded-md bg-muted/30 p-3 max-h-40 overflow-y-auto">
                {effectiveTerms}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 italic">
                Editable in Settings → Branding
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Share estimate dialog */}
      <Dialog open={shareEstimateOpen} onOpenChange={setShareEstimateOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Share estimate with client
            </DialogTitle>
            <DialogDescription>
              Copy the estimate and terms to clipboard or share via WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap max-h-[320px] overflow-y-auto">
              {getFormattedEstimateText()}
            </div>
            <p className="text-xs text-muted-foreground">
              Uses *bold* formatting — when you copy or share to WhatsApp, key lines will appear bold.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(getFormattedEstimateText());
                  toast.success('Estimate copied to clipboard');
                }}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy to clipboard
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const message = getFormattedEstimateText();
                  const encoded = encodeURIComponent(message);
                  const phone = customerPhone.replace(/\D/g, '');
                  const waNumber = phone ? (phone.startsWith('91') ? phone : `91${phone}`) : '';
                  window.open(waNumber ? `https://wa.me/${waNumber}?text=${encoded}` : `https://wa.me/?text=${encoded}`, '_blank');
                  toast.success('Opening WhatsApp');
                }}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Share via WhatsApp
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
