import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, AlertCircle, Calculator, Plus, X, MapPin } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RATE_TYPE_LABELS, TRIP_TYPE_LABELS } from '@/types/booking';
import type { RateType, TripType, VehicleBillDetail } from '@/types/booking';
import { toLocalDateInputValue, isoAtNoonUtcFromDateInput } from '@/lib/date';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CustomerAutocomplete } from '@/components/bookings/CustomerAutocomplete';
import { useCars } from '@/hooks/use-cars';
import { useUpsertCustomer } from '@/hooks/use-customers';
import { useSystemConfig } from '@/hooks/use-dashboard';
import { useBankAccounts, useCreateBankAccount } from '@/hooks/use-bank-accounts';
import { useAuth } from '@/lib/auth-context';
import { TransferDialog } from './TransferDialog';

interface VehicleInput {
  car_id: string | null; // null means manual entry
  vehicle_number: string;
  driver_name: string;
  driver_phone: string;
  rate_type: RateType;
  rate_total?: number;
  rate_per_day?: number;
  rate_per_km?: number;
  days?: number;
  km_driven?: number;
  final_amount: number;
  breakdown?: any; // Store breakdown for display
}

interface CreateStandaloneBillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateStandaloneBillDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateStandaloneBillDialogProps) {
  const queryClient = useQueryClient();
  const { data: cars = [] } = useCars();
  const upsertCustomer = useUpsertCustomer();
  const { data: minKmPerKm } = useSystemConfig('minimum_km_per_km');
  const { data: minKmHybridPerDay } = useSystemConfig('minimum_km_hybrid_per_day');
  const { data: companyAccounts = [] } = useBankAccounts('company');
  const { data: personalAccounts = [] } = useBankAccounts('personal');
  const createBankAccount = useCreateBankAccount();
  const { user, profile } = useAuth();
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Bank account dialog state
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [accountDialogType, setAccountDialogType] = useState<'company' | 'personal'>('company');
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [newBankName, setNewBankName] = useState('');
  const [newIfscCode, setNewIfscCode] = useState('');
  
  // Customer details
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  
  // Trip details
  const [tripType, setTripType] = useState<TripType>('local');
  const [startDate, setStartDate] = useState(toLocalDateInputValue(new Date()));
  const [endDate, setEndDate] = useState(toLocalDateInputValue(new Date()));
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  
  // KM details
  const [kmMethod, setKmMethod] = useState<'odometer' | 'manual'>('manual');
  const [startOdometer, setStartOdometer] = useState('');
  const [endOdometer, setEndOdometer] = useState('');
  const [manualKm, setManualKm] = useState('');
  
  // Vehicles
  const [vehicles, setVehicles] = useState<VehicleInput[]>([
    {
      car_id: null,
      vehicle_number: '',
      driver_name: '',
      driver_phone: '',
      rate_type: 'total',
      final_amount: 0,
    }
  ]);
  
  // Amounts
  const [advanceAmount, setAdvanceAmount] = useState('0');
  const [advancePaymentMethod, setAdvancePaymentMethod] = useState<'cash' | 'online' | ''>('');
  const [advanceCollectedBy, setAdvanceCollectedBy] = useState('');
  const [advanceAccountType, setAdvanceAccountType] = useState<'company' | 'personal' | ''>('');
  const [advanceAccountId, setAdvanceAccountId] = useState<string | null>(null);
  const [thresholdNote, setThresholdNote] = useState('');
  
  // Transfer dialog state
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [billGenerationResult, setBillGenerationResult] = useState<any>(null);

  // Calculate days
  const calculateDays = (start: string, end: string): number => {
    if (!start || !end) return 1;
    const startDate = new Date(isoAtNoonUtcFromDateInput(start));
    const endDate = new Date(isoAtNoonUtcFromDateInput(end));
    const diffTime = endDate.getTime() - startDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 1;
  };

  const totalDays = calculateDays(startDate, endDate);

