import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useGenerateBill, useBillsByBooking } from '@/hooks/use-bills';
import { useBooking } from '@/hooks/use-bookings';
import { useCars } from '@/hooks/use-cars';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, AlertCircle, Calculator, Calendar } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RATE_TYPE_LABELS } from '@/types/booking';
import type { RateType } from '@/types/booking';
import { toLocalDateInputValue } from '@/lib/date';
import { TransferDialog } from './TransferDialog';

interface GenerateBillDialogProps {
  bookingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function GenerateBillDialog({
  bookingId,
  open,
  onOpenChange,
  onSuccess,
}: GenerateBillDialogProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: booking } = useBooking(bookingId);
  const { data: cars } = useCars();
  const { data: existingBills } = useBillsByBooking(bookingId);
  const generateBill = useGenerateBill();

  const [kmMethod, setKmMethod] = useState<'odometer' | 'manual'>('odometer');
  const [startOdometer, setStartOdometer] = useState<string>('');
  const [endOdometer, setEndOdometer] = useState<string>('');
  const [manualKm, setManualKm] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [billGenerationResult, setBillGenerationResult] = useState<any>(null);
  
  // Determine rate type from booking
  const rateType: RateType | null = booking?.booking_requested_vehicles?.[0]?.rate_type || 
                                     booking?.booking_vehicles?.[0]?.rate_type || 
                                     null;
  
  // Calculate days from dates
  const calculateDays = (start: string, end: string): number => {
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = endDate.getTime() - startDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 1;
  };
  
  const totalDays = calculateDays(startDate, endDate);

  // Load odometer readings and dates from booking if available
  useEffect(() => {
    if (booking) {
      // Load odometer readings
      if (booking.start_odometer_reading) {
        setStartOdometer(booking.start_odometer_reading.toString());
      }
      if (booking.end_odometer_reading) {
        setEndOdometer(booking.end_odometer_reading.toString());
      }
      
      // Load dates (auto-fill but editable)
      if (booking.start_at) {
        const start = new Date(booking.start_at);
        setStartDate(toLocalDateInputValue(start));
      }
      if (booking.end_at) {
        const end = new Date(booking.end_at);
        setEndDate(toLocalDateInputValue(end));
      }
    }
  }, [booking]);

  // Get latest odometer readings for assigned vehicles
  useEffect(() => {
    if (booking && booking.booking_vehicles && cars && kmMethod === 'odometer') {
      const fetchOdometerReadings = async () => {
        const { supabase } = await import('@/integrations/supabase/client');
        
        for (const vehicle of booking.booking_vehicles || []) {
          if (vehicle.car_id) {
            // Get latest odometer reading for this car
            const { data: odometerData } = await supabase
              .from('odometer_entries')
              .select('odometer_km')
              .eq('car_id', vehicle.car_id)
              .order('reading_at', { ascending: false })
              .limit(1)
              .single();

            if (odometerData && !startOdometer) {
              setStartOdometer(odometerData.odometer_km.toString());
            }
          }
        }
      };

      fetchOdometerReadings();
    }
  }, [booking, cars, kmMethod, startOdometer]);

