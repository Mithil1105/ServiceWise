import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Bill, VehicleBillDetail, BookingWithDetails, BookingRequestedVehicle, BookingVehicle } from '@/types/booking';
import { useSystemConfig } from './use-dashboard';
import { isoAtNoonUtcFromDateInput } from '@/lib/date';
import { useAuth } from '@/lib/auth-context';

/**
 * Get all bills (for billing management page)
 */
export function useAllBills() {
  return useQuery({
    queryKey: ['bills', 'all'],
    queryFn: async () => {
      // Fetch bills separately to avoid nested query issues
      const { data: billsData, error: billsError } = await supabase
        .from('bills')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (billsError) throw billsError;
      if (!billsData || billsData.length === 0) return [];

      // Fetch booking details separately
      const bookingIds = [...new Set(billsData.map(b => b.booking_id))];
      const { data: bookingsData } = await supabase
        .from('bookings')
        .select('id, booking_ref, customer_name, customer_phone, status')
        .in('id', bookingIds);

      const bookingsMap = new Map(
        (bookingsData || []).map(b => [b.id, b])
      );

      return billsData.map(bill => ({
        ...bill,
        bookings: bookingsMap.get(bill.booking_id) || {
          booking_ref: 'N/A',
          customer_name: bill.customer_name,
          customer_phone: bill.customer_phone,
          status: 'unknown'
        }
      })) as (Bill & { bookings: { booking_ref: string; customer_name: string; customer_phone: string; status: string } })[];
    },
  });
}

/**
 * Get bills for a booking
 */
export function useBillsByBooking(bookingId: string | undefined) {
  return useQuery({
    queryKey: ['bills', bookingId],
    queryFn: async () => {
      if (!bookingId) return [];
      
      const { data, error } = await supabase
        .from('bills')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as Bill[];
    },
    enabled: !!bookingId,
  });
}

/**
 * Get a single bill by ID
 */
export function useBill(billId: string | undefined) {
  return useQuery({
    queryKey: ['bill', billId],
    queryFn: async () => {
      if (!billId) return null;
      
      const { data, error } = await supabase
        .from('bills')
        .select('*')
        .eq('id', billId)
        .single();
      
      if (error) throw error;
      return data as Bill;
    },
    enabled: !!billId,
  });
}

/**
 * Calculate final bill amount based on actual KM and requested vehicle pricing
 */
function calculateVehicleBillAmount(
  requestedVehicle: BookingRequestedVehicle,
  actualKm: number,
  days: number,
  minKmPerKm?: number | null,
  minKmHybridPerDay?: number | null
): { finalAmount: number; thresholdNote: string | null } {
  let finalAmount = 0;
  let thresholdNote: string | null = null;

  switch (requestedVehicle.rate_type) {
    case 'total':
      finalAmount = requestedVehicle.rate_total || 0;
      break;

    case 'per_day':
      finalAmount = (requestedVehicle.rate_per_day || 0) * days;
      break;

    case 'per_km':
      // Threshold: days × threshold_km_per_day (threshold is per day, multiply by trip days)
      // Default to 300 km/day if not configured (as per user requirement)
      const thresholdKmPerDay = minKmPerKm ? Number(minKmPerKm) : 300; // Default 300 km/day
      const totalMinKm = thresholdKmPerDay * days; // Total minimum KM for the trip = threshold per day × number of days
      const kmToCharge = Math.max(actualKm, totalMinKm);
      finalAmount = (requestedVehicle.rate_per_km || 0) * kmToCharge;
      
      if (actualKm < totalMinKm) {
        thresholdNote = `Minimum KM threshold applied: ${thresholdKmPerDay} km/day × ${days} days = ${totalMinKm} km (Company Policy). Actual KM: ${actualKm} km.`;
      }
      break;

    case 'hybrid':
      // Default to 300 km/day if not configured (as per user requirement)
      const minKmHybridPerDayValue = minKmHybridPerDay ? Number(minKmHybridPerDay) : 300;
      const totalMinKmHybrid = minKmHybridPerDayValue * days;
      const kmToChargeHybrid = Math.max(actualKm, totalMinKmHybrid);
      
      const baseAmount = (requestedVehicle.rate_per_day || 0) * days;
      const kmAmount = (requestedVehicle.rate_per_km || 0) * kmToChargeHybrid;
      finalAmount = baseAmount + kmAmount;
      
      if (actualKm < totalMinKmHybrid) {
        thresholdNote = `Minimum KM threshold applied: ${minKmHybridPerDayValue} km/day × ${days} days = ${totalMinKmHybrid} km (Company Policy). Actual KM: ${actualKm} km.`;
      }
      break;
  }

  return { finalAmount, thresholdNote };
}