  // Calculate vehicle amount with threshold rules
  const calculateVehicleAmount = (vehicle: VehicleInput, totalKm: number, days: number): { 
    finalAmount: number; 
    thresholdNote: string | null;
    breakdown: {
      rateType: string;
      baseRate?: number;
      days?: number;
      actualKm?: number;
      thresholdKm?: number;
      kmCharged?: number;
      baseAmount?: number;
      kmAmount?: number;
    };
  } => {
    let finalAmount = 0;
    let thresholdNote: string | null = null;
    let breakdown: any = { rateType: vehicle.rate_type };

    switch (vehicle.rate_type) {
      case 'total':
        finalAmount = vehicle.rate_total || 0;
        breakdown.baseRate = vehicle.rate_total;
        break;
      case 'per_day':
        finalAmount = (vehicle.rate_per_day || 0) * days;
        breakdown.baseRate = vehicle.rate_per_day;
        breakdown.days = days;
        breakdown.baseAmount = finalAmount;
        break;
      case 'per_km':
        // Threshold: days × threshold_km_per_day (threshold is per day, multiply by trip days)
        const thresholdKmPerDay = minKmPerKm ? Number(minKmPerKm) : 100; // This is the threshold per day
        const totalMinKm = thresholdKmPerDay * days; // Total minimum KM for the trip = threshold per day × number of days
        const kmToCharge = Math.max(totalKm, totalMinKm);
        finalAmount = (vehicle.rate_per_km || 0) * kmToCharge;
        
        breakdown.baseRate = vehicle.rate_per_km;
        breakdown.days = days;
        breakdown.actualKm = totalKm;
        breakdown.thresholdKm = thresholdKmPerDay;
        breakdown.totalThresholdKm = totalMinKm;
        breakdown.kmCharged = kmToCharge;
        breakdown.kmAmount = finalAmount;
        
        if (totalKm < totalMinKm) {
          thresholdNote = `Minimum KM threshold applied: ${thresholdKmPerDay} km/day × ${days} days = ${totalMinKm} km (Company Policy). Actual KM: ${totalKm} km.`;
        }
        break;
      case 'hybrid':
        // Threshold: days × threshold_km_per_day
        const minKmHybridPerDay = minKmHybridPerDay ? Number(minKmHybridPerDay) : 100;
        const totalMinKmHybrid = minKmHybridPerDay * days; // Total minimum KM for the trip
        const kmToChargeHybrid = Math.max(totalKm, totalMinKmHybrid);
        
        const baseAmount = (vehicle.rate_per_day || 0) * days;
        const kmAmount = (vehicle.rate_per_km || 0) * kmToChargeHybrid;
        finalAmount = baseAmount + kmAmount;
        
        breakdown.baseRatePerDay = vehicle.rate_per_day;
        breakdown.kmRate = vehicle.rate_per_km;
        breakdown.days = days;
        breakdown.actualKm = totalKm;
        breakdown.thresholdKm = minKmHybridPerDay;
        breakdown.totalThresholdKm = totalMinKmHybrid;
        breakdown.kmCharged = kmToChargeHybrid;
        breakdown.baseAmount = baseAmount;
        breakdown.kmAmount = kmAmount;
        
        if (totalKm < totalMinKmHybrid) {
          thresholdNote = `Minimum KM threshold applied: ${minKmHybridPerDay} km/day × ${days} days = ${totalMinKmHybrid} km (Company Policy). Actual KM: ${totalKm} km.`;
        }
        break;
      default:
        finalAmount = 0;
    }

    return { finalAmount, thresholdNote, breakdown };
  };

  const updateVehicle = (index: number, updates: Partial<VehicleInput>) => {
    const newVehicles = [...vehicles];
    newVehicles[index] = { ...newVehicles[index], ...updates };
    
    // If car_id is selected, update vehicle_number from fleet
    if (updates.car_id && updates.car_id !== 'manual') {
      const selectedCar = cars.find(c => c.id === updates.car_id);
      if (selectedCar) {
        newVehicles[index].vehicle_number = selectedCar.vehicle_number;
      }
    }
    
    // Recalculate final amount
    const totalKm = kmMethod === 'odometer' && startOdometer && endOdometer
      ? parseFloat(endOdometer) - parseFloat(startOdometer)
      : parseFloat(manualKm) || 0;
    
    const { finalAmount } = calculateVehicleAmount(newVehicles[index], totalKm, totalDays);
    newVehicles[index].final_amount = finalAmount;
    setVehicles(newVehicles);
  };

