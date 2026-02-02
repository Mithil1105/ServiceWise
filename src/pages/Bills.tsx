import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { formatDateTimeFull } from '@/lib/date';
import { QRCodeSVG } from 'qrcode.react';
import { useBankAccounts } from '@/hooks/use-bank-accounts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  Download, 
  Loader2, 
  FileText, 
  Printer, 
  Share2, 
  MessageCircle, 
  Mail,
  Calculator,
  CheckCircle2,
  Send,
  AlertCircle
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useBooking } from '@/hooks/use-bookings';
import { 
  useBillsByBooking, 
  useUpdateBillStatus, 
  useBillPDFUrl, 
  useUploadBillPDF,
  useBillsNeedingReminder,
  useMarkReminderSent
} from '@/hooks/use-bills';
import { useCompanyBills } from '@/hooks/use-company-bills';
import { GenerateBillDialog } from '@/components/bookings/GenerateBillDialog';
import { BookingStatusBadge } from '@/components/bookings/BookingStatusBadge';
import { TRIP_TYPE_LABELS, RATE_TYPE_LABELS, type Bill } from '@/types/booking';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import patidarLogo from '@/assets/patidar-logo.jpg';

const BILL_STATUS_LABELS: Record<Bill['status'], { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-500' },
  sent: { label: 'Sent', color: 'bg-blue-500' },
  paid: { label: 'Paid', color: 'bg-green-500' },
};