/**
 * Generate bill for a booking
 */
export function useGenerateBill() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { data: minKmPerKm } = useSystemConfig('minimum_km_per_km');
  const { data: minKmHybridPerDay } = useSystemConfig('minimum_km_hybrid_per_day');

  return useMutation({
    mutationFn: async ({
      booking,
      startOdometer,
      endOdometer,
      manualKm,
      kmMethod,
      startDate,
      endDate,
    }: {
      booking: BookingWithDetails;
      startOdometer?: number;
      endOdometer?: number;
      manualKm?: number;
      kmMethod: 'odometer' | 'manual';
      startDate?: string;
      endDate?: string;
    }) => {
      const orgId = profile?.organization_id;
      if (!orgId) throw new Error('Organization not found');
      const { data: { user } } = await supabase.auth.getUser();
      
      // Use provided dates or fall back to booking dates
      const billStartDate = startDate ? new Date(isoAtNoonUtcFromDateInput(startDate)) : new Date(booking.start_at);
      const billEndDate = endDate ? new Date(isoAtNoonUtcFromDateInput(endDate)) : new Date(booking.end_at);
      
      // Calculate days from the dates used for billing
      const days = Math.ceil((billEndDate.getTime() - billStartDate.getTime()) / (1000 * 60 * 60 * 24)) || 1;
      
      // Calculate total KM (only needed for per_km or hybrid bookings)
      let totalKm = 0;
      const rateType = booking.booking_requested_vehicles?.[0]?.rate_type || booking.booking_vehicles?.[0]?.rate_type;
      
      if (rateType === 'per_km' || rateType === 'hybrid') {
        if (kmMethod === 'odometer' && startOdometer !== undefined && endOdometer !== undefined) {
          totalKm = endOdometer - startOdometer;
          if (totalKm < 0) {
            throw new Error('End odometer reading must be greater than start reading');
          }
        } else if (kmMethod === 'manual' && manualKm !== undefined) {
          totalKm = manualKm;
        } else {
          throw new Error('Invalid KM calculation method or missing values');
        }
      }

      // Get requested vehicles and assigned vehicles
      const requestedVehicles = booking.booking_requested_vehicles || [];
      const assignedVehicles = booking.booking_vehicles || [];

      // Calculate bill for each vehicle
      const vehicleDetails: VehicleBillDetail[] = [];
      let totalAmount = 0;
      let totalDriverAllowance = 0;
      let totalAdvance = 0;
      let combinedThresholdNote: string | null = null;

      // If there are assigned vehicles, use them (preferred)
      if (assignedVehicles.length > 0) {
        for (const assignedVehicle of assignedVehicles) {
          // Find linked requested vehicle
          let requestedVehicle = requestedVehicles.find(
            rv => rv.id === assignedVehicle.requested_vehicle_id
          );

          // If no requested vehicle linked, try to use assigned vehicle's own rates
          if (!requestedVehicle) {
            // Use assigned vehicle rates directly if available
            if (assignedVehicle.rate_type && (assignedVehicle.rate_total || assignedVehicle.rate_per_day || assignedVehicle.rate_per_km)) {
              // Create a temporary requested vehicle object from assigned vehicle data
              requestedVehicle = {
                id: null,
                rate_type: assignedVehicle.rate_type,
                rate_total: assignedVehicle.rate_total || null,
                rate_per_day: assignedVehicle.rate_per_day || null,
                rate_per_km: assignedVehicle.rate_per_km || null,
                driver_allowance_per_day: null,
              } as any;
            } else {
              // Skip if no rates available
              continue;
            }
          }

          // Get vehicle info
          const vehicleNumber = assignedVehicle.car?.vehicle_number || 'N/A';

          // Calculate final amount using requested vehicle pricing
          const { finalAmount, thresholdNote } = calculateVehicleBillAmount(
            requestedVehicle,
            totalKm,
            days,
            minKmPerKm,
            minKmHybridPerDay
          );

          // Build rate breakdown
          const rateBreakdown: VehicleBillDetail['rate_breakdown'] = {
            final_amount: finalAmount,
          };

          if (requestedVehicle.rate_type === 'total') {
            rateBreakdown.rate_total = requestedVehicle.rate_total || 0;
          } else if (requestedVehicle.rate_type === 'per_day') {
            rateBreakdown.rate_per_day = requestedVehicle.rate_per_day || 0;
            rateBreakdown.days = days;
            rateBreakdown.base_amount = finalAmount;
          } else if (requestedVehicle.rate_type === 'per_km') {
            rateBreakdown.rate_per_km = requestedVehicle.rate_per_km || 0;
            // Store the KM that was actually charged (after threshold)
            const thresholdKmPerDay = minKmPerKm ? Number(minKmPerKm) : 300;
            const totalMinKm = thresholdKmPerDay * days;
            const kmCharged = Math.max(totalKm, totalMinKm);
            rateBreakdown.km_driven = kmCharged;
            rateBreakdown.km_amount = finalAmount;
          } else if (requestedVehicle.rate_type === 'hybrid') {
            rateBreakdown.rate_per_day = requestedVehicle.rate_per_day || 0;
            rateBreakdown.rate_per_km = requestedVehicle.rate_per_km || 0;
            rateBreakdown.days = days;
            const minKmHybridPerDayValue = minKmHybridPerDay ? Number(minKmHybridPerDay) : 300;
            const totalMinKmHybrid = minKmHybridPerDayValue * days;
            const kmChargedHybrid = Math.max(totalKm, totalMinKmHybrid);
            rateBreakdown.km_driven = kmChargedHybrid;
            rateBreakdown.base_amount = (requestedVehicle.rate_per_day || 0) * days;
            rateBreakdown.km_amount = (requestedVehicle.rate_per_km || 0) * kmChargedHybrid;
          }

          // Calculate driver allowance for this vehicle
          const driverAllowancePerDay = requestedVehicle.driver_allowance_per_day || 0;
          const driverAllowanceTotal = driverAllowancePerDay * days;

          vehicleDetails.push({
            vehicle_number: vehicleNumber,
            driver_name: assignedVehicle.driver_name,
            driver_phone: assignedVehicle.driver_phone,
            rate_type: requestedVehicle.rate_type,
            rate_breakdown: rateBreakdown,
            final_amount: finalAmount,
            driver_allowance_per_day: driverAllowancePerDay,
            driver_allowance_total: driverAllowanceTotal,
          });

          totalAmount += finalAmount;
          totalDriverAllowance += driverAllowanceTotal;

          if (thresholdNote && !combinedThresholdNote) {
            combinedThresholdNote = thresholdNote;
          }
        }
      } else if (requestedVehicles.length > 0) {
        // If no assigned vehicles but there are requested vehicles, calculate based on requested vehicles
        for (const requestedVehicle of requestedVehicles) {
          // Calculate final amount using requested vehicle pricing
          const { finalAmount, thresholdNote } = calculateVehicleBillAmount(
            requestedVehicle,
            totalKm,
            days,
            minKmPerKm,
            minKmHybridPerDay
          );

          // Build rate breakdown
          const rateBreakdown: VehicleBillDetail['rate_breakdown'] = {
            final_amount: finalAmount,
          };

          if (requestedVehicle.rate_type === 'total') {
            rateBreakdown.rate_total = requestedVehicle.rate_total || 0;
          } else if (requestedVehicle.rate_type === 'per_day') {
            rateBreakdown.rate_per_day = requestedVehicle.rate_per_day || 0;
            rateBreakdown.days = days;
            rateBreakdown.base_amount = finalAmount;
          } else if (requestedVehicle.rate_type === 'per_km') {
            rateBreakdown.rate_per_km = requestedVehicle.rate_per_km || 0;
            const thresholdKmPerDay = minKmPerKm ? Number(minKmPerKm) : 300;
            const totalMinKm = thresholdKmPerDay * days;
            const kmCharged = Math.max(totalKm, totalMinKm);
            rateBreakdown.km_driven = kmCharged;
            rateBreakdown.km_amount = finalAmount;
          } else if (requestedVehicle.rate_type === 'hybrid') {
            rateBreakdown.rate_per_day = requestedVehicle.rate_per_day || 0;
            rateBreakdown.rate_per_km = requestedVehicle.rate_per_km || 0;
            rateBreakdown.days = days;
            const minKmHybridPerDayValue = minKmHybridPerDay ? Number(minKmHybridPerDay) : 300;
            const totalMinKmHybrid = minKmHybridPerDayValue * days;
            const kmChargedHybrid = Math.max(totalKm, totalMinKmHybrid);
            rateBreakdown.km_driven = kmChargedHybrid;
            rateBreakdown.base_amount = (requestedVehicle.rate_per_day || 0) * days;
            rateBreakdown.km_amount = (requestedVehicle.rate_per_km || 0) * kmChargedHybrid;
          }

          // Calculate driver allowance for this vehicle
          const driverAllowancePerDay = requestedVehicle.driver_allowance_per_day || 0;
          const driverAllowanceTotal = driverAllowancePerDay * days;

          vehicleDetails.push({
            vehicle_number: `${requestedVehicle.brand} ${requestedVehicle.model}`,
            driver_name: '',
            driver_phone: '',
            rate_type: requestedVehicle.rate_type,
            rate_breakdown: rateBreakdown,
            final_amount: finalAmount,
            driver_allowance_per_day: driverAllowancePerDay,
            driver_allowance_total: driverAllowanceTotal,
          });

          totalAmount += finalAmount;
          totalDriverAllowance += driverAllowanceTotal;

          if (thresholdNote && !combinedThresholdNote) {
            combinedThresholdNote = thresholdNote;
          }
        }
      }

      // Get advance from booking level first, fallback to first requested vehicle if booking level is 0
      // This provides backward compatibility for old bookings where advance was stored in requested_vehicles
      let bookingAdvance = booking.advance_amount || 0;
      
      // If booking-level advance is 0, check first requested vehicle (for backward compatibility)
      if (bookingAdvance === 0 && booking.booking_requested_vehicles && booking.booking_requested_vehicles.length > 0) {
        const firstRequestedVehicle = booking.booking_requested_vehicles[0];
        if (firstRequestedVehicle.advance_amount && Number(firstRequestedVehicle.advance_amount) > 0) {
          bookingAdvance = Number(firstRequestedVehicle.advance_amount);
        }
      }
      
      // Balance = total amount - advance (driver allowance is paid directly to driver, not included in balance)
      const balanceAmount = totalAmount - bookingAdvance;

      // Generate bill number
      const year = new Date().getFullYear();
      const { data: lastBill } = await supabase
        .from('bills')
        .select('bill_number')
        .like('bill_number', `PT-BILL-${year}-%`)
        .order('bill_number', { ascending: false })
        .limit(1)
        .single();
      
      let billNumber = '';
      if (lastBill?.bill_number) {
        const lastNum = parseInt(lastBill.bill_number.split('-').pop() || '0');
        billNumber = `PT-BILL-${year}-${String(lastNum + 1).padStart(6, '0')}`;
      } else {
        billNumber = `PT-BILL-${year}-000001`;
      }

      // Create bill record (as 'draft', but PDF won't show draft badge)
      const { data: bill, error: billError } = await supabase
        .from('bills')
        .insert({
          organization_id: orgId,
          booking_id: booking.id,
          bill_number: billNumber,
          status: 'draft',
          customer_name: booking.customer_name,
          customer_phone: booking.customer_phone,
          start_at: billStartDate.toISOString(),
          end_at: billEndDate.toISOString(),
          pickup: booking.pickup,
          dropoff: booking.dropoff,
          start_odometer_reading: (rateType === 'per_km' || rateType === 'hybrid') && kmMethod === 'odometer' ? startOdometer : null,
          end_odometer_reading: (rateType === 'per_km' || rateType === 'hybrid') && kmMethod === 'odometer' ? endOdometer : null,
          total_km_driven: totalKm,
          km_calculation_method: (rateType === 'per_km' || rateType === 'hybrid') ? kmMethod : 'manual',
          vehicle_details: vehicleDetails,
          total_amount: totalAmount,
          total_driver_allowance: totalDriverAllowance,
          advance_amount: bookingAdvance,
          balance_amount: balanceAmount,
          threshold_note: combinedThresholdNote,
          created_by: user?.id,
        })
        .select()
        .single();

      if (billError) throw billError;

      // Update booking with odometer readings
      if (kmMethod === 'odometer') {
        await supabase
          .from('bookings')
          .update({
            start_odometer_reading: startOdometer,
            end_odometer_reading: endOdometer,
          })
          .eq('id', booking.id);
      }

      // Update booking_vehicles with final_km
      for (const assignedVehicle of assignedVehicles) {
        await supabase
          .from('booking_vehicles')
          .update({ final_km: totalKm })
          .eq('id', assignedVehicle.id);
      }

      // Update booking status to 'completed' if not already
      if (booking.status !== 'completed') {
        await supabase
          .from('bookings')
          .update({ status: 'completed' })
          .eq('id', booking.id);
      }

      // Get advance payment info from booking level
      const advanceInfo = bookingAdvance > 0 ? {
        amount: bookingAdvance,
        payment_method: booking.advance_payment_method,
        account_type: booking.advance_account_type,
        account_id: booking.advance_account_id,
        collected_by: booking.advance_collected_by,
      } : null;

      // Automatically create company bill
      try {
        // Generate company bill number
        const year = new Date().getFullYear();
        const { data: lastCompanyBill } = await supabase
          .from('company_bills')
          .select('bill_number')
          .like('bill_number', `PT-CB-${year}-%`)
          .order('bill_number', { ascending: false })
          .limit(1)
          .single();
        
        let companyBillNumber = '';
        if (lastCompanyBill?.bill_number) {
          const lastNum = parseInt(lastCompanyBill.bill_number.split('-').pop() || '0');
          companyBillNumber = `PT-CB-${year}-${String(lastNum + 1).padStart(6, '0')}`;
        } else {
          companyBillNumber = `PT-CB-${year}-000001`;
        }

        // Determine transfer requirements
        const transferRequirements: any[] = [];
        if (advanceInfo && advanceInfo.amount > 0 && 
            (advanceInfo.payment_method === 'cash' || advanceInfo.account_type === 'personal')) {
          // Advance needs transfer - create pending transfer requirement
          transferRequirements.push({
            amount: advanceInfo.amount,
            from_account_type: advanceInfo.payment_method === 'cash' ? 'cash' : 'personal',
            from_account_id: advanceInfo.account_id,
            collected_by_name: advanceInfo.collected_by || 'Unknown',
            status: 'pending',
            notes: 'Auto-created with bill generation',
          });
        }

        // Create company bill
        const { data: companyBill, error: companyBillError } = await supabase
          .from('company_bills')
          .insert({
            organization_id: orgId,
            booking_id: booking.id,
            customer_bill_id: bill.id,
            bill_number: companyBillNumber,
            customer_name: booking.customer_name,
            customer_phone: booking.customer_phone,
            start_at: billStartDate.toISOString(),
            end_at: billEndDate.toISOString(),
            pickup: booking.pickup,
            dropoff: booking.dropoff,
            start_odometer_reading: (rateType === 'per_km' || rateType === 'hybrid') && kmMethod === 'odometer' ? startOdometer : null,
            end_odometer_reading: (rateType === 'per_km' || rateType === 'hybrid') && kmMethod === 'odometer' ? endOdometer : null,
            total_km_driven: totalKm,
            km_calculation_method: (rateType === 'per_km' || rateType === 'hybrid') ? kmMethod : 'manual',
            vehicle_details: vehicleDetails,
            total_amount: totalAmount,
            total_driver_allowance: totalDriverAllowance,
            advance_amount: bookingAdvance,
            advance_payment_method: booking.advance_payment_method,
            advance_account_type: booking.advance_account_type,
            advance_account_id: booking.advance_account_id,
            advance_collected_by: booking.advance_collected_by,
            transfer_requirements: transferRequirements,
            internal_notes: null,
            threshold_note: combinedThresholdNote,
            created_by: user?.id,
          })
          .select()
          .single();

        if (companyBillError) {
          console.error('Error creating company bill:', companyBillError);
          // Don't throw error - customer bill is already created, just log it
          toast.warning('Customer bill created, but company bill creation failed. Please create manually.');
        }
      } catch (error) {
        console.error('Error creating company bill:', error);
        // Don't throw error - customer bill is already created
        toast.warning('Customer bill created, but company bill creation failed. Please create manually.');
      }

      return {
        bill: bill as Bill,
        advanceInfo,
        vehicleDetails,
        totalAmount,
        totalDriverAllowance,
        totalAdvance: bookingAdvance,
        days,
        totalKm,
        billStartDate,
        billEndDate,
        booking,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['bills', result.bill.booking_id] });
      queryClient.invalidateQueries({ queryKey: ['company-bills', { bookingId: result.bill.booking_id }] });
      queryClient.invalidateQueries({ queryKey: ['booking', result.bill.booking_id] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast.success('Bill and company bill generated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to generate bill: ${error.message}`);
    },
  });
}

/**
 * Update bill status
 */
export function useUpdateBillStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      billId,
      status,
    }: {
      billId: string;
      status: 'draft' | 'sent' | 'paid';
    }) => {
      const updateData: any = { status };
      
      if (status === 'sent') {
        updateData.sent_at = new Date().toISOString();
      } else if (status === 'paid') {
        updateData.paid_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('bills')
        .update(updateData)
        .eq('id', billId)
        .select()
        .single();

      if (error) throw error;
      return data as Bill;
    },
    onSuccess: (bill) => {
      queryClient.invalidateQueries({ queryKey: ['bills', bill.booking_id] });
      queryClient.invalidateQueries({ queryKey: ['bill', bill.id] });
      toast.success(`Bill marked as ${bill.status}`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update bill status: ${error.message}`);
    },
  });
}

/**
 * Upload PDF to storage and update bill
 */
export function useUploadBillPDF() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      billId,
      pdfFile,
    }: {
      billId: string;
      pdfFile: File;
    }) => {
      const fileName = `${billId}/${Date.now()}-bill.pdf`;

      const { error: uploadError } = await supabase.storage
        .from('bills')
        .upload(fileName, pdfFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data, error } = await supabase
        .from('bills')
        .update({
          pdf_file_path: fileName,
          pdf_file_name: pdfFile.name,
        })
        .eq('id', billId)
        .select()
        .single();

      if (error) throw error;
      return data as Bill;
    },
    onSuccess: (bill) => {
      queryClient.invalidateQueries({ queryKey: ['bills', bill.booking_id] });
      queryClient.invalidateQueries({ queryKey: ['bill', bill.id] });
      toast.success('PDF uploaded successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to upload PDF: ${error.message}`);
    },
  });
}