  const addVehicle = () => {
    setVehicles([...vehicles, {
      car_id: null,
      vehicle_number: '',
      driver_name: '',
      driver_phone: '',
      rate_type: 'total',
      final_amount: 0,
    }]);
  };
  
  const handleSelectCustomer = async (customer: { name: string; phone: string }) => {
    // Auto-save customer to phonebook
    try {
      await upsertCustomer.mutateAsync({ name: customer.name, phone: customer.phone });
    } catch (error) {
      // Silent fail - customer might already exist
    }
  };

  const removeVehicle = (index: number) => {
    if (vehicles.length > 1) {
      setVehicles(vehicles.filter((_, i) => i !== index));
    }
  };

  // Recalculate all vehicle amounts when dates or KM change
  useEffect(() => {
    const totalKm = kmMethod === 'odometer' && startOdometer && endOdometer
      ? parseFloat(endOdometer) - parseFloat(startOdometer)
      : parseFloat(manualKm) || 0;
    
    setVehicles(vehicles.map(v => {
      const { finalAmount, breakdown } = calculateVehicleAmount(v, totalKm, totalDays);
      return { ...v, final_amount: finalAmount, breakdown };
    }));
  }, [startDate, endDate, kmMethod, startOdometer, endOdometer, manualKm, minKmPerKm, minKmHybridPerDay]);

  const createBill = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Validation
      setErrors({});
      if (!customerName.trim()) {
        setErrors({ customerName: 'Customer name is required' });
        throw new Error('Customer name is required');
      }
      if (!customerPhone.trim()) {
        setErrors({ customerPhone: 'Customer phone is required' });
        throw new Error('Customer phone is required');
      }
      
      // Save customer to phonebook
      try {
        await upsertCustomer.mutateAsync({ name: customerName.trim(), phone: customerPhone.trim() });
      } catch (error) {
        // Silent fail - customer might already exist
      }
      if (!startDate || !endDate) {
        setErrors({ dates: 'Both start and end dates are required' });
        throw new Error('Both dates are required');
      }
      
      const start = new Date(isoAtNoonUtcFromDateInput(startDate));
      const end = new Date(isoAtNoonUtcFromDateInput(endDate));
      if (end <= start) {
        setErrors({ dates: 'End date must be after start date' });
        throw new Error('End date must be after start date');
      }
      
      // Calculate total KM
      let totalKm = 0;
      if (kmMethod === 'odometer') {
        if (!startOdometer || !endOdometer) {
          setErrors({ odometer: 'Both odometer readings are required' });
          throw new Error('Odometer readings required');
        }
        totalKm = parseFloat(endOdometer) - parseFloat(startOdometer);
        if (totalKm < 0) {
          setErrors({ odometer: 'End reading must be greater than start reading' });
          throw new Error('Invalid odometer readings');
        }
      } else {
        totalKm = parseFloat(manualKm) || 0;
      }
      
      // Validate vehicles
      for (let i = 0; i < vehicles.length; i++) {
        const v = vehicles[i];
        if (!v.vehicle_number.trim()) {
          setErrors({ [`vehicle_${i}`]: `Vehicle ${i + 1}: Vehicle number is required` });
          throw new Error(`Vehicle ${i + 1} number is required`);
        }
        
        // Validate rate fields based on rate type
        if (v.rate_type === 'total' && !v.rate_total) {
          setErrors({ [`vehicle_${i}`]: `Vehicle ${i + 1}: Total rate is required` });
          throw new Error(`Vehicle ${i + 1} total rate is required`);
        }
        if (v.rate_type === 'per_day' && !v.rate_per_day) {
          setErrors({ [`vehicle_${i}`]: `Vehicle ${i + 1}: Per day rate is required` });
          throw new Error(`Vehicle ${i + 1} per day rate is required`);
        }
        if (v.rate_type === 'per_km' && !v.rate_per_km) {
          setErrors({ [`vehicle_${i}`]: `Vehicle ${i + 1}: Per KM rate is required` });
          throw new Error(`Vehicle ${i + 1} per KM rate is required`);
        }
        if (v.rate_type === 'hybrid' && (!v.rate_per_day || !v.rate_per_km)) {
          setErrors({ [`vehicle_${i}`]: `Vehicle ${i + 1}: Both per day and per KM rates are required` });
          throw new Error(`Vehicle ${i + 1} hybrid rates are required`);
        }
      }
      