  const handleSubmit = async () => {
    setErrors({});

    if (!booking) {
      setErrors({ general: 'Booking not found' });
      return;
    }

    // Validate dates for per_day or hybrid bookings
    if (rateType === 'per_day' || rateType === 'hybrid') {
      if (!startDate || !endDate) {
        setErrors({ dates: 'Both start and end dates are required' });
        return;
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        setErrors({ dates: 'Invalid date values' });
        return;
      }

      if (end <= start) {
        setErrors({ dates: 'End date must be after start date' });
        return;
      }
    }

    // Validate KM for per_km or hybrid bookings
    let totalKm = 0;
    if (rateType === 'per_km' || rateType === 'hybrid') {
      if (kmMethod === 'odometer') {
        if (!startOdometer || !endOdometer) {
          setErrors({ odometer: 'Both start and end odometer readings are required' });
          return;
        }

        const start = parseFloat(startOdometer);
        const end = parseFloat(endOdometer);

        if (isNaN(start) || isNaN(end)) {
          setErrors({ odometer: 'Invalid odometer readings' });
          return;
        }

        if (end <= start) {
          setErrors({ odometer: 'End reading must be greater than start reading' });
          return;
        }

        totalKm = end - start;
      } else {
        if (!manualKm) {
          setErrors({ manual: 'Total KM is required' });
          return;
        }

        const km = parseFloat(manualKm);
        if (isNaN(km) || km <= 0) {
          setErrors({ manual: 'Invalid KM value' });
          return;
        }

        totalKm = km;
      }
    }

    try {
      const result = await generateBill.mutateAsync({
        booking,
        startOdometer: (rateType === 'per_km' || rateType === 'hybrid') && kmMethod === 'odometer' ? parseFloat(startOdometer) : undefined,
        endOdometer: (rateType === 'per_km' || rateType === 'hybrid') && kmMethod === 'odometer' ? parseFloat(endOdometer) : undefined,
        manualKm: (rateType === 'per_km' || rateType === 'hybrid') && kmMethod === 'manual' ? parseFloat(manualKm) : undefined,
        kmMethod: (rateType === 'per_km' || rateType === 'hybrid') ? kmMethod : 'manual',
        startDate: (rateType === 'per_day' || rateType === 'hybrid') ? startDate : undefined,
        endDate: (rateType === 'per_day' || rateType === 'hybrid') ? endDate : undefined,
      });

      // Store result and show transfer dialog if needed
      setBillGenerationResult(result);
      onOpenChange(false);
      
      // Invalidate queries to refresh bill list
      queryClient.invalidateQueries({ queryKey: ['bills', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      
      // Show transfer dialog if advance payment needs transfer
      if (result.advanceInfo && result.advanceInfo.amount > 0 && 
          (result.advanceInfo.payment_method === 'cash' || result.advanceInfo.account_type === 'personal')) {
        setTransferDialogOpen(true);
      } else {
        // No transfer needed, navigate to bill view and call onSuccess
        queryClient.invalidateQueries({ queryKey: ['company-bills', { bookingId }] });
        queryClient.invalidateQueries({ queryKey: ['company-bills'] });
        setTimeout(() => {
          navigate(`/bookings/${bookingId}/bills`);
        }, 500); // Small delay to ensure queries are invalidated
        onSuccess?.();
      }
    } catch (error) {
      // Error handled by mutation
    }
  };

  const hasExistingBills = existingBills && existingBills.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Generate Final Bill
          </DialogTitle>
          <DialogDescription>
            {rateType ? (
              <>Calculate and generate the final bill based on {RATE_TYPE_LABELS[rateType].toLowerCase()}</>
            ) : (
              'Calculate and generate the final bill'
            )}
          </DialogDescription>
        </DialogHeader>

        {hasExistingBills && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This booking already has {existingBills.length} bill(s). Generating a new bill will create an additional bill.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-6 py-4">
          {/* Rate Type Display */}
          {rateType && (
            <div className="border rounded-lg p-4 bg-muted/30">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Rate Type:</span>
                <span className="font-medium">{RATE_TYPE_LABELS[rateType]}</span>
              </div>
            </div>
          )}

          {/* Per Day Booking - Date Inputs */}
          {(rateType === 'per_day' || rateType === 'hybrid') && (
            <div className="space-y-4 border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Label className="text-base font-semibold">Trip Dates</Label>
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
              
              {errors.dates && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.dates}
                </p>
              )}
              
              {startDate && endDate && !errors.dates && totalDays > 0 && (
                <div className="bg-muted p-3 rounded-md">
                  <p className="text-sm font-medium">
                    Total Days: {totalDays} {totalDays === 1 ? 'day' : 'days'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Per KM Booking - KM Calculation Method */}
          {(rateType === 'per_km' || rateType === 'hybrid') && (
            <>
              <div className="space-y-3">
                <Label>KM Calculation Method *</Label>
                <RadioGroup value={kmMethod} onValueChange={(value) => setKmMethod(value as 'odometer' | 'manual')}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="odometer" id="odometer" />
                    <Label htmlFor="odometer" className="font-normal cursor-pointer">
                      Odometer Reading (End - Start)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="manual" id="manual" />
                    <Label htmlFor="manual" className="font-normal cursor-pointer">
                      Manual Entry
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Odometer Method */}
              {kmMethod === 'odometer' && (
                <div className="space-y-4 border rounded-lg p-4">
                  <div className="space-y-2">
                    <Label htmlFor="start-odometer">Start Odometer Reading (km) *</Label>
                    <Input
                      id="start-odometer"
                      type="number"
                      placeholder="e.g., 50000"
                      value={startOdometer}
                      onChange={(e) => setStartOdometer(e.target.value)}
                    />
                    {errors.odometer && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.odometer}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="end-odometer">End Odometer Reading (km) *</Label>
                    <Input
                      id="end-odometer"
                      type="number"
                      placeholder="e.g., 50500"
                      value={endOdometer}
                      onChange={(e) => setEndOdometer(e.target.value)}
                    />
                  </div>

                  {startOdometer && endOdometer && !errors.odometer && (
                    <div className="bg-muted p-3 rounded-md">
                      <p className="text-sm font-medium">
                        Total KM: {parseFloat(endOdometer) - parseFloat(startOdometer)} km
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Manual Method */}
              {kmMethod === 'manual' && (
                <div className="space-y-2 border rounded-lg p-4">
                  <Label htmlFor="manual-km">Total KM Driven *</Label>
                  <Input
                    id="manual-km"
                    type="number"
                    placeholder="e.g., 500"
                    value={manualKm}
                    onChange={(e) => setManualKm(e.target.value)}
                  />
                  {errors.manual && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.manual}
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {/* Total Amount Booking - Just confirmation */}
          {rateType === 'total' && (
            <div className="border rounded-lg p-4 bg-muted/30">
              <p className="text-sm text-muted-foreground">
                This booking uses a fixed total amount. The bill will be generated with the agreed total amount.
              </p>
            </div>
          )}

          {/* Booking Info Summary */}
          {booking && (
            <div className="border rounded-lg p-4 space-y-2 bg-muted/30">
              <h4 className="font-medium text-sm">Booking Summary</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Customer:</span>{' '}
                  <span className="font-medium">{booking.customer_name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Vehicles:</span>{' '}
                  <span className="font-medium">{booking.booking_vehicles?.length || 0}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Start:</span>{' '}
                  <span className="font-medium">
                    {new Date(booking.start_at).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">End:</span>{' '}
                  <span className="font-medium">
                    {new Date(booking.end_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {errors.general && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errors.general}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={generateBill.isPending}>
            {generateBill.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Generating...
              </>
            ) : (
              'Generate Bill'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Transfer Dialog */}
      {billGenerationResult && (
        <TransferDialog
          open={transferDialogOpen}
          onOpenChange={(open) => {
            setTransferDialogOpen(open);
            if (!open) {
              setBillGenerationResult(null);
              onSuccess?.();
            }
          }}
          bill={billGenerationResult.bill}
          advanceInfo={billGenerationResult.advanceInfo}
          vehicleDetails={billGenerationResult.vehicleDetails}
          totalAmount={billGenerationResult.totalAmount}
          totalDriverAllowance={billGenerationResult.totalDriverAllowance}
          totalAdvance={billGenerationResult.totalAdvance}
          days={billGenerationResult.days}
          totalKm={billGenerationResult.totalKm}
          billStartDate={billGenerationResult.billStartDate}
          billEndDate={billGenerationResult.billEndDate}
          booking={billGenerationResult.booking}
          onSuccess={() => {
            setTransferDialogOpen(false);
            setBillGenerationResult(null);
            // Invalidate queries to refresh bill list
            queryClient.invalidateQueries({ queryKey: ['bills', bookingId] });
            queryClient.invalidateQueries({ queryKey: ['bills'] });
            queryClient.invalidateQueries({ queryKey: ['company-bills', { bookingId }] });
            queryClient.invalidateQueries({ queryKey: ['company-bills'] });
            setTimeout(() => {
              navigate(`/bookings/${bookingId}/bills`);
            }, 500); // Small delay to ensure queries are invalidated
            onSuccess?.();
          }}
        />
      )}
    </Dialog>
  );
}
