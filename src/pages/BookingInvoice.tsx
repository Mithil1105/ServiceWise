// Invoice page for booking billing
import { useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Download, Loader2, FileText, Printer, Plus, Share2, MessageCircle, Mail, X } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useBooking, useInvoice, useGenerateInvoice } from '@/hooks/use-bookings';
import { BookingStatusBadge } from '@/components/bookings/BookingStatusBadge';
import { TRIP_TYPE_LABELS, RATE_TYPE_LABELS } from '@/types/booking';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import patidarLogo from '@/assets/patidar-logo.jpg';

export default function BookingInvoice() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const invoiceRef = useRef<HTMLDivElement>(null);
  const { data: booking, isLoading: loadingBooking, refetch: refetchBooking } = useBooking(id);
  const { data: invoice, isLoading: loadingInvoice, refetch: refetchInvoice } = useInvoice(id);
  const generateInvoice = useGenerateInvoice();
  
  const [finalKms, setFinalKms] = useState<Record<string, string>>({});
  const [savingKms, setSavingKms] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDateTime = (date: string) => {
    return format(new Date(date), 'dd MMM yyyy, hh:mm a');
  };

  // Calculate final totals with actual km if available
  const calculateVehicleTotal = (vehicle: any): number => {
    if (!booking) return 0;
    const days = Math.ceil((new Date(booking.end_at).getTime() - new Date(booking.start_at).getTime()) / (1000 * 60 * 60 * 24)) || 1;
    const km = vehicle.final_km || vehicle.estimated_km || 0;
    
    switch (vehicle.rate_type) {
      case 'total': return vehicle.rate_total || 0;
      case 'per_day': return days * (vehicle.rate_per_day || 0);
      case 'per_km': return (vehicle.rate_per_km || 0) * km;
      case 'hybrid': return (days * (vehicle.rate_per_day || 0)) + ((vehicle.rate_per_km || 0) * km);
      default: return vehicle.computed_total || vehicle.rate_total || 0;
    }
  };

  const handleSaveFinalKms = async () => {
    if (!booking?.booking_vehicles) return;
    
    setSavingKms(true);
    try {
      for (const vehicle of booking.booking_vehicles) {
        const km = finalKms[vehicle.id];
        if (km !== undefined && km !== '') {
          const { error } = await supabase
            .from('booking_vehicles')
            .update({ final_km: Number(km) })
            .eq('id', vehicle.id);
          if (error) throw error;
        }
      }
      toast.success('Final kilometers saved');
      refetchBooking();
    } catch (error) {
      toast.error('Failed to save kilometers');
    } finally {
      setSavingKms(false);
    }
  };

  const handleGenerateInvoice = async () => {
    if (id) {
      await generateInvoice.mutateAsync(id);
      refetchInvoice();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const generatePdfBlob = async (): Promise<Blob | null> => {
    if (!invoiceRef.current) return null;
    
    setGeneratingPdf(true);
    try {
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      return pdf.output('blob');
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Failed to generate PDF');
      return null;
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleDownloadPdf = async () => {
    const blob = await generatePdfBlob();
    if (!blob) return;
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Invoice-${invoice?.invoice_no || booking?.booking_ref || 'invoice'}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('PDF downloaded');
  };

  const handleShareWhatsApp = async () => {
    if (!booking) return;
    
    const totalAmount = booking.booking_vehicles?.reduce(
      (sum, v) => sum + calculateVehicleTotal(v), 0
    ) || 0;
    const totalAdvance = booking.booking_vehicles?.reduce(
      (sum, v) => sum + (v.advance_amount || 0), 0
    ) || 0;
    
    const message = encodeURIComponent(
      `*PATIDAR TRAVELS - Invoice*\n\n` +
      `📋 Booking: ${booking.booking_ref}\n` +
      `${invoice ? `🧾 Invoice: ${invoice.invoice_no}\n` : ''}` +
      `👤 Customer: ${booking.customer_name}\n` +
      `📞 Phone: ${booking.customer_phone}\n\n` +
      `📅 Trip: ${format(new Date(booking.start_at), 'dd MMM yyyy')} - ${format(new Date(booking.end_at), 'dd MMM yyyy')}\n` +
      `🚗 Vehicles: ${booking.booking_vehicles?.length || 0}\n\n` +
      `💰 Total: ${formatCurrency(totalAmount)}\n` +
      `✅ Advance: ${formatCurrency(totalAdvance)}\n` +
      `📍 *Amount Due: ${formatCurrency(totalAmount - totalAdvance)}*\n\n` +
      `Thank you for choosing Patidar Travels!`
    );
    
    const phone = booking.customer_phone.replace(/\D/g, '');
    const whatsappPhone = phone.startsWith('91') ? phone : `91${phone}`;
    
    window.open(`https://wa.me/${whatsappPhone}?text=${message}`, '_blank');
    setShareOpen(false);
  };

  const handleShareEmail = () => {
    if (!booking) return;
    
    const totalAmount = booking.booking_vehicles?.reduce(
      (sum, v) => sum + calculateVehicleTotal(v), 0
    ) || 0;
    const totalAdvance = booking.booking_vehicles?.reduce(
      (sum, v) => sum + (v.advance_amount || 0), 0
    ) || 0;
    
    const subject = encodeURIComponent(`Invoice - ${invoice?.invoice_no || booking.booking_ref} | Patidar Travels`);
    const body = encodeURIComponent(
      `Dear ${booking.customer_name},\n\n` +
      `Please find your invoice details below:\n\n` +
      `Booking Reference: ${booking.booking_ref}\n` +
      `${invoice ? `Invoice Number: ${invoice.invoice_no}\n` : ''}` +
      `Trip Dates: ${format(new Date(booking.start_at), 'dd MMM yyyy')} - ${format(new Date(booking.end_at), 'dd MMM yyyy')}\n\n` +
      `Total Amount: ${formatCurrency(totalAmount)}\n` +
      `Advance Paid: ${formatCurrency(totalAdvance)}\n` +
      `Amount Due: ${formatCurrency(totalAmount - totalAdvance)}\n\n` +
      `Thank you for choosing Patidar Travels!\n\n` +
      `Best regards,\nPatidar Travels Team`
    );
    
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    setShareOpen(false);
  };

  if (loadingBooking || loadingInvoice) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">Booking not found</p>
        <Button variant="outline" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  const totalAmount = booking.booking_vehicles?.reduce(
    (sum, v) => sum + calculateVehicleTotal(v), 0
  ) || 0;

  const totalAdvance = booking.booking_vehicles?.reduce(
    (sum, v) => sum + (v.advance_amount || 0), 0
  ) || 0;

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      {/* Header - hidden in print */}
      <div className="flex items-center gap-4 print:hidden">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="page-title">Invoice</h1>
          <p className="text-sm text-muted-foreground">{booking.booking_ref}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => navigate('/app/bookings/new')}>
            <Plus className="h-4 w-4 mr-1" />
            New Booking
          </Button>
          {!invoice && (
            <Button onClick={handleGenerateInvoice} disabled={generateInvoice.isPending} size="sm">
              {generateInvoice.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <FileText className="h-4 w-4 mr-2" />
              Generate Invoice
            </Button>
          )}
          {invoice && (
            <>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={generatingPdf}>
                {generatingPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                Download PDF
              </Button>
              <Popover open={shareOpen} onOpenChange={setShareOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
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
                    <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleShareEmail}>
                      <Mail className="h-4 w-4 mr-2 text-blue-600" />
                      Email
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </>
          )}
        </div>
      </div>

      {/* Final KM Entry - Only show for completed trips */}
      {booking.status === 'completed' && booking.booking_vehicles?.some(v => v.rate_type === 'per_km' || v.rate_type === 'hybrid') && (
        <Card className="print:hidden">
          <CardContent className="p-4">
            <h4 className="font-semibold mb-3">Enter Final Kilometers</h4>
            <div className="space-y-3">
              {booking.booking_vehicles
                .filter(v => v.rate_type === 'per_km' || v.rate_type === 'hybrid')
                .map(vehicle => (
                  <div key={vehicle.id} className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{vehicle.car?.vehicle_number}</p>
                      <p className="text-xs text-muted-foreground">
                        Estimated: {vehicle.estimated_km || 0} km
                        {vehicle.final_km ? ` | Recorded: ${vehicle.final_km} km` : ''}
                      </p>
                    </div>
                    <div className="w-32">
                      <Input
                        type="number"
                        placeholder="Final KM"
                        value={finalKms[vehicle.id] ?? (vehicle.final_km?.toString() || '')}
                        onChange={e => setFinalKms(prev => ({ ...prev, [vehicle.id]: e.target.value }))}
                      />
                    </div>
                  </div>
                ))}
              <Button size="sm" onClick={handleSaveFinalKms} disabled={savingKms}>
                {savingKms && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save & Recalculate
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoice Content */}
      <Card className="print:shadow-none print:border-none">
        <CardContent className="p-8" ref={invoiceRef}>
          {/* Invoice Header */}
          <div className="flex justify-between items-start mb-8">
            <img src={patidarLogo} alt="Patidar Travels" className="h-14 w-auto object-contain" />
            <div className="text-right">
              <h3 className="text-xl font-semibold">INVOICE</h3>
              {invoice ? (
                <>
                  <p className="text-lg font-mono mt-1">{invoice.invoice_no}</p>
                  <p className="text-sm text-muted-foreground">
                    Issued: {format(new Date(invoice.issued_at), 'dd MMM yyyy')}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">Not generated yet</p>
              )}
            </div>
          </div>

          <Separator className="my-6" />

          {/* Booking & Customer Info */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground mb-2">BOOKING DETAILS</h4>
              <p className="font-medium">{booking.booking_ref}</p>
              <p className="text-sm">{TRIP_TYPE_LABELS[booking.trip_type]} Trip</p>
              <div className="mt-2 text-sm">
                <p><span className="text-muted-foreground">From:</span> {formatDateTime(booking.start_at)}</p>
                <p><span className="text-muted-foreground">To:</span> {formatDateTime(booking.end_at)}</p>
              </div>
              {booking.pickup && <p className="text-sm mt-1"><span className="text-muted-foreground">Pickup:</span> {booking.pickup}</p>}
              {booking.dropoff && <p className="text-sm"><span className="text-muted-foreground">Drop:</span> {booking.dropoff}</p>}
            </div>
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground mb-2">BILLED TO</h4>
              <p className="font-medium">{booking.customer_name}</p>
              <p className="text-sm">{booking.customer_phone}</p>
              <div className="mt-4">
                <BookingStatusBadge status={booking.status} />
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Vehicle Details Table */}
          <div className="mb-8">
            <h4 className="font-semibold text-sm text-muted-foreground mb-4">VEHICLE & RATE DETAILS</h4>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium">Vehicle</th>
                  <th className="text-left py-2 font-medium">Rate Type</th>
                  <th className="text-center py-2 font-medium">KM</th>
                  <th className="text-right py-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {booking.booking_vehicles?.map((vehicle) => (
                  <tr key={vehicle.id} className="border-b border-dashed">
                    <td className="py-3">
                      <p className="font-medium">{vehicle.car?.vehicle_number || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{vehicle.car?.model}</p>
                      {vehicle.driver_name && (
                        <p className="text-xs text-muted-foreground">Driver: {vehicle.driver_name}</p>
                      )}
                    </td>
                    <td className="py-3">
                      <p>{RATE_TYPE_LABELS[vehicle.rate_type]}</p>
                      <p className="text-xs text-muted-foreground">
                        {vehicle.rate_type === 'total' && formatCurrency(vehicle.rate_total)}
                        {vehicle.rate_type === 'per_day' && `${formatCurrency(vehicle.rate_per_day)}/day`}
                        {vehicle.rate_type === 'per_km' && `${formatCurrency(vehicle.rate_per_km)}/km`}
                        {vehicle.rate_type === 'hybrid' && `${formatCurrency(vehicle.rate_per_day)}/day + ${formatCurrency(vehicle.rate_per_km)}/km`}
                      </p>
                    </td>
                    <td className="py-3 text-center">
                      {(vehicle.rate_type === 'per_km' || vehicle.rate_type === 'hybrid') && (
                        <div>
                          <p className="font-medium">{vehicle.final_km || vehicle.estimated_km || '-'}</p>
                          {vehicle.final_km && vehicle.estimated_km && vehicle.final_km !== vehicle.estimated_km && (
                            <p className="text-xs text-muted-foreground line-through">{vehicle.estimated_km}</p>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3 text-right font-medium">
                      {formatCurrency(calculateVehicleTotal(vehicle))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end mb-8">
            <div className="w-64 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatCurrency(totalAmount)}</span>
              </div>
              <div className="flex justify-between text-success">
                <span>Advance Paid</span>
                <span className="font-medium">- {formatCurrency(totalAdvance)}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between text-lg font-bold">
                <span>Amount Due</span>
                <span className="text-primary">{formatCurrency(totalAmount - totalAdvance)}</span>
              </div>
            </div>
          </div>

          {/* QR Code Section */}
          {invoice && (
            <>
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
                    id="invoice-qr"
                    value={`PATIDAR|INV:${invoice.invoice_no}|BOOKING:${booking.booking_ref}|AMOUNT:${totalAmount - totalAdvance}|PHONE:${booking.customer_phone}`}
                    size={100}
                    level="M"
                    includeMargin={false}
                  />
                </div>
              </div>
            </>
          )}

          <Separator className="my-6" />

          {/* Footer */}
          <div className="text-center text-xs text-muted-foreground space-y-1">
            <p>Thank you for choosing Patidar Travels!</p>
            {invoice?.created_by_profile && (
              <p>Invoice generated by: {invoice.created_by_profile.name}</p>
            )}
            {booking.created_by_profile && (
              <p>Booking created by: {booking.created_by_profile.name}</p>
            )}
            <p className="text-[10px] mt-2">
              Generated on {format(new Date(), 'dd MMM yyyy, hh:mm a')} (IST)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:hidden { display: none !important; }
          [data-invoice-content], [data-invoice-content] * { visibility: visible; }
          [data-invoice-content] { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}