      // Calculate totals and collect threshold notes
      let combinedThresholdNote: string | null = null;
      const vehicleDetails: VehicleBillDetail[] = vehicles.map(v => {
        // Recalculate with threshold rules
        const { finalAmount, thresholdNote, breakdown: calcBreakdown } = calculateVehicleAmount(v, totalKm, totalDays);
        if (thresholdNote && !combinedThresholdNote) {
          combinedThresholdNote = thresholdNote;
        }
        
        const rateBreakdown: VehicleBillDetail['rate_breakdown'] = {
          final_amount: finalAmount,
        };
        
        if (v.rate_type === 'total') {
          rateBreakdown.rate_total = v.rate_total;
        } else if (v.rate_type === 'per_day') {
          rateBreakdown.rate_per_day = v.rate_per_day;
          rateBreakdown.days = totalDays;
          rateBreakdown.base_amount = finalAmount;
        } else if (v.rate_type === 'per_km') {
          // Use breakdown values which already account for threshold (days × threshold per day)
          rateBreakdown.rate_per_km = v.rate_per_km;
          rateBreakdown.km_driven = calcBreakdown.kmCharged || totalKm; // Use charged KM (with threshold)
          rateBreakdown.km_amount = finalAmount;
        } else if (v.rate_type === 'hybrid') {
          // Use breakdown values which already account for threshold (days × threshold per day)
          rateBreakdown.rate_per_day = v.rate_per_day;
          rateBreakdown.rate_per_km = v.rate_per_km;
          rateBreakdown.days = totalDays;
          rateBreakdown.km_driven = calcBreakdown.kmCharged || totalKm; // Use charged KM (with threshold)
          rateBreakdown.base_amount = calcBreakdown.baseAmount || ((v.rate_per_day || 0) * totalDays);
          rateBreakdown.km_amount = calcBreakdown.kmAmount || ((v.rate_per_km || 0) * (calcBreakdown.kmCharged || totalKm));
        }
        
        return {
          vehicle_number: v.vehicle_number,
          driver_name: v.driver_name || null,
          driver_phone: v.driver_phone || null,
          rate_type: v.rate_type,
          rate_breakdown: rateBreakdown,
          final_amount: finalAmount,
        };
      });
      
      // Calculate totals
      const totalAmount = vehicleDetails.reduce((sum, v) => sum + v.final_amount, 0);
      const advance = parseFloat(advanceAmount) || 0;
      const balance = totalAmount - advance;
      
      // Use combined threshold note or the one from form
      const finalThresholdNote = combinedThresholdNote || thresholdNote.trim() || null;
      