export default function Bills() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const billRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { data: booking, isLoading: loadingBooking } = useBooking(id);
  const { data: bills, isLoading: loadingBills, refetch: refetchBills } = useBillsByBooking(id);
  const { data: companyBills } = useCompanyBills({ bookingId: id });
  const { data: allBankAccounts } = useBankAccounts();
  const { data: billsNeedingReminder } = useBillsNeedingReminder();
  const updateBillStatus = useUpdateBillStatus();
  const uploadPDF = useUploadBillPDF();
  const markReminderSent = useMarkReminderSent();

  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [generateBillOpen, setGenerateBillOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [billViewTab, setBillViewTab] = useState<'customer' | 'company'>('customer');

  const selectedBill = bills?.find(b => b.id === selectedBillId) || bills?.[0];
  // Find company bill that matches the selected customer bill
  const selectedCompanyBill = selectedBill 
    ? companyBills?.find(cb => cb.customer_bill_id === selectedBill.id)
    : null;
  
  // Check if there are any company bills for this booking
  const hasCompanyBills = companyBills && companyBills.length > 0;

  // Check if there are bills needing reminder for this booking
  const needsReminder = bills?.some(bill => 
    bill.status === 'sent' && 
    !bill.payment_reminder_sent_at &&
    bill.sent_at &&
    new Date(bill.sent_at) <= new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) &&
    new Date(bill.sent_at) >= new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
  );

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDateTime = (date: string) => {
    return formatDateTimeFull(date);
  };

  const handlePrint = () => {
    window.print();
  };

  const generatePdfBlob = async (bill: Bill): Promise<Blob | null> => {
    if (!billRef.current) return null;
    
    setGeneratingPdf(true);
    try {
      const canvas = await html2canvas(billRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      const blob = pdf.output('blob');
      
      // Upload to storage
      const file = new File([blob], `${bill.bill_number}.pdf`, { type: 'application/pdf' });
      await uploadPDF.mutateAsync({ billId: bill.id, pdfFile: file });
      
      return blob;
    } catch (error) {
      console.error('PDF generation error:', error);
      return null;
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!selectedBill) return;
    
    const blob = await generatePdfBlob(selectedBill);
    if (!blob) return;
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedBill.bill_number}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleShareWhatsApp = async () => {
    if (!selectedBill || !booking) return;
    
    const message = encodeURIComponent(
      `*PATIDAR TRAVELS - Final Bill*\n\n` +
      `📋 Bill: ${selectedBill.bill_number}\n` +
      `📋 Booking: ${booking.booking_ref}\n` +
      `👤 Customer: ${selectedBill.customer_name}\n` +
      `📞 Phone: ${selectedBill.customer_phone}\n\n` +
      `📅 Trip: ${format(new Date(selectedBill.start_at), 'dd MMM yyyy')} - ${format(new Date(selectedBill.end_at), 'dd MMM yyyy')}\n` +
      `🚗 Total KM: ${selectedBill.total_km_driven} km\n\n` +
      `💰 Total: ${formatCurrency(selectedBill.total_amount)}\n` +
      `✅ Advance: ${formatCurrency(selectedBill.advance_amount)}\n` +
      `📍 *Balance: ${formatCurrency(selectedBill.balance_amount)}*\n\n` +
      `Thank you for choosing Patidar Travels!`
    );
    
    const phone = selectedBill.customer_phone.replace(/\D/g, '');
    const whatsappPhone = phone.startsWith('91') ? phone : `91${phone}`;
    
    window.open(`https://wa.me/${whatsappPhone}?text=${message}`, '_blank');
    setShareOpen(false);
    
    // Mark as sent if draft
    if (selectedBill.status === 'draft') {
      await updateBillStatus.mutateAsync({ billId: selectedBill.id, status: 'sent' });
    }
  };

  const handleMarkAsPaid = async () => {
    if (!selectedBill) return;
    await updateBillStatus.mutateAsync({ billId: selectedBill.id, status: 'paid' });
  };

  const handleSendReminder = async () => {
    if (!selectedBill) return;
    await markReminderSent.mutateAsync(selectedBill.id);
    setReminderDialogOpen(false);
  };

  if (loadingBooking || loadingBills) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!id) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">Booking ID not provided</p>
        <Button variant="outline" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">Booking not found</p>
        <Button variant="outline" onClick={() => navigate('/app/bookings')}>Go to Bookings</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 print:hidden">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="page-title">Bills</h1>
          <p className="text-sm text-muted-foreground">{booking.booking_ref}</p>
        </div>
        <div className="flex gap-2">
          {['ongoing', 'completed'].includes(booking.status) && (
            <Button onClick={() => setGenerateBillOpen(true)}>
              <Calculator className="h-4 w-4 mr-2" />
              Generate Bill
            </Button>
          )}
        </div>
      </div>

      {/* Payment Reminder Alert */}
      {needsReminder && selectedBill && (
        <Alert className="print:hidden">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>This bill was sent 2-3 days ago and payment is still pending.</span>
            <Button size="sm" variant="outline" onClick={() => setReminderDialogOpen(true)}>
              Send Reminder
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Bills List */}
      {bills && bills.length > 0 && (
        <Card className="print:hidden">
          <CardHeader>
            <CardTitle>Bill History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {bills.map((bill) => (
                <div
                  key={bill.id}
                  className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedBillId === bill.id ? 'bg-primary/5 border-primary' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setSelectedBillId(bill.id)}
                >
                  <div className="flex items-center gap-3">
                    <Badge className={BILL_STATUS_LABELS[bill.status].color}>
                      {BILL_STATUS_LABELS[bill.status].label}
                    </Badge>
                    <div>
                      <p className="font-medium">{bill.bill_number}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(bill.created_at)} • {formatCurrency(bill.balance_amount)} due
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(bill.total_amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      Advance: {formatCurrency(bill.advance_amount)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bill Content with Tabs */}
      {selectedBill ? (
        <Tabs value={billViewTab} onValueChange={(v) => setBillViewTab(v as 'customer' | 'company')} className="space-y-4">
          <TabsList className="print:hidden">
            <TabsTrigger value="customer">Customer Bill</TabsTrigger>
            {hasCompanyBills && (
              <TabsTrigger value="company">
                Company Bill
                {!selectedCompanyBill && <span className="ml-1 text-xs opacity-70">(No match)</span>}
              </TabsTrigger>
            )}
          </TabsList>

          {/* Customer Bill Tab */}
          <TabsContent value="customer" className="space-y-0">
            <div className="flex gap-2 print:hidden">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button variant="outline" onClick={handleDownloadPdf} disabled={generatingPdf}>
              {generatingPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Download PDF
            </Button>
            <Popover open={shareOpen} onOpenChange={setShareOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2" align="end">
                <div className="space-y-1">
                  <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleShareWhatsApp}>
                    <MessageCircle className="h-4 w-4 mr-2 text-green-600" />
                    WhatsApp
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => window.print()}>
                    <Mail className="h-4 w-4 mr-2 text-blue-600" />
                    Email
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            {selectedBill.status === 'sent' && (
              <Button onClick={handleMarkAsPaid}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark as Paid
              </Button>
            )}
            {selectedBill.status === 'draft' && (
              <Button onClick={() => updateBillStatus.mutateAsync({ billId: selectedBill.id, status: 'sent' })}>
                <Send className="h-4 w-4 mr-2" />
                Mark as Sent
              </Button>
            )}
          </div>

          <Card className="print:shadow-none print:border-none" ref={billRef}>
            <CardContent className="p-8">
              {/* Bill Header */}
              <div className="flex justify-between items-start mb-8">
                <img src={patidarLogo} alt="Patidar Travels" className="h-14 w-auto object-contain" />
                <div className="text-right">
                  <h3 className="text-xl font-semibold">FINAL BILL</h3>
                  <p className="text-lg font-mono mt-1">{selectedBill.bill_number}</p>
                  <p className="text-sm text-muted-foreground">
                    Generated: {format(new Date(selectedBill.created_at), 'dd MMM yyyy')}
                  </p>
                  {/* Only show status badge if paid (draft/sent bills are final bills, don't show draft badge) */}
                  {selectedBill.status === 'paid' && (
                    <Badge className={`mt-2 ${BILL_STATUS_LABELS[selectedBill.status].color}`}>
                      {BILL_STATUS_LABELS[selectedBill.status].label}
                    </Badge>
                  )}
                </div>
              </div>

              <Separator className="my-6" />

              {/* Booking & Customer Info */}
              <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-3">BOOKING DETAILS</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Booking Reference:</span>{' '}
                      <span className="font-medium">{booking.booking_ref}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Trip Type:</span>{' '}
                      <span className="font-medium">{TRIP_TYPE_LABELS[booking.trip_type]} Trip</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Trip Duration:</span>{' '}
                      <span className="font-medium">
                        {(() => {
                          const start = new Date(selectedBill.start_at);
                          const end = new Date(selectedBill.end_at);
                          const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) || 1;
                          return `${days} ${days === 1 ? 'day' : 'days'}`;
                        })()}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Start Date & Time:</span>{' '}
                      <span className="font-medium">{formatDateTime(selectedBill.start_at)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">End Date & Time:</span>{' '}
                      <span className="font-medium">{formatDateTime(selectedBill.end_at)}</span>
                    </div>
                    {selectedBill.pickup && (
                      <div>
                        <span className="text-muted-foreground">Pickup Location:</span>{' '}
                        <span className="font-medium">{selectedBill.pickup}</span>
                      </div>
                    )}
                    {selectedBill.dropoff && (
                      <div>
                        <span className="text-muted-foreground">Dropoff Location:</span>{' '}
                        <span className="font-medium">{selectedBill.dropoff}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <h5 className="font-semibold text-xs text-muted-foreground mb-2">KM DETAILS</h5>
                    <div className="space-y-1 text-sm">
                      {selectedBill.start_odometer_reading && selectedBill.end_odometer_reading && (
                        <div>
                          <span className="text-muted-foreground">Odometer Reading:</span>{' '}
                          <span className="font-medium">
                            {selectedBill.start_odometer_reading.toLocaleString()} km → {selectedBill.end_odometer_reading.toLocaleString()} km
                          </span>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">Total Kilometers Driven:</span>{' '}
                        <span className="font-semibold text-base">{selectedBill.total_km_driven.toLocaleString()} km</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-3">BILLED TO</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Customer Name:</span>
                      <p className="font-medium text-base">{selectedBill.customer_name}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Phone Number:</span>
                      <p className="font-medium">{selectedBill.customer_phone}</p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <h5 className="font-semibold text-xs text-muted-foreground mb-2">COMPANY DETAILS</h5>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p className="font-medium text-sm">PATIDAR TRAVELS PVT. LTD.</p>
                      <p>For queries, please contact us</p>
                    </div>
                  </div>
                </div>
              </div>

              <Separator className="my-6" />

              {/* Vehicle Details Table */}
              <div className="mb-8">
                <h4 className="font-semibold text-sm text-muted-foreground mb-4">VEHICLE & RATE DETAILS</h4>
                <div className="space-y-6">
                  {selectedBill.vehicle_details.map((vehicle, idx) => {
                    const tripDays = (() => {
                      const start = new Date(selectedBill.start_at);
                      const end = new Date(selectedBill.end_at);
                      return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) || 1;
                    })();
                    
                    // Get car info from booking if available
                    const assignedVehicle = booking?.booking_vehicles?.find((bv: any) => 
                      bv.car?.vehicle_number === vehicle.vehicle_number
                    );
                    const carInfo = assignedVehicle?.car;
                    
                    return (
                      <div key={idx} className="border rounded-lg p-4 bg-muted/20">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Vehicle Number</p>
                            <p className="font-semibold text-base">{vehicle.vehicle_number}</p>
                            {(carInfo?.brand || carInfo?.model) && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {carInfo.brand && <span>{carInfo.brand}</span>}
                                {carInfo.brand && carInfo.model && ' '}
                                {carInfo.model && <span>{carInfo.model}</span>}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-2">
                              <span className="text-muted-foreground">Total KM Driven:</span>{' '}
                              <span className="font-semibold">{selectedBill.total_km_driven.toLocaleString()} km</span>
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Driver Details</p>
                            <p className="font-medium">{vehicle.driver_name || 'Not Assigned'}</p>
                            {vehicle.driver_phone && (
                              <p className="text-xs text-muted-foreground">{vehicle.driver_phone}</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="border-t pt-4">
                          <p className="text-xs text-muted-foreground mb-2">Rate Type</p>
                          <p className="font-semibold mb-3">{RATE_TYPE_LABELS[vehicle.rate_type]}</p>
                          
                          {/* Detailed Rate Breakdown */}
                          <div className="bg-white rounded-md p-3 space-y-2 text-sm">
                            {vehicle.rate_type === 'total' && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Fixed Amount:</span>
                                <span className="font-medium">{formatCurrency(vehicle.rate_breakdown.rate_total || 0)}</span>
                              </div>
                            )}
                            
                            {vehicle.rate_type === 'per_day' && (
                              <>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Rate Per Day:</span>
                                  <span className="font-medium">{formatCurrency(vehicle.rate_breakdown.rate_per_day || 0)}/day</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Number of Days:</span>
                                  <span className="font-medium">{vehicle.rate_breakdown.days || tripDays} days</span>
                                </div>
                                <div className="flex justify-between pt-2 border-t font-semibold">
                                  <span>Calculation:</span>
                                  <span>{formatCurrency(vehicle.rate_breakdown.rate_per_day || 0)} × {vehicle.rate_breakdown.days || tripDays} days</span>
                                </div>
                              </>
                            )}
                            
                            {vehicle.rate_type === 'per_km' && (
                              <>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Rate Per KM:</span>
                                  <span className="font-medium">{formatCurrency(vehicle.rate_breakdown.rate_per_km || 0)}/km</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Trip Duration:</span>
                                  <span className="font-medium">{tripDays} {tripDays === 1 ? 'day' : 'days'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Actual KM Driven:</span>
                                  <span className="font-medium">{selectedBill.total_km_driven.toLocaleString()} km</span>
                                </div>
                                {vehicle.rate_breakdown.km_driven && vehicle.rate_breakdown.km_driven !== selectedBill.total_km_driven && (
                                  <>
                                    <div className="flex justify-between text-warning">
                                      <span>KM Charged (Threshold Applied):</span>
                                      <span className="font-semibold">{vehicle.rate_breakdown.km_driven.toLocaleString()} km</span>
                                    </div>
                                    <div className="text-xs text-warning bg-warning/10 p-2 rounded">
                                      ⚠ Minimum threshold applied: {(() => {
                                        const thresholdPerDay = Math.ceil((vehicle.rate_breakdown.km_driven || 0) / tripDays);
                                        return `${thresholdPerDay} km/day × ${tripDays} days = ${vehicle.rate_breakdown.km_driven} km`;
                                      })()}
                                    </div>
                                  </>
                                )}
                                <div className="flex justify-between pt-2 border-t font-semibold">
                                  <span>Calculation:</span>
                                  <span>{formatCurrency(vehicle.rate_breakdown.rate_per_km || 0)} × {(vehicle.rate_breakdown.km_driven || selectedBill.total_km_driven).toLocaleString()} km</span>
                                </div>
                              </>
                            )}
                            
                            {vehicle.rate_type === 'hybrid' && (
                              <>
                                <div className="space-y-2">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Rate Per Day:</span>
                                    <span className="font-medium">{formatCurrency(vehicle.rate_breakdown.rate_per_day || 0)}/day</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Number of Days:</span>
                                    <span className="font-medium">{vehicle.rate_breakdown.days || tripDays} days</span>
                                  </div>
                                  <div className="flex justify-between pt-1 border-t">
                                    <span className="text-muted-foreground">Base Amount (Per Day):</span>
                                    <span className="font-medium">{formatCurrency(vehicle.rate_breakdown.base_amount || 0)}</span>
                                  </div>
                                </div>
                                
                                <div className="space-y-2 pt-2 border-t">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Rate Per KM:</span>
                                    <span className="font-medium">{formatCurrency(vehicle.rate_breakdown.rate_per_km || 0)}/km</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Actual KM Driven:</span>
                                    <span className="font-medium">{selectedBill.total_km_driven.toLocaleString()} km</span>
                                  </div>
                                  {vehicle.rate_breakdown.km_driven && vehicle.rate_breakdown.km_driven !== selectedBill.total_km_driven && (
                                    <>
                                      <div className="flex justify-between text-warning">
                                        <span>KM Charged (Threshold Applied):</span>
                                        <span className="font-semibold">{vehicle.rate_breakdown.km_driven.toLocaleString()} km</span>
                                      </div>
                                      <div className="text-xs text-warning bg-warning/10 p-2 rounded">
                                        ⚠ Minimum threshold applied: {(() => {
                                          const thresholdPerDay = Math.ceil((vehicle.rate_breakdown.km_driven || 0) / tripDays);
                                          return `${thresholdPerDay} km/day × ${tripDays} days = ${vehicle.rate_breakdown.km_driven} km`;
                                        })()}
                                      </div>
                                    </>
                                  )}
                                  <div className="flex justify-between pt-1 border-t">
                                    <span className="text-muted-foreground">KM Amount:</span>
                                    <span className="font-medium">{formatCurrency(vehicle.rate_breakdown.km_amount || 0)}</span>
                                  </div>
                                </div>
                                
                                <div className="flex justify-between pt-2 border-t-2 font-semibold text-base">
                                  <span>Total Vehicle Amount:</span>
                                  <span>{formatCurrency(vehicle.final_amount)}</span>
                                </div>
                              </>
                            )}
                            
                            {vehicle.rate_type !== 'hybrid' && (
                              <div className="flex justify-between pt-2 border-t-2 font-semibold text-base">
                                <span>Vehicle Amount:</span>
                                <span>{formatCurrency(vehicle.final_amount)}</span>
                              </div>
                            )}

                            {/* Driver Allowance */}
                            {vehicle.driver_allowance_per_day && vehicle.driver_allowance_per_day > 0 && (
                              <div className="pt-3 border-t-2 mt-3 space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-muted-foreground font-medium">Driver Allowance:</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Per Day:</span>
                                  <span>{formatCurrency(vehicle.driver_allowance_per_day)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Number of Days:</span>
                                  <span>{tripDays} {tripDays === 1 ? 'day' : 'days'}</span>
                                </div>
                                <div className="flex justify-between pt-1 border-t font-semibold">
                                  <span>Total Driver Allowance:</span>
                                  <span>{formatCurrency(vehicle.driver_allowance_total || 0)}</span>
                                </div>
                                <p className="text-xs text-muted-foreground italic mt-1">
                                  * Paid directly to driver by customer
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Threshold Note */}
              {selectedBill.threshold_note && (
                <Alert className="mb-6 border-warning/50 bg-warning/5">
                  <AlertCircle className="h-4 w-4 text-warning" />
                  <AlertDescription className="text-sm">
                    <p className="font-semibold mb-1">Policy Note:</p>
                    <p>{selectedBill.threshold_note}</p>
                  </AlertDescription>
                </Alert>
              )}

              {/* Payment Summary */}
              <div className="mb-8">
                <h4 className="font-semibold text-sm text-muted-foreground mb-4">PAYMENT SUMMARY</h4>
                <div className="bg-muted/30 rounded-lg p-6">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Subtotal (All Vehicles):</span>
                      <span className="font-semibold text-base">{formatCurrency(selectedBill.total_amount)}</span>
                    </div>
                    {selectedBill.total_driver_allowance > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">
                          Driver Allowance (Total)
                          <span className="text-xs block italic">* Paid directly to driver</span>
                        </span>
                        <span className="font-semibold text-base">{formatCurrency(selectedBill.total_driver_allowance)}</span>
                      </div>
                    )}
                    {/* Always show advance amount */}
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Advance Paid:</span>
                      <span className={`font-semibold ${selectedBill.advance_amount > 0 ? 'text-success' : 'text-muted-foreground'}`}>
                        {selectedBill.advance_amount > 0 ? '- ' : ''}{formatCurrency(selectedBill.advance_amount)}
                        {selectedBill.advance_amount === 0 && <span className="text-xs ml-1">(No advance received)</span>}
                      </span>
                    </div>
                    <Separator className="my-3" />
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-lg font-bold">Balance Amount Due:</span>
                      <span className="text-2xl font-bold text-primary">{formatCurrency(selectedBill.balance_amount)}</span>
                    </div>
                    {selectedBill.total_driver_allowance > 0 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Note: Driver allowance of {formatCurrency(selectedBill.total_driver_allowance)} is to be paid directly to the driver(s) by the customer.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* QR Code Section */}
              <Separator className="my-6" />
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-2">PAYMENT QR CODE</h4>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    Scan this QR code with any UPI app to make payment.
                  </p>
                </div>
                <div className="p-4 bg-white rounded-lg border">
                  <QRCodeSVG
                    value={`PATIDAR|BILL:${selectedBill.bill_number}|BOOKING:${booking.booking_ref}|AMOUNT:${selectedBill.balance_amount}|PHONE:${selectedBill.customer_phone}`}
                    size={100}
                    level="M"
                    includeMargin={false}
                  />
                </div>
              </div>

              {/* Terms & Conditions */}
              <Separator className="my-6" />
              <div className="text-xs text-muted-foreground space-y-2 mb-6">
                <h5 className="font-semibold text-sm mb-2">Terms & Conditions:</h5>
                <ul className="list-disc list-inside space-y-1 pl-2">
                  <li>This is a computer-generated bill and does not require a signature.</li>
                  <li>Payment should be made within the agreed timeframe.</li>
                  <li>For any discrepancies, please contact us within 7 days of bill generation.</li>
                  {selectedBill.threshold_note && (
                    <li>Minimum KM threshold is applied as per company policy for trip duration.</li>
                  )}
                  <li>All amounts are in Indian Rupees (INR).</li>
                </ul>
              </div>

              {/* Footer */}
              <Separator className="my-6" />
              <div className="text-center space-y-2">
                <p className="font-medium">Thank you for choosing Patidar Travels!</p>
                <p className="text-xs text-muted-foreground">
                  This bill was generated on {format(new Date(selectedBill.created_at), 'dd MMM yyyy, hh:mm a')} (IST)
                </p>
                {selectedBill.status === 'paid' && selectedBill.paid_at && (
                  <p className="text-xs text-success font-medium">
                    Payment received on {format(new Date(selectedBill.paid_at), 'dd MMM yyyy, hh:mm a')} (IST)
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
          </TabsContent>

          {/* Company Bill Tab */}
          {hasCompanyBills && (
            <TabsContent value="company" className="space-y-0">
              {selectedCompanyBill ? (
              <Card ref={billRef} className="print:shadow-none print:border-0">
                <CardContent className="p-8 print:p-6">
                  {/* Company Bill Header */}
                  <div className="flex items-start justify-between mb-8 pb-6 border-b">
                    <div className="flex items-center gap-4">
                      <img src={patidarLogo} alt="Patidar Travels" className="h-16 w-16 object-contain" />
                      <div>
                        <h2 className="text-2xl font-bold text-red-600">PATIDAR TRAVELS PVT. LTD.</h2>
                        <p className="text-sm text-muted-foreground mt-1">Internal Company Bill</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <h3 className="text-xl font-semibold">COMPANY BILL</h3>
                      <p className="text-lg font-mono mt-1">{selectedCompanyBill.bill_number}</p>
                      <p className="text-sm text-muted-foreground">
                        Generated: {format(new Date(selectedCompanyBill.created_at), 'dd MMM yyyy')}
                      </p>
                    </div>
                  </div>

                  {/* Company Bill Details */}
                  <div className="grid grid-cols-2 gap-8 mb-8">
                    <div>
                      <h4 className="font-semibold text-sm text-muted-foreground mb-3">BOOKING DETAILS</h4>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Booking Reference:</span>{' '}
                          <span className="font-medium">{booking?.booking_ref || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Customer:</span>{' '}
                          <span className="font-medium">{selectedCompanyBill.customer_name}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Phone:</span>{' '}
                          <span className="font-medium">{selectedCompanyBill.customer_phone}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Trip Duration:</span>{' '}
                          <span className="font-medium">
                            {(() => {
                              const start = new Date(selectedCompanyBill.start_at);
                              const end = new Date(selectedCompanyBill.end_at);
                              const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) || 1;
                              return `${days} ${days === 1 ? 'day' : 'days'}`;
                            })()}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Start Date & Time:</span>{' '}
                          <span className="font-medium">{formatDateTimeFull(selectedCompanyBill.start_at)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">End Date & Time:</span>{' '}
                          <span className="font-medium">{formatDateTimeFull(selectedCompanyBill.end_at)}</span>
                        </div>
                        {selectedCompanyBill.pickup && (
                          <div>
                            <span className="text-muted-foreground">Pickup:</span>{' '}
                            <span className="font-medium">{selectedCompanyBill.pickup}</span>
                          </div>
                        )}
                        {selectedCompanyBill.dropoff && (
                          <div>
                            <span className="text-muted-foreground">Dropoff:</span>{' '}
                            <span className="font-medium">{selectedCompanyBill.dropoff}</span>
                          </div>
                        )}
                        {selectedCompanyBill.total_km_driven > 0 && (
                          <div>
                            <span className="text-muted-foreground">Total KM Driven:</span>{' '}
                            <span className="font-semibold text-base">{selectedCompanyBill.total_km_driven.toLocaleString()} km</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-muted-foreground mb-3">ADVANCE PAYMENT DETAILS</h4>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Advance Amount:</span>{' '}
                          <span className="font-medium">{formatCurrency(selectedCompanyBill.advance_amount)}</span>
                          {selectedCompanyBill.advance_amount === 0 && (
                            <span className="text-xs text-muted-foreground ml-1">(No advance received)</span>
                          )}
                        </div>
                        {selectedCompanyBill.advance_payment_method && (
                          <div>
                            <span className="text-muted-foreground">Payment Method:</span>{' '}
                            <span className="font-medium capitalize">{selectedCompanyBill.advance_payment_method}</span>
                          </div>
                        )}
                        {selectedCompanyBill.advance_collected_by && (
                          <div>
                            <span className="text-muted-foreground">Collected By:</span>{' '}
                            <span className="font-medium">{selectedCompanyBill.advance_collected_by}</span>
                          </div>
                        )}
                        {/* Show which account received the advance - ALWAYS SHOW IF ADVANCE > 0 */}
                        {selectedCompanyBill.advance_amount > 0 && (
                          <>
                            {(() => {
                              // Check if all transfers are completed
                              const transferRequirements = selectedCompanyBill.transfer_requirements || [];
                              const hasPendingTransfers = transferRequirements.some((t: any) => t.status === 'pending');
                              
                              if (selectedCompanyBill.advance_account_type === 'cash') {
                                return (
                                  <div className={`p-4 rounded-lg border-2 mt-3 ${
                                    hasPendingTransfers 
                                      ? 'bg-warning/20 border-warning' 
                                      : 'bg-info/20 border-info'
                                  }`}>
                                    <p className={`font-bold text-base mb-2 ${
                                      hasPendingTransfers ? 'text-warning' : 'text-info'
                                    }`}>💰 CASH PAYMENT</p>
                                    <p className="text-sm text-muted-foreground mb-2">
                                      Advance of <span className="font-bold">{formatCurrency(selectedCompanyBill.advance_amount)}</span> was received in cash.
                                    </p>
                                    {hasPendingTransfers && (
                                      <p className="text-sm font-bold text-warning bg-warning/20 p-2 rounded mt-2">
                                        ⚠️ TRANSFER REQUIRED: Cash needs to be deposited to a company account.
                                      </p>
                                    )}
                                    {!hasPendingTransfers && transferRequirements.length > 0 && (
                                      <p className="text-sm text-success font-medium mt-2">
                                        ✅ All transfers completed
                                      </p>
                                    )}
                                  </div>
                                );
                              } else if (selectedCompanyBill.advance_account_type === 'personal') {
                                const account = selectedCompanyBill.advance_account_id 
                                  ? allBankAccounts?.find(acc => acc.id === selectedCompanyBill.advance_account_id)
                                  : null;
                                return (
                                  <div className={`p-4 rounded-lg border-2 mt-3 ${
                                    hasPendingTransfers 
                                      ? 'bg-warning/20 border-warning' 
                                      : 'bg-info/20 border-info'
                                  }`}>
                                    <p className={`font-bold text-base mb-2 ${
                                      hasPendingTransfers ? 'text-warning' : 'text-info'
                                    }`}>🏦 PERSONAL ACCOUNT PAYMENT</p>
                                    <p className="text-sm text-muted-foreground mb-2">
                                      Advance of <span className="font-bold">{formatCurrency(selectedCompanyBill.advance_amount)}</span> was received in:
                                    </p>
                                    <p className="text-base font-bold mt-1 mb-2">
                                      {account?.account_name || 'Personal Account'}
                                      {account?.account_number && ` (${account.account_number})`}
                                    </p>
                                    {hasPendingTransfers && (
                                      <p className="text-sm font-bold text-warning bg-warning/20 p-2 rounded mt-2">
                                        ⚠️ TRANSFER REQUIRED: {formatCurrency(selectedCompanyBill.advance_amount)} needs to be transferred from "{account?.account_name || 'Personal Account'}" to a company account.
                                      </p>
                                    )}
                                    {!hasPendingTransfers && transferRequirements.length > 0 && (
                                      <p className="text-sm text-success font-medium mt-2">
                                        ✅ All transfers completed
                                      </p>
                                    )}
                                  </div>
                                );
                              } else if (selectedCompanyBill.advance_account_type === 'company' && selectedCompanyBill.advance_account_id) {
                                const account = allBankAccounts?.find(acc => acc.id === selectedCompanyBill.advance_account_id);
                                return (
                                  <div className="bg-success/20 p-4 rounded-lg border-2 border-success mt-3">
                                    <p className="font-bold text-success text-base mb-2">✅ COMPANY ACCOUNT PAYMENT</p>
                                    <p className="text-sm text-muted-foreground mb-2">
                                      Advance of <span className="font-bold">{formatCurrency(selectedCompanyBill.advance_amount)}</span> was received in:
                                    </p>
                                    <p className="text-base font-bold mt-1">
                                      {account?.account_name || 'Company Account'}
                                      {account?.account_number && ` (${account.account_number})`}
                                    </p>
                                    <p className="text-sm text-success font-medium mt-2">
                                      ✓ No transfer required - already in company account.
                                    </p>
                                  </div>
                                );
                              } else if (selectedCompanyBill.advance_payment_method === 'online') {
                                return (
                                  <div className="bg-info/20 p-4 rounded-lg border-2 border-info mt-3">
                                    <p className="font-bold text-info text-base mb-2">💳 ONLINE PAYMENT</p>
                                    <p className="text-sm text-muted-foreground">
                                      Advance of <span className="font-bold">{formatCurrency(selectedCompanyBill.advance_amount)}</span> was received via online payment.
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </>
                        )}
                      </div>
                      {/* Show transfer requirements section */}
                      {selectedCompanyBill.transfer_requirements && selectedCompanyBill.transfer_requirements.length > 0 && (
                        <div className="mt-4 pt-4 border-t">
                          <h5 className="font-semibold text-xs text-muted-foreground mb-2">TRANSFER REQUIREMENTS</h5>
                          <div className="space-y-2 text-xs">
                            {selectedCompanyBill.transfer_requirements.map((transfer: any, idx: number) => {
                              const fromAccount = transfer.from_account_id 
                                ? allBankAccounts?.find(acc => acc.id === transfer.from_account_id)
                                : null;
                              return (
                                <div key={idx} className={`p-3 rounded-lg border ${
                                  transfer.status === 'pending' 
                                    ? 'bg-warning/10 border-warning/20' 
                                    : 'bg-success/10 border-success/20'
                                }`}>
                                  <p className="font-medium mb-2">
                                    {transfer.status === 'pending' ? '⚠️ Pending Transfer' : '✅ Transfer Completed'}
                                  </p>
                                  <div className="space-y-1">
                                    <p><span className="text-muted-foreground">Amount:</span> <span className="font-semibold">{formatCurrency(transfer.amount)}</span></p>
                                    <p>
                                      <span className="text-muted-foreground">From:</span>{' '}
                                      <span className="font-medium">
                                        {transfer.from_account_type === 'cash' 
                                          ? 'Cash' 
                                          : fromAccount 
                                            ? `${fromAccount.account_name}${fromAccount.account_number ? ` (${fromAccount.account_number})` : ''}`
                                            : 'Personal Account'}
                                      </span>
                                    </p>
                                    <p>
                                      <span className="text-muted-foreground">To:</span>{' '}
                                      <span className="font-medium">Company Account</span>
                                    </p>
                                    {transfer.collected_by_name && (
                                      <p><span className="text-muted-foreground">Collected by:</span> {transfer.collected_by_name}</p>
                                    )}
                                    {transfer.cashier_name && (
                                      <p><span className="text-muted-foreground">Cashier:</span> {transfer.cashier_name}</p>
                                    )}
                                    {transfer.status === 'completed' && transfer.transfer_date && (
                                      <p className="text-success font-medium mt-2">
                                        ✅ Transferred on: {format(new Date(transfer.transfer_date), 'MMM dd, yyyy')}
                                      </p>
                                    )}
                                    {transfer.status === 'pending' && (
                                      <p className="text-warning font-medium mt-2">
                                        ⚠️ Action Required: Transfer {formatCurrency(transfer.amount)} to company account.
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator className="my-6" />

                  {/* Company Bill Vehicle Details */}
                  <div className="mb-8">
                    <h4 className="font-semibold text-sm text-muted-foreground mb-4">VEHICLE & RATE DETAILS</h4>
                    <div className="space-y-4">
                      {selectedCompanyBill.vehicle_details.map((vehicle: any, idx: number) => {
                        // Get car info from booking if available
                        const assignedVehicle = booking?.booking_vehicles?.find((bv: any) => 
                          bv.car?.vehicle_number === vehicle.vehicle_number
                        );
                        const carInfo = assignedVehicle?.car;
                        
                        return (
                          <div key={idx} className="border rounded-lg p-4 bg-muted/20">
                            <div className="grid grid-cols-2 gap-4 mb-4">
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Vehicle Number</p>
                                <p className="font-semibold text-base">{vehicle.vehicle_number}</p>
                                {(carInfo?.brand || carInfo?.model) && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {carInfo.brand && <span>{carInfo.brand}</span>}
                                    {carInfo.brand && carInfo.model && ' '}
                                    {carInfo.model && <span>{carInfo.model}</span>}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground mt-2">
                                  <span className="text-muted-foreground">Total KM Driven:</span>{' '}
                                  <span className="font-semibold">{selectedBill.total_km_driven.toLocaleString()} km</span>
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Driver Details</p>
                                <p className="font-medium">{vehicle.driver_name || 'Not Assigned'}</p>
                                {vehicle.driver_phone && (
                                  <p className="text-xs text-muted-foreground">{vehicle.driver_phone}</p>
                                )}
                              </div>
                            </div>
                          <div className="border-t pt-4">
                            <div className="flex justify-between pt-2 border-t-2 font-semibold text-base">
                              <span>Vehicle Amount:</span>
                              <span>{formatCurrency(vehicle.final_amount)}</span>
                            </div>
                            {vehicle.driver_allowance_total > 0 && (
                              <div className="flex justify-between pt-2 text-sm text-muted-foreground">
                                <span>Driver Allowance (deducted):</span>
                                <span>- {formatCurrency(vehicle.driver_allowance_total)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Company Bill Payment Summary */}
                  <div className="mb-8">
                    <h4 className="font-semibold text-sm text-muted-foreground mb-4">PAYMENT SUMMARY</h4>
                    <div className="bg-muted/30 rounded-lg p-6">
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Subtotal (All Vehicles):</span>
                          <span className="font-semibold text-base">{formatCurrency(selectedCompanyBill.total_amount)}</span>
                        </div>
                        {selectedCompanyBill.total_driver_allowance > 0 && (
                          <div className="flex justify-between items-center text-muted-foreground">
                            <span>
                              Driver Allowance (Deducted)
                              <span className="text-xs block italic">* Customer pays directly to driver</span>
                            </span>
                            <span className="font-semibold text-base">- {formatCurrency(selectedCompanyBill.total_driver_allowance)}</span>
                          </div>
                        )}
                        {/* Always show advance amount */}
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Advance Received:</span>
                          <span className={`font-semibold ${selectedCompanyBill.advance_amount > 0 ? 'text-success' : 'text-muted-foreground'}`}>
                            {formatCurrency(selectedCompanyBill.advance_amount)}
                            {selectedCompanyBill.advance_amount === 0 && <span className="text-xs ml-1">(No advance received)</span>}
                          </span>
                        </div>
                        <Separator className="my-3" />
                        <div className="flex justify-between items-center pt-2">
                          <span className="text-lg font-bold">Net Amount:</span>
                          <span className="text-2xl font-bold text-primary">
                            {formatCurrency(selectedCompanyBill.total_amount - selectedCompanyBill.total_driver_allowance - selectedCompanyBill.advance_amount)}
                          </span>
                        </div>
                        {selectedCompanyBill.internal_notes && (
                          <div className="mt-4 pt-4 border-t">
                            <p className="text-xs text-muted-foreground font-medium mb-1">Internal Notes:</p>
                            <p className="text-xs text-muted-foreground">{selectedCompanyBill.internal_notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              ) : (
                <Card>
                  <CardContent className="p-12 text-center">
                    <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground mb-2">No company bill found for this customer bill</p>
                    <p className="text-xs text-muted-foreground">
                      Company bill may not have been generated yet or doesn't match the selected customer bill.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )}
        </Tabs>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground mb-4">No bills generated yet</p>
            {['ongoing', 'completed'].includes(booking?.status || '') && (
              <Button onClick={() => setGenerateBillOpen(true)}>
                <Calculator className="h-4 w-4 mr-2" />
                Generate First Bill
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Generate Bill Dialog */}
      <GenerateBillDialog
        bookingId={booking.id}
        open={generateBillOpen}
        onOpenChange={setGenerateBillOpen}
        onSuccess={() => {
          setGenerateBillOpen(false);
          refetchBills();
          // Also refetch company bills
          queryClient.invalidateQueries({ queryKey: ['company-bills'] });
          // Reset tab to customer if company bill doesn't exist yet
          setTimeout(() => {
            const updatedCompanyBills = queryClient.getQueryData(['company-bills', { bookingId: booking.id }]);
            if (!updatedCompanyBills || (updatedCompanyBills as any[]).length === 0) {
              setBillViewTab('customer');
            }
          }, 500);
        }}
      />

      {/* Payment Reminder Dialog */}
      <Dialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Payment Reminder</DialogTitle>
            <DialogDescription>
              Send a WhatsApp reminder to the customer about the pending payment.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReminderDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendReminder}>
              <MessageCircle className="h-4 w-4 mr-2" />
              Send via WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:hidden { display: none !important; }
          [data-bill-content], [data-bill-content] * { visibility: visible; }
          [data-bill-content] { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}
