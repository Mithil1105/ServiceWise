import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useCreateTransfer } from '@/hooks/use-transfers';
import { useCreateCompanyBill } from '@/hooks/use-company-bills';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import type { Bill, VehicleBillDetail } from '@/types/booking';

const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: Bill;
  advanceInfo: {
    amount: number;
    payment_method: 'cash' | 'online' | null;
    account_type: 'company' | 'personal' | null;
    account_id: string | null;
    collected_by: string | null;
  };
  vehicleDetails: VehicleBillDetail[];
  totalAmount: number;
  totalDriverAllowance: number;
  totalAdvance: number;
  days: number;
  totalKm: number;
  billStartDate: Date;
  billEndDate: Date;
  booking: any;
  onSuccess?: () => void;
}

export function TransferDialog({
  open,
  onOpenChange,
  bill,
  advanceInfo,
  vehicleDetails,
  totalAmount,
  totalDriverAllowance,
  totalAdvance,
  days,
  totalKm,
  billStartDate,
  billEndDate,
  booking,
  onSuccess,
}: TransferDialogProps) {
  const createTransfer = useCreateTransfer();
  const createCompanyBill = useCreateCompanyBill();
  const { user } = useAuth();

  const [transferStatus, setTransferStatus] = useState<'already-transferred' | 'will-transfer-later' | null>(null);
  const [transferDate, setTransferDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [cashierName, setCashierName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if advance needs transfer (personal or cash)
  const needsTransfer = advanceInfo.amount > 0 && 
    (advanceInfo.payment_method === 'cash' || advanceInfo.account_type === 'personal');

  const handleSubmit = async () => {
    if (!needsTransfer) {
      // No transfer needed, just create company bill
      await createCompanyBillDirectly();
      return;
    }

    if (!transferStatus) {
      return;
    }

    setIsSubmitting(true);
    try {
      let transferId: string | null = null;

      if (transferStatus === 'already-transferred') {
        // Create completed transfer
        const transfer = await createTransfer.mutateAsync({
          booking_id: bill.booking_id,
          bill_id: bill.id,
          amount: advanceInfo.amount,
          from_account_type: advanceInfo.payment_method === 'cash' ? 'cash' : 'personal',
          from_account_id: advanceInfo.account_id,
          collected_by_user_id: user?.id || '',
          collected_by_name: advanceInfo.collected_by || 'Unknown',
          status: 'completed',
          transfer_date: transferDate,
          cash_given_to_cashier: advanceInfo.payment_method === 'cash',
          cashier_name: advanceInfo.payment_method === 'cash' ? cashierName : null,
          notes: notes || null,
        });
        transferId = transfer.id;
      } else {
        // Create pending transfer
        const transfer = await createTransfer.mutateAsync({
          booking_id: bill.booking_id,
          bill_id: bill.id,
          amount: advanceInfo.amount,
          from_account_type: advanceInfo.payment_method === 'cash' ? 'cash' : 'personal',
          from_account_id: advanceInfo.account_id,
          collected_by_user_id: user?.id || '',
          collected_by_name: advanceInfo.collected_by || 'Unknown',
          status: 'pending',
          notes: notes || null,
        });
        transferId = transfer.id;
      }

      // Create company bill
      await createCompanyBillDirectly(transferId);
    } catch (error) {
      console.error('Error handling transfer:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const createCompanyBillDirectly = async (transferId?: string | null) => {
    // Get transfer requirements
    const transferRequirements = [];
    if (transferId) {
      const transfer = await supabase
        .from('transfers')
        .select('*')
        .eq('id', transferId)
        .single();
      
      if (transfer.data) {
        transferRequirements.push({
          transfer_id: transfer.data.id,
          amount: transfer.data.amount,
          from_account_type: transfer.data.from_account_type,
          from_account_name: transfer.data.from_account_id ? 
            (await getAccountName(transfer.data.from_account_id)) : null,
          collected_by_name: transfer.data.collected_by_name,
          status: transfer.data.status,
          transfer_date: transfer.data.transfer_date,
          cashier_name: transfer.data.cashier_name,
        });
      }
    }

    // Generate company bill number
    const year = new Date().getFullYear();
    const { data: lastBill } = await supabase
      .from('company_bills')
      .select('bill_number')
      .like('bill_number', `PT-CB-${year}-%`)
      .order('bill_number', { ascending: false })
      .limit(1)
      .single();
    
    let companyBillNumber = '';
    if (lastBill?.bill_number) {
      const lastNum = parseInt(lastBill.bill_number.split('-').pop() || '0');
      companyBillNumber = `PT-CB-${year}-${String(lastNum + 1).padStart(6, '0')}`;
    } else {
      companyBillNumber = `PT-CB-${year}-000001`;
    }

    // Create company bill
    await createCompanyBill.mutateAsync({
      booking_id: bill.booking_id,
      customer_bill_id: bill.id,
      bill_number: companyBillNumber,
      customer_name: bill.customer_name,
      customer_phone: bill.customer_phone,
      start_at: billStartDate.toISOString(),
      end_at: billEndDate.toISOString(),
      pickup: bill.pickup,
      dropoff: bill.dropoff,
      start_odometer_reading: bill.start_odometer_reading,
      end_odometer_reading: bill.end_odometer_reading,
      total_km_driven: totalKm,
      km_calculation_method: bill.km_calculation_method,
      vehicle_details: vehicleDetails,
      total_amount: totalAmount,
      total_driver_allowance: totalDriverAllowance,
      advance_amount: totalAdvance,
      advance_payment_method: advanceInfo.payment_method,
      advance_account_type: advanceInfo.account_type,
      advance_account_id: advanceInfo.account_id,
      advance_collected_by: advanceInfo.collected_by,
      transfer_requirements: transferRequirements,
      internal_notes: null,
      threshold_note: bill.threshold_note,
    });

    onSuccess?.();
    onOpenChange(false);
  };

  const getAccountName = async (accountId: string) => {
    const { data } = await supabase
      .from('bank_accounts')
      .select('account_name')
      .eq('id', accountId)
      .single();
    return data?.account_name || null;
  };

  useEffect(() => {
    if (open && !needsTransfer) {
      // No transfer needed, auto-create company bill
      createCompanyBillDirectly();
    }
  }, [open, needsTransfer]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Advance Payment Transfer</DialogTitle>
          <DialogDescription>
            Advance payment of {formatCurrency(advanceInfo.amount)} was received via{' '}
            {advanceInfo.payment_method === 'cash' ? 'cash' : 'personal account'}.
            {advanceInfo.collected_by && ` Collected by: ${advanceInfo.collected_by}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This advance payment needs to be transferred to the company account.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <Label>Has the advance payment been transferred to company account? *</Label>
            <RadioGroup
              value={transferStatus || ''}
              onValueChange={(value) => setTransferStatus(value as 'already-transferred' | 'will-transfer-later')}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="already-transferred" id="transferred" />
                <Label htmlFor="transferred" className="font-normal cursor-pointer">
                  Yes, already transferred
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="will-transfer-later" id="later" />
                <Label htmlFor="later" className="font-normal cursor-pointer">
                  Will transfer later
                </Label>
              </div>
            </RadioGroup>
          </div>

          {transferStatus === 'already-transferred' && (
            <div className="space-y-4 border rounded-lg p-4">
              <div className="space-y-2">
                <Label>Transfer Date *</Label>
                <Input
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>

              {advanceInfo.payment_method === 'cash' && (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="cash-given"
                      checked={true}
                      disabled
                    />
                    <Label htmlFor="cash-given" className="font-normal">
                      Cash given to cashier
                    </Label>
                  </div>
                  <div className="space-y-2">
                    <Label>Cashier Name *</Label>
                    <Input
                      value={cashierName}
                      onChange={(e) => setCashierName(e.target.value)}
                      placeholder="Enter cashier name"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional notes..."
                />
              </div>
            </div>
          )}

          {transferStatus === 'will-transfer-later' && (
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes..."
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !transferStatus || (transferStatus === 'already-transferred' && advanceInfo.payment_method === 'cash' && !cashierName)}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              'Continue & Generate Company Bill'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
