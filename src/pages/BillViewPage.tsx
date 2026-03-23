import { useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { formatDateTimeFull, formatDateOnly } from '@/lib/date';
import { useLogoDisplayUrl } from '@/hooks/use-logo-display-url';
import { DEFAULT_ORG_LOGO_URL } from '@/lib/constants';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Loader2, FileText } from 'lucide-react';
import { useBill } from '@/hooks/use-bills';
import { useAuth } from '@/lib/auth-context';
import { formatCarLabel } from '@/lib/utils';
import { useOrganizationSettings } from '@/hooks/use-organization-settings';
import { RATE_TYPE_LABELS, type Bill } from '@/types/booking';

const BILL_STATUS_LABELS: Record<Bill['status'], { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-500' },
  sent: { label: 'Sent', color: 'bg-blue-500' },
  paid: { label: 'Paid', color: 'bg-green-500' },
};

export default function BillViewPage() {
  const navigate = useNavigate();
  const { billId } = useParams<{ billId: string }>();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') || 'customer';

  const { data: bill, isLoading } = useBill(billId);
  const { organization } = useAuth();
  const { data: orgSettings } = useOrganizationSettings();

  const companyName = organization?.company_name || organization?.name || 'Company';
  const logoDisplayUrl = useLogoDisplayUrl(organization?.logo_url);
  const logoUrl = logoDisplayUrl || DEFAULT_ORG_LOGO_URL;
  const qrPrefix = (orgSettings?.bill_number_prefix || 'PT').trim().toUpperCase().replace(/-/g, '') || 'PT';

  useEffect(() => {
    if (!bill || !billId) return;
    if (bill.booking_id) {
      navigate(`/app/bookings/${bill.booking_id}/bills?billId=${billId}&tab=${tabParam}`, { replace: true });
    }
  }, [bill, billId, tabParam, navigate]);

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '₹0';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  };

  if (isLoading || !billId) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="p-6 space-y-4">
        <Button variant="ghost" onClick={() => navigate('/app/billing')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Billing
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-4" />
            <p className="text-muted-foreground">Bill not found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (bill.booking_id) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-2 print:hidden">
        <Button variant="ghost" size="sm" onClick={() => navigate('/app/billing')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Billing
        </Button>
      </div>

      <div
        className="bill-a4 mx-auto bg-white rounded-lg shadow-lg overflow-hidden print:shadow-none print:rounded-none"
        data-bill-content="true"
      >
      <Card className="print:shadow-none print:border-none border-0 w-full h-full min-h-0">
        <CardContent className="p-4 sm:p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6 md:mb-8">
            <img src={logoUrl} alt={companyName} className="h-10 sm:h-12 md:h-14 w-auto object-contain" onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_ORG_LOGO_URL; }} />
            <div className="text-left sm:text-right min-w-0">
              <h3 className="text-lg sm:text-xl font-semibold">FINAL BILL</h3>
              <p className="text-base sm:text-lg font-mono mt-1 break-all">{bill.bill_number}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Generated: {formatDateOnly(bill.created_at)}</p>
              {bill.status === 'paid' && (
                <Badge className={`mt-2 ${BILL_STATUS_LABELS[bill.status].color}`}>{BILL_STATUS_LABELS[bill.status].label}</Badge>
              )}
            </div>
          </div>

          <Separator className="my-6" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-6 md:mb-8">
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground mb-3">TRIP DETAILS</h4>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Start:</span>{' '}
                  <span className="font-medium">{formatDateTimeFull(bill.start_at)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">End:</span>{' '}
                  <span className="font-medium">{formatDateTimeFull(bill.end_at)}</span>
                </div>
                {bill.pickup && (
                  <div>
                    <span className="text-muted-foreground">Pickup:</span>{' '}
                    <span className="font-medium">{bill.pickup}</span>
                  </div>
                )}
                {bill.dropoff && (
                  <div>
                    <span className="text-muted-foreground">Dropoff:</span>{' '}
                    <span className="font-medium">{bill.dropoff}</span>
                  </div>
                )}
                <div className="mt-4 pt-4 border-t">
                  <span className="text-muted-foreground">Total KM:</span>{' '}
                  <span className="font-semibold">{bill.total_km_driven?.toLocaleString() ?? 0} km</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground mb-3">BILLED TO</h4>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Customer Name:</span>
                  <p className="font-medium text-base">{bill.customer_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Phone:</span>
                  <p className="font-medium">{bill.customer_phone}</p>
                </div>
                <div className="mt-4 pt-4 border-t">
                  <p className="font-medium text-sm">{companyName}</p>
                  <p className="text-xs text-muted-foreground">For queries, please contact us</p>
                </div>
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          <div className="mb-8">
            <h4 className="font-semibold text-sm text-muted-foreground mb-4">VEHICLE & RATE DETAILS</h4>
            <div className="space-y-4">
              {(bill.vehicle_details || []).map((vehicle: any, idx: number) => (
                <div key={idx} className="border rounded-lg p-4 bg-muted/20">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{formatCarLabel(vehicle)}</p>
                      <p className="text-xs text-muted-foreground">{RATE_TYPE_LABELS[vehicle.rate_type]}</p>
                    </div>
                    <p className="font-semibold">{formatCurrency(vehicle.final_amount)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-8">
            <h4 className="font-semibold text-sm text-muted-foreground mb-4">PAYMENT SUMMARY</h4>
            <div className="bg-muted/30 rounded-lg p-6 space-y-3">
              {(() => {
                const toll = Number(bill.toll_charges) || 0;
                const parking = Number(bill.parking_charges) || 0;
                const vehicleSubtotal = bill.total_amount - toll - parking;
                return (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Subtotal (Vehicles):</span>
                      <span className="font-semibold">{formatCurrency(vehicleSubtotal)}</span>
                    </div>
                    {toll > 0 && (
                      <div className="flex justify-between items-center text-muted-foreground">
                        <span>Toll Tax:</span>
                        <span className="font-medium">+ {formatCurrency(toll)}</span>
                      </div>
                    )}
                    {parking > 0 && (
                      <div className="flex justify-between items-center text-muted-foreground">
                        <span>Parking Charges:</span>
                        <span className="font-medium">+ {formatCurrency(parking)}</span>
                      </div>
                    )}
                    {(toll > 0 || parking > 0) && (
                      <div className="flex justify-between items-center pt-1 border-t">
                        <span className="font-medium">Total:</span>
                        <span className="font-semibold">{formatCurrency(bill.total_amount)}</span>
                      </div>
                    )}
                  </>
                );
              })()}
              {(bill.total_driver_allowance ?? 0) > 0 && (
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Driver Allowance (paid to driver)</span>
                  <span className="font-semibold">- {formatCurrency(bill.total_driver_allowance)}</span>
                </div>
              )}
              {bill.advance_amount > 0 && (
                <div className="flex justify-between items-center text-success">
                  <span>Advance Paid:</span>
                  <span className="font-semibold">- {formatCurrency(bill.advance_amount)}</span>
                </div>
              )}
              <Separator className="my-3" />
              <div className="flex justify-between items-center pt-2">
                <span className="text-lg font-bold">Balance Due:</span>
                <span className="text-2xl font-bold text-primary">
                  {formatCurrency(bill.total_amount - (bill.total_driver_allowance ?? 0) - bill.advance_amount)}
                </span>
              </div>
            </div>
          </div>

          <Separator className="my-6" />
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground mb-2">PAYMENT QR CODE</h4>
              <p className="text-xs text-muted-foreground max-w-xs">Scan with any UPI app to pay.</p>
            </div>
            <div className="p-4 bg-white rounded-lg border">
              <QRCodeSVG
                value={`${qrPrefix}|BILL:${bill.bill_number}|AMOUNT:${bill.total_amount - (bill.total_driver_allowance ?? 0) - bill.advance_amount}|PHONE:${bill.customer_phone}`}
                size={100}
                level="M"
                includeMargin={false}
              />
            </div>
          </div>

          {orgSettings?.terms_and_conditions && (
            <>
              <Separator className="my-6" />
              <div className="text-xs text-muted-foreground space-y-2 mb-6">
                <h5 className="font-semibold text-sm mb-2">Terms & Conditions:</h5>
                <div className="whitespace-pre-wrap pl-2">{orgSettings.terms_and_conditions}</div>
              </div>
            </>
          )}

          <Separator className="my-6" />
          <div className="text-center space-y-2">
            <p className="font-medium">Thank you for choosing {companyName}!</p>
            <p className="text-xs text-muted-foreground">Generated on {formatDateTimeFull(bill.created_at)} (IST)</p>
            {bill.status === 'paid' && bill.paid_at && (
              <p className="text-xs text-success font-medium">Payment received on {formatDateTimeFull(bill.paid_at)} (IST)</p>
            )}
          </div>
        </CardContent>
      </Card>
      </div>

      <style>{`
        .bill-a4 {
          width: 297mm;
          min-height: 210mm;
          max-width: 100%;
          box-sizing: border-box;
        }
        @media print {
          @page { size: A4 landscape; margin: 0; }
          body * { visibility: hidden; }
          .print\\:hidden { display: none !important; }
          [data-bill-content], [data-bill-content] * { visibility: visible; }
          [data-bill-content] {
            position: absolute;
            left: 0;
            top: 0;
            width: 297mm !important;
            min-height: 210mm;
            max-width: none;
            box-shadow: none;
          }
        }
      `}</style>
    </div>
  );
}