      // Generate bill number
      const year = new Date().getFullYear();
      const { data: lastBill } = await supabase
        .from('bills')
        .select('bill_number')
        .like('bill_number', `PT-BILL-${year}-%`)
        .order('bill_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      let billNumber = '';
      if (lastBill?.bill_number) {
        const lastNum = parseInt(lastBill.bill_number.split('-').pop() || '0');
        billNumber = `PT-BILL-${year}-${String(lastNum + 1).padStart(6, '0')}`;
      } else {
        billNumber = `PT-BILL-${year}-000001`;
      }
      
      // Create bill
      const { data: bill, error: billError } = await supabase
        .from('bills')
        .insert({
          booking_id: null, // Standalone bill
          bill_number: billNumber,
          status: 'draft', // Create as draft, but PDF won't show draft badge
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          start_at: start.toISOString(),
          end_at: end.toISOString(),
          pickup: pickup.trim() || null,
          dropoff: dropoff.trim() || null,
          start_odometer_reading: kmMethod === 'odometer' ? parseFloat(startOdometer) : null,
          end_odometer_reading: kmMethod === 'odometer' ? parseFloat(endOdometer) : null,
          total_km_driven: totalKm,
          km_calculation_method: kmMethod,
          vehicle_details: vehicleDetails,
          total_amount: totalAmount,
          total_driver_allowance: 0, // Standalone bills don't have driver allowance
          advance_amount: advance,
          balance_amount: balance,
          threshold_note: finalThresholdNote,
          created_by: user?.id,
        })
        .select()
        .single();
      
      if (billError) throw billError;
      
      return bill;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      toast.success('Bill created successfully');
      onOpenChange(false);
      
      // Store result and show transfer dialog if needed
      setBillGenerationResult(result);
      
      // Show transfer dialog if advance payment needs transfer
      if (result.advanceInfo && result.advanceInfo.amount > 0 && 
          (result.advanceInfo.payment_method === 'cash' || result.advanceInfo.account_type === 'personal')) {
        setTransferDialogOpen(true);
      } else {
        // No transfer needed, call onSuccess directly
        onSuccess?.();
        resetForm();
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to create bill: ${error.message}`);
    },
  });

  const totalAmount = vehicles.reduce((sum, v) => sum + v.final_amount, 0);
  const advance = parseFloat(advanceAmount) || 0;
  const balance = totalAmount - advance;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Create Standalone Bill
          </DialogTitle>
          <DialogDescription>
            Create a new bill without a booking. All details can be entered manually.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Customer Details */}
          <div className="space-y-4 border rounded-lg p-4">
            <h3 className="font-semibold">Customer Details</h3>
            <CustomerAutocomplete
              customerName={customerName}
              customerPhone={customerPhone}
              onNameChange={setCustomerName}
              onPhoneChange={setCustomerPhone}
              onSelectCustomer={handleSelectCustomer}
            />
            {errors.customerName && (
              <p className="text-sm text-destructive">{errors.customerName}</p>
            )}
            {errors.customerPhone && (
              <p className="text-sm text-destructive">{errors.customerPhone}</p>
            )}
          </div>

          {/* Trip Details */}
          <div className="space-y-4 border rounded-lg p-4">
            <h3 className="font-semibold">Trip Details</h3>
            <div className="space-y-2">
              <Label>Trip Type</Label>
              <Select value={tripType} onValueChange={(v) => setTripType(v as TripType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TRIP_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date *</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date *</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            {startDate && endDate && !errors.dates && (
              <p className="text-sm text-muted-foreground">
                Total Days: {totalDays} {totalDays === 1 ? 'day' : 'days'}
              </p>
            )}
            {errors.dates && (
              <p className="text-sm text-destructive">{errors.dates}</p>
            )}
            <div className="grid grid-cols-2 gap-4">
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
                <Label htmlFor="dropoff">Dropoff Location</Label>
                <Input
                  id="dropoff"
                  value={dropoff}
                  onChange={(e) => setDropoff(e.target.value)}
                  placeholder="Enter dropoff location"
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
                      const estimatedKm = Math.round(result.distance);
                      setManualKm(estimatedKm.toString());
                      toast.success(`Distance calculated: ${estimatedKm} km`);
                    }
                  }}
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  Calculate Distance
                </Button>
              </div>
            )}
          </div>

          {/* KM Details */}
          <div className="space-y-4 border rounded-lg p-4">
            <h3 className="font-semibold">KM Details</h3>
            <div className="space-y-3">
              <Label>KM Calculation Method</Label>
              <RadioGroup value={kmMethod} onValueChange={(value) => setKmMethod(value as 'odometer' | 'manual')}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="odometer" id="km-odometer" />
                  <Label htmlFor="km-odometer" className="font-normal cursor-pointer">
                    Odometer Reading
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="manual" id="km-manual" />
                  <Label htmlFor="km-manual" className="font-normal cursor-pointer">
                    Manual Entry
                  </Label>
                </div>
              </RadioGroup>
            </div>
            {kmMethod === 'odometer' ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-odo">Start Odometer (km)</Label>
                  <Input
                    id="start-odo"
                    type="number"
                    value={startOdometer}
                    onChange={(e) => setStartOdometer(e.target.value)}
                    placeholder="e.g., 50000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-odo">End Odometer (km)</Label>
                  <Input
                    id="end-odo"
                    type="number"
                    value={endOdometer}
                    onChange={(e) => setEndOdometer(e.target.value)}
                    placeholder="e.g., 50500"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="manual-km">Total KM Driven</Label>
                <Input
                  id="manual-km"
                  type="number"
                  value={manualKm}
                  onChange={(e) => setManualKm(e.target.value)}
                  placeholder="e.g., 500"
                />
              </div>
            )}
            {errors.odometer && (
              <p className="text-sm text-destructive">{errors.odometer}</p>
            )}
          </div>

          {/* Vehicles */}
          <div className="space-y-4 border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Vehicles</h3>
              <Button type="button" variant="outline" size="sm" onClick={addVehicle}>
                <Plus className="h-4 w-4 mr-2" />
                Add Vehicle
              </Button>
            </div>
            {vehicles.map((vehicle, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Vehicle {index + 1}</h4>
                  {vehicles.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeVehicle(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Select Vehicle from Fleet *</Label>
                  <Select
                    value={vehicle.car_id || 'manual'}
                    onValueChange={(value) => {
                      if (value === 'manual') {
                        updateVehicle(index, { car_id: null, vehicle_number: '' });
                      } else {
                        updateVehicle(index, { car_id: value });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose from fleet or enter manually" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Enter Vehicle Number Manually</SelectItem>
                      {cars.filter(c => c.status === 'active').map(car => (
                        <SelectItem key={car.id} value={car.id}>
                          {car.vehicle_number} - {car.model} {car.brand ? `(${car.brand})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Vehicle Number *</Label>
                  <Input
                    value={vehicle.vehicle_number}
                    onChange={(e) => updateVehicle(index, { vehicle_number: e.target.value, car_id: null })}
                    placeholder="e.g., MH-12-AB-1234"
                    disabled={vehicle.car_id !== null && vehicle.car_id !== 'manual'}
                  />
                  {vehicle.car_id && vehicle.car_id !== 'manual' && (
                    <p className="text-xs text-muted-foreground">
                      Vehicle number is auto-filled from fleet. Select "Enter Manually" to override.
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Driver Name</Label>
                    <Input
                      value={vehicle.driver_name}
                      onChange={(e) => updateVehicle(index, { driver_name: e.target.value })}
                      placeholder="Enter driver name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Driver Phone</Label>
                    <Input
                      value={vehicle.driver_phone}
                      onChange={(e) => updateVehicle(index, { driver_phone: e.target.value })}
                      placeholder="Enter driver phone"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Rate Type *</Label>
                  <Select
                    value={vehicle.rate_type}
                    onValueChange={(value) => updateVehicle(index, { rate_type: value as RateType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(RATE_TYPE_LABELS).filter(([key]) => key !== 'hybrid').map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {vehicle.rate_type === 'total' && (
                  <div className="space-y-2">
                    <Label>Total Amount *</Label>
                    <Input
                      type="number"
                      value={vehicle.rate_total || ''}
                      onChange={(e) => updateVehicle(index, { rate_total: parseFloat(e.target.value) || 0 })}
                      placeholder="Enter total amount"
                    />
                  </div>
                )}
                {vehicle.rate_type === 'per_day' && (
                  <div className="space-y-2">
                    <Label>Rate Per Day *</Label>
                    <Input
                      type="number"
                      value={vehicle.rate_per_day || ''}
                      onChange={(e) => updateVehicle(index, { rate_per_day: parseFloat(e.target.value) || 0 })}
                      placeholder="Enter rate per day"
                    />
                  </div>
                )}
                {vehicle.rate_type === 'per_km' && (
                  <div className="space-y-2">
                    <Label>Rate Per KM *</Label>
                    <Input
                      type="number"
                      value={vehicle.rate_per_km || ''}
                      onChange={(e) => updateVehicle(index, { rate_per_km: parseFloat(e.target.value) || 0 })}
                      placeholder="Enter rate per km"
                    />
                  </div>
                )}
                {vehicle.rate_type === 'hybrid' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Rate Per Day *</Label>
                      <Input
                        type="number"
                        value={vehicle.rate_per_day || ''}
                        onChange={(e) => updateVehicle(index, { rate_per_day: parseFloat(e.target.value) || 0 })}
                        placeholder="Enter rate per day"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Rate Per KM *</Label>
                      <Input
                        type="number"
                        value={vehicle.rate_per_km || ''}
                        onChange={(e) => updateVehicle(index, { rate_per_km: parseFloat(e.target.value) || 0 })}
                        placeholder="Enter rate per km"
                      />
                    </div>
                  </div>
                )}
                <div className="bg-muted p-3 rounded-md">
                  <p className="text-sm font-medium">
                    Final Amount: ₹{vehicle.final_amount.toLocaleString('en-IN')}
                  </p>
                </div>
                {errors[`vehicle_${index}`] && (
                  <p className="text-sm text-destructive">{errors[`vehicle_${index}`]}</p>
                )}
              </div>
            ))}
          </div>

          {/* Amounts */}
          <div className="space-y-4 border rounded-lg p-4">
            <h3 className="font-semibold">Amounts</h3>
            <div className="space-y-2">
              <Label htmlFor="advance">Advance Amount</Label>
              <Input
                id="advance"
                type="number"
                value={advanceAmount}
                onChange={(e) => {
                  setAdvanceAmount(e.target.value);
                  // Clear payment method if advance is 0
                  if (parseFloat(e.target.value) === 0) {
                    setAdvancePaymentMethod('');
                    setAdvanceAccountType('');
                    setAdvanceAccountId(null);
                  }
                }}
                placeholder="0"
              />
              {advance > 0 && !advancePaymentMethod && (
                <p className="text-sm text-destructive">Payment method is required when advance amount is entered</p>
              )}
            </div>
            
            {/* Advance Payment Details */}
            {advance > 0 && (
              <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
                <h4 className="font-medium text-sm">Advance Payment Details</h4>
                
                <div className="space-y-2">
                  <Label>Payment Method *</Label>
                  <Select
                    value={advancePaymentMethod}
                    onValueChange={(value) => {
                      setAdvancePaymentMethod(value as 'cash' | 'online');
                      if (value === 'cash') {
                        setAdvanceAccountType('');
                        setAdvanceAccountId(null);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="online">Online Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {advancePaymentMethod === 'online' && (
                  <>
                    <div className="space-y-2">
                      <Label>Account Type *</Label>
                      <Select
                        value={advanceAccountType}
                        onValueChange={(value) => {
                          setAdvanceAccountType(value as 'company' | 'personal');
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
                        <div className="flex items-center justify-between">
                          <Label>Bank Account *</Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setAccountDialogType(advanceAccountType);
                              setAccountDialogOpen(true);
                            }}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Account
                          </Button>
                        </div>
                        <Select
                          value={advanceAccountId || ''}
                          onValueChange={setAdvanceAccountId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select bank account" />
                          </SelectTrigger>
                          <SelectContent>
                            {(advanceAccountType === 'company' ? companyAccounts : personalAccounts)
                              .filter(acc => acc.is_active)
                              .map(account => (
                                <SelectItem key={account.id} value={account.id}>
                                  {account.account_name}
                                  {account.account_number && ` - ${account.account_number}`}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </>
                )}
                
                <div className="space-y-2">
                  <Label>Collected By</Label>
                  <Input
                    value={advanceCollectedBy}
                    onChange={(e) => setAdvanceCollectedBy(e.target.value)}
                    placeholder="Enter name of person who collected"
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="threshold">Threshold Note (Optional)</Label>
              <Textarea
                id="threshold"
                value={thresholdNote}
                onChange={(e) => setThresholdNote(e.target.value)}
                placeholder="Add any threshold or policy notes"
                rows={3}
              />
            </div>
            
            {/* Amount Breakdown */}
            <div className="bg-muted/50 p-4 rounded-md space-y-3">
              <h4 className="font-semibold text-sm">Amount Breakdown</h4>
              {vehicles.map((vehicle, index) => {
                const totalKm = kmMethod === 'odometer' && startOdometer && endOdometer
                  ? parseFloat(endOdometer) - parseFloat(startOdometer)
                  : parseFloat(manualKm) || 0;
                const { breakdown } = calculateVehicleAmount(vehicle, totalKm, totalDays);
                
                return (
                  <div key={index} className="border-l-2 border-primary pl-3 space-y-1">
                    <p className="font-medium text-sm">{vehicle.vehicle_number || `Vehicle ${index + 1}`}</p>
                    {vehicle.rate_type === 'total' && (
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <p>Rate Type: Total Amount</p>
                        <p>Amount: ₹{breakdown.baseRate?.toLocaleString('en-IN') || '0'}</p>
                      </div>
                    )}
                    {vehicle.rate_type === 'per_day' && (
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <p>Rate Type: Per Day</p>
                        <p>Rate: ₹{breakdown.baseRate?.toLocaleString('en-IN') || '0'}/day</p>
                        <p>Days: {breakdown.days || totalDays} days</p>
                        <p>Calculation: ₹{breakdown.baseRate?.toLocaleString('en-IN') || '0'} × {breakdown.days || totalDays} = ₹{vehicle.final_amount.toLocaleString('en-IN')}</p>
                      </div>
                    )}
                    {vehicle.rate_type === 'per_km' && (
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <p>Rate Type: Per KM</p>
                        <p>Rate: ₹{breakdown.baseRate?.toLocaleString('en-IN') || '0'}/km</p>
                        <p>Trip Duration: {breakdown.days || totalDays} days</p>
                        <p>Threshold: {breakdown.thresholdKm || 100} km/day × {breakdown.days || totalDays} days = {breakdown.totalThresholdKm || (100 * totalDays)} km minimum</p>
                        <p>Actual KM: {breakdown.actualKm || totalKm} km</p>
                        {breakdown.actualKm && breakdown.totalThresholdKm && breakdown.actualKm < breakdown.totalThresholdKm && (
                          <p className="text-warning font-medium">⚠ Threshold Applied: Charging for {breakdown.kmCharged} km (minimum)</p>
                        )}
                        <p>Calculation: ₹{breakdown.baseRate?.toLocaleString('en-IN') || '0'} × {breakdown.kmCharged || totalKm} km = ₹{vehicle.final_amount.toLocaleString('en-IN')}</p>
                      </div>
                    )}
                    {vehicle.rate_type === 'hybrid' && (
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <p>Rate Type: Hybrid (Per Day + Per KM)</p>
                        <p>Per Day Rate: ₹{breakdown.baseRatePerDay?.toLocaleString('en-IN') || '0'}/day</p>
                        <p>Per KM Rate: ₹{breakdown.kmRate?.toLocaleString('en-IN') || '0'}/km</p>
                        <p>Trip Duration: {breakdown.days || totalDays} days</p>
                        <p>Threshold: {breakdown.thresholdKm || 100} km/day × {breakdown.days || totalDays} days = {breakdown.totalThresholdKm || (100 * totalDays)} km minimum</p>
                        <p>Actual KM: {breakdown.actualKm || totalKm} km</p>
                        {breakdown.actualKm && breakdown.totalThresholdKm && breakdown.actualKm < breakdown.totalThresholdKm && (
                          <p className="text-warning font-medium">⚠ Threshold Applied: Charging for {breakdown.kmCharged} km (minimum)</p>
                        )}
                        <p>Base Amount: ₹{breakdown.baseRatePerDay?.toLocaleString('en-IN') || '0'} × {breakdown.days || totalDays} = ₹{breakdown.baseAmount?.toLocaleString('en-IN') || '0'}</p>
                        <p>KM Amount: ₹{breakdown.kmRate?.toLocaleString('en-IN') || '0'} × {breakdown.kmCharged || totalKm} = ₹{breakdown.kmAmount?.toLocaleString('en-IN') || '0'}</p>
                        <p className="font-medium">Total: ₹{vehicle.final_amount.toLocaleString('en-IN')}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            <div className="bg-muted p-4 rounded-md space-y-2">
              <div className="flex justify-between">
                <span>Total Amount:</span>
                <span className="font-semibold">₹{totalAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span>Advance:</span>
                <span className="text-success">- ₹{advance.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t">
                <span>Balance:</span>
                <span className="text-primary">₹{balance.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {Object.keys(errors).length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please fix the errors above before submitting.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={() => {
              // Validate advance payment
              if (advance > 0 && !advancePaymentMethod) {
                setErrors({ advance: 'Payment method is required when advance amount is entered' });
                return;
              }
              if (advancePaymentMethod === 'online' && (!advanceAccountType || !advanceAccountId)) {
                setErrors({ advance: 'Bank account is required for online payments' });
                return;
              }
              createBill.mutate();
            }} 
            disabled={createBill.isPending}
          >
            {createBill.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Creating...
              </>
            ) : (
              <>
                <Calculator className="h-4 w-4 mr-2" />
                Create Bill
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