/**
 * Get signed URL for bill PDF
 */
export function useBillPDFUrl(billId: string | undefined, filePath: string | null) {
  return useQuery({
    queryKey: ['bill-pdf-url', billId, filePath],
    queryFn: async () => {
      if (!billId || !filePath) return null;
      
      const { data, error } = await supabase.storage
        .from('bills')
        .createSignedUrl(filePath, 3600);

      if (error) throw error;
      return data.signedUrl;
    },
    enabled: !!billId && !!filePath,
  });
}

/**
 * Get bills that need payment reminders (billed 2-3 days ago, not paid)
 */
export function useBillsNeedingReminder() {
  return useQuery({
    queryKey: ['bills-needing-reminder'],
    queryFn: async () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const { data, error } = await supabase
        .from('bills')
        .select('*, bookings!inner(booking_ref, customer_name, customer_phone)')
        .eq('status', 'sent')
        .gte('sent_at', threeDaysAgo.toISOString())
        .lte('sent_at', twoDaysAgo.toISOString())
        .is('payment_reminder_sent_at', null);

      if (error) throw error;
      return (data || []) as (Bill & { bookings: { booking_ref: string; customer_name: string; customer_phone: string } })[];
    },
  });
}

/**
 * Mark payment reminder as sent
 */
export function useMarkReminderSent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (billId: string) => {
      const { error } = await supabase
        .from('bills')
        .update({ payment_reminder_sent_at: new Date().toISOString() })
        .eq('id', billId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills-needing-reminder'] });
    },
  });
}
