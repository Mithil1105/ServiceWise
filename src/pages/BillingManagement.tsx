import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDateTimeFull, formatDateOnly, formatTime12hr } from '@/lib/date';
import { format } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, 
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
  AlertCircle,
  Search,
  Filter,
  Eye
} from 'lucide-react';
import { useAllBills, useUpdateBillStatus, useUploadBillPDF, useBillsNeedingReminder, useMarkReminderSent } from '@/hooks/use-bills';
import { useCompanyBills, useUploadCompanyBillPDF } from '@/hooks/use-company-bills';
import { useBankAccounts } from '@/hooks/use-bank-accounts';
import { useBookings } from '@/hooks/use-bookings';
import { supabase } from '@/integrations/supabase/client';
import { GenerateBillDialog } from '@/components/bookings/GenerateBillDialog';
import { CreateStandaloneBillDialog } from '@/components/bookings/CreateStandaloneBillDialog';
import { TRIP_TYPE_LABELS, RATE_TYPE_LABELS, type Bill } from '@/types/booking';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import patidarLogo from '@/assets/patidar-logo.jpg';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const BILL_STATUS_LABELS: Record<Bill['status'], { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-500' },
  sent: { label: 'Sent', color: 'bg-blue-500' },
  paid: { label: 'Paid', color: 'bg-green-500' },
};

export default function BillingManagement() {
  const navigate = useNavigate();
  const billRef = useRef<HTMLDivElement>(null);
  const { data: allBills, isLoading: loadingBills, refetch: refetchBills } = useAllBills();
  const { data: companyBills, refetch: refetchCompanyBills } = useCompanyBills();
  const { data: allBankAccounts } = useBankAccounts();
  const { data: bookings } = useBookings();
  const { data: billsNeedingReminder } = useBillsNeedingReminder();
  const updateBillStatus = useUpdateBillStatus();
  const uploadPDF = useUploadBillPDF();
  const uploadCompanyPDF = useUploadCompanyBillPDF();
  const markReminderSent = useMarkReminderSent();

  const [billTypeTab, setBillTypeTab] = useState<'customer' | 'company'>('customer');
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [selectedCompanyBillId, setSelectedCompanyBillId] = useState<string | null>(null);
  const [generateBillOpen, setGenerateBillOpen] = useState(false);
  const [selectBookingOpen, setSelectBookingOpen] = useState(false);
  const [standaloneBillOpen, setStandaloneBillOpen] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [bookingFilter, setBookingFilter] = useState<string>('all');
  const [bookingSearch, setBookingSearch] = useState('');
  const [sortField, setSortField] = useState<'status' | 'booking_ref' | 'customer_name' | 'start_at' | 'end_at' | 'rate_type'>('status');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const selectedBill = allBills?.find(b => b.id === selectedBillId);
  const selectedCompanyBill = companyBills?.find(cb => cb.id === selectedCompanyBillId);

  // Filter bills
  const filteredBills = useMemo(() => {
    if (!allBills) return [];
    return allBills.filter(bill => {
      // Status filter
      if (statusFilter !== 'all' && bill.status !== statusFilter) return false;
      
      // Booking filter
      if (bookingFilter !== 'all' && bill.booking_id !== bookingFilter) return false;
      
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesBillNumber = bill.bill_number.toLowerCase().includes(searchLower);
        const matchesCustomer = bill.customer_name.toLowerCase().includes(searchLower);
        const matchesPhone = bill.customer_phone.includes(search);
        const matchesBookingRef = (bill as any).bookings?.booking_ref?.toLowerCase().includes(searchLower);
        if (!matchesBillNumber && !matchesCustomer && !matchesPhone && !matchesBookingRef) return false;
      }
      
      return true;
    });
  }, [allBills, search, statusFilter, bookingFilter]);

  // Filter company bills
  const filteredCompanyBills = useMemo(() => {
    if (!companyBills) return [];
    return companyBills.filter(bill => {
      // Booking filter
      if (bookingFilter !== 'all' && bill.booking_id !== bookingFilter) return false;
      
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesBillNumber = bill.bill_number.toLowerCase().includes(searchLower);
        const matchesCustomer = bill.customer_name.toLowerCase().includes(searchLower);
        const matchesPhone = bill.customer_phone.includes(search);
        if (!matchesBillNumber && !matchesCustomer && !matchesPhone) return false;
      }
      
      return true;
    });
  }, [companyBills, search, bookingFilter]);

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
        logging: false,
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4'); // Portrait mode
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      // Calculate image dimensions to fill page
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgWidthInMM = imgWidth * ratio;
      const imgHeightInMM = imgHeight * ratio;
      
      // Center the image on the page
      const xOffset = (pdfWidth - imgWidthInMM) / 2;
      const yOffset = (pdfHeight - imgHeightInMM) / 2;
      
      pdf.addImage(imgData, 'PNG', xOffset, yOffset, imgWidthInMM, imgHeightInMM);
      
      // If content is taller than one page, add additional pages
      let heightLeft = imgHeightInMM;
      let position = yOffset;
      
      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', xOffset, position, imgWidthInMM, imgHeightInMM);
        heightLeft -= pdfHeight;
      }
      
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
    if (billTypeTab === 'customer' && selectedBill) {
      const blob = await generatePdfBlob(selectedBill);
      if (!blob) return;
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${selectedBill.bill_number}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } else if (billTypeTab === 'company' && selectedCompanyBill) {
      const blob = await generateCompanyBillPdfBlob(selectedCompanyBill);
      if (!blob) return;
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${selectedCompanyBill.bill_number}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  const generateCompanyBillPdfBlob = async (companyBill: any): Promise<Blob | null> => {
    if (!billRef.current) return null;
    
    setGeneratingPdf(true);
    try {
      const canvas = await html2canvas(billRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgWidthInMM = imgWidth * ratio;
      const imgHeightInMM = imgHeight * ratio;
      
      const xOffset = (pdfWidth - imgWidthInMM) / 2;
      const yOffset = (pdfHeight - imgHeightInMM) / 2;
      
      pdf.addImage(imgData, 'PNG', xOffset, yOffset, imgWidthInMM, imgHeightInMM);
      
      let heightLeft = imgHeightInMM;
      let position = yOffset;
      
      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', xOffset, position, imgWidthInMM, imgHeightInMM);
        heightLeft -= pdfHeight;
      }
      
      const blob = pdf.output('blob');
      
      // Upload to storage
      const file = new File([blob], `${companyBill.bill_number}.pdf`, { type: 'application/pdf' });
      await uploadCompanyPDF.mutateAsync({ billId: companyBill.id, pdfFile: file });
      
      return blob;
    } catch (error) {
      console.error('PDF generation error:', error);
      return null;
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleShareWhatsApp = async () => {
    if (!selectedBill) return;
    
    // Generate PDF first if not already generated
    let pdfBlob = null;
    if (!selectedBill.pdf_file_path) {
      pdfBlob = await generatePdfBlob(selectedBill);
    } else {
      // Get PDF from storage
      const { data: { publicUrl } } = supabase.storage
        .from('bills')
        .getPublicUrl(selectedBill.pdf_file_path);
      
      // Fetch the PDF
      const response = await fetch(publicUrl);
      pdfBlob = await response.blob();
    }
    
    // Create message without emojis (use text alternatives)
    const message = `*PATIDAR TRAVELS - Final Bill*\n\n` +
      `Bill: ${selectedBill.bill_number}\n` +
      `Booking: ${(selectedBill as any).bookings?.booking_ref || 'N/A'}\n` +
      `Customer: ${selectedBill.customer_name}\n` +
      `Phone: ${selectedBill.customer_phone}\n\n` +
      `Trip: ${formatDateOnly(selectedBill.start_at)} - ${formatDateOnly(selectedBill.end_at)}\n` +
      `Total KM: ${selectedBill.total_km_driven} km\n\n` +
      `Total: ${formatCurrency(selectedBill.total_amount)}\n` +
      `Advance: ${formatCurrency(selectedBill.advance_amount)}\n` +
      `*Balance: ${formatCurrency(selectedBill.balance_amount)}*\n\n` +
      `Thank you for choosing Patidar Travels!`;
    
    const phone = selectedBill.customer_phone.replace(/\D/g, '');
    const whatsappPhone = phone.startsWith('91') ? phone : `91${phone}`;
    
    // Create a data URL for the PDF
    const pdfDataUrl = URL.createObjectURL(pdfBlob);
    
    // For WhatsApp Web/Desktop, we can share the PDF via a share link
    // Note: WhatsApp Web API doesn't support direct file attachment via URL
    // So we'll provide download link in message and open WhatsApp with message
    const encodedMessage = encodeURIComponent(message + `\n\nDownload PDF: ${window.location.origin}/billing?bill=${selectedBill.id}`);
    
    // Open WhatsApp with message
    window.open(`https://wa.me/${whatsappPhone}?text=${encodedMessage}`, '_blank');
    
    // Also try to trigger download/share
    // On mobile devices, user can manually attach the PDF
    if (pdfBlob) {
      const link = document.createElement('a');
      link.href = pdfDataUrl;
      link.download = `${selectedBill.bill_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(pdfDataUrl), 100);
    }
    
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

  const handleCreateNewBill = () => {
    // Show options: from booking or standalone
    // For now, show a popover or just open standalone directly
    // You can add a popover here if needed
    setStandaloneBillOpen(true);
  };
  
  const handleCreateFromBooking = () => {
    setSelectBookingOpen(true);
  };

  const handleSelectBooking = (bookingId: string) => {
    setSelectedBookingId(bookingId);
    setSelectBookingOpen(false);
    setGenerateBillOpen(true);
  };

  // Stats
  const stats = useMemo(() => {
    if (!allBills) return { total: 0, draft: 0, sent: 0, paid: 0, totalAmount: 0, pendingAmount: 0 };
    return {
      total: allBills.length,
      draft: allBills.filter(b => b.status === 'draft').length,
      sent: allBills.filter(b => b.status === 'sent').length,
      paid: allBills.filter(b => b.status === 'paid').length,
      totalAmount: allBills.reduce((sum, b) => sum + (b.total_amount || 0), 0),
      pendingAmount: allBills.filter(b => b.status !== 'paid').reduce((sum, b) => sum + (b.balance_amount || 0), 0),
    };
  }, [allBills]);

  if (loadingBills) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Billing Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage all bills and generate new bills
          </p>
        </div>
        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button>
                <Calculator className="h-4 w-4 mr-2" />
                Create New Bill
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="end">
              <div className="space-y-1">
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => {
                    setStandaloneBillOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Standalone Bill
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={handleCreateFromBooking}
                >
                  <Calculator className="h-4 w-4 mr-2" />
                  From Booking
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-sm text-muted-foreground">Total Bills</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-gray-600">{stats.draft}</p>
            <p className="text-sm text-muted-foreground">Draft</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-blue-600">{stats.sent}</p>
            <p className="text-sm text-muted-foreground">Sent</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-green-600">{stats.paid}</p>
            <p className="text-sm text-muted-foreground">Paid</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{formatCurrency(stats.totalAmount)}</p>
            <p className="text-sm text-muted-foreground">Total Amount</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-orange-600">{formatCurrency(stats.pendingAmount)}</p>
            <p className="text-sm text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by bill number, customer, phone, or booking ref..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
            <Select value={bookingFilter} onValueChange={setBookingFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Bookings" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Bookings</SelectItem>
                {bookings?.map(booking => (
                  <SelectItem key={booking.id} value={booking.id}>
                    {booking.booking_ref} - {booking.customer_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Customer and Company Bills */}
      <Tabs value={billTypeTab} onValueChange={(v) => {
        setBillTypeTab(v as 'customer' | 'company');
        setSelectedBillId(null);
        setSelectedCompanyBillId(null);
      }}>
        <TabsList className="mb-4">
          <TabsTrigger value="customer">Customer Bills</TabsTrigger>
          <TabsTrigger value="company">Company Bills</TabsTrigger>
        </TabsList>

        {/* Customer Bills Tab */}
        <TabsContent value="customer" className="space-y-4">
      {/* Bills Table */}
      <Card>
        <CardContent className="p-0">
          {filteredBills.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bill Number</TableHead>
                    <TableHead>Booking Ref</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Total Amount</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBills.map((bill) => (
                    <TableRow 
                      key={bill.id} 
                      className={`cursor-pointer hover:bg-muted/50 ${selectedBillId === bill.id ? 'bg-muted' : ''}`}
                      onClick={() => setSelectedBillId(bill.id)}
                    >
                      <TableCell className="font-mono text-sm font-medium">
                        {bill.bill_number}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {(bill as any).bookings?.booking_ref || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{bill.customer_name}</p>
                          <p className="text-xs text-muted-foreground">{bill.customer_phone}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{formatDateOnly(bill.created_at)}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatTime12hr(bill.created_at)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(bill.total_amount)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(bill.balance_amount)}
                      </TableCell>
                      <TableCell>
                        <Badge className={BILL_STATUS_LABELS[bill.status].color}>
                          {BILL_STATUS_LABELS[bill.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => setSelectedBillId(bill.id)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>View Bill</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No bills found</p>
              <Button onClick={handleCreateNewBill}>
                <Calculator className="h-4 w-4 mr-2" />
                Generate First Bill
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bill Detail View */}
      {selectedBill && billTypeTab === 'customer' && (
        <>
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
            {selectedBill.status === 'sent' && 
             !selectedBill.payment_reminder_sent_at &&
             selectedBill.sent_at &&
             new Date(selectedBill.sent_at) <= new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) && (
              <Button variant="outline" onClick={() => setReminderDialogOpen(true)}>
                <AlertCircle className="h-4 w-4 mr-2" />
                Send Reminder
              </Button>
            )}
            {(() => {
              const relatedCompanyBill = companyBills?.find(cb => cb.customer_bill_id === selectedBill.id);
              if (relatedCompanyBill) {
                return (
                  <Button variant="outline" onClick={() => {
                    setBillTypeTab('company');
                    setSelectedCompanyBillId(relatedCompanyBill.id);
                  }}>
                    <Eye className="h-4 w-4 mr-2" />
                    View Company Bill
                  </Button>
                );
              }
              return null;
            })()}
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
                    Generated: {formatDateOnly(selectedBill.created_at)}
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
                      <span className="font-medium">{(selectedBill as any).bookings?.booking_ref || 'N/A'}</span>
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
                      <div>
                        <span className="text-muted-foreground">Calculation Method:</span>{' '}
                        <span className="font-medium">
                          {selectedBill.km_calculation_method === 'odometer' ? 'Odometer Reading' : 'Manual Entry'}
                        </span>
                      </div>
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
                    
                    return (
                      <div key={idx} className="border rounded-lg p-4 bg-muted/20">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Vehicle Number</p>
                            <p className="font-semibold text-base">{vehicle.vehicle_number}</p>
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
                    {selectedBill.advance_amount > 0 && (
                      <div className="flex justify-between items-center text-success">
                        <span>Advance Paid:</span>
                        <span className="font-semibold">- {formatCurrency(selectedBill.advance_amount)}</span>
                      </div>
                    )}
                    <Separator className="my-3" />
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-lg font-bold">Balance Amount Due:</span>
                      <span className="text-2xl font-bold text-primary">{formatCurrency(selectedBill.balance_amount)}</span>
                    </div>
                    {selectedBill.advance_amount === 0 && (
                      <p className="text-xs text-muted-foreground mt-2">No advance payment received</p>
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
                    value={`PATIDAR|BILL:${selectedBill.bill_number}|BOOKING:${(selectedBill as any).bookings?.booking_ref || 'N/A'}|AMOUNT:${selectedBill.balance_amount}|PHONE:${selectedBill.customer_phone}`}
                    size={100}
                    level="M"
                    includeMargin={false}
                  />
                </div>
              </div>

              <Separator className="my-6" />

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
                  This bill was generated on {formatDateTimeFull(selectedBill.created_at)} (IST)
                </p>
                {selectedBill.status === 'paid' && selectedBill.paid_at && (
                  <p className="text-xs text-success font-medium">
                    Payment received on {formatDateTimeFull(selectedBill.paid_at)} (IST)
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
        </TabsContent>

        {/* Company Bills Tab */}
        <TabsContent value="company" className="space-y-4">
      {/* Company Bills Table */}
      <Card>
        <CardContent className="p-0">
          {filteredCompanyBills.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bill Number</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Total Amount</TableHead>
                    <TableHead>Advance</TableHead>
                    <TableHead>Net Amount</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompanyBills.map((bill) => {
                    const netAmount = bill.total_amount - (bill.total_driver_allowance || 0) - (bill.advance_amount || 0);
                    return (
                      <TableRow 
                        key={bill.id} 
                        className={`cursor-pointer hover:bg-muted/50 ${selectedCompanyBillId === bill.id ? 'bg-muted' : ''}`}
                        onClick={() => {
                          setSelectedCompanyBillId(bill.id);
                          // Link to customer bill if exists
                          if (bill.customer_bill_id) {
                            const customerBill = allBills?.find(b => b.id === bill.customer_bill_id);
                            if (customerBill) {
                              setSelectedBillId(customerBill.id);
                            }
                          }
                        }}
                      >
                        <TableCell className="font-mono text-sm font-medium">
                          {bill.bill_number}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{bill.customer_name}</p>
                            <p className="text-xs text-muted-foreground">{bill.customer_phone}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{formatDateOnly(bill.created_at)}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatTime12hr(bill.created_at)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(bill.total_amount)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(bill.advance_amount)}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatCurrency(netAmount)}
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => setSelectedCompanyBillId(bill.id)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>View Company Bill</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No company bills found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Company Bill Detail View */}
      {selectedCompanyBill && billTypeTab === 'company' && (
        <>
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
                  <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => window.print()}>
                    <Mail className="h-4 w-4 mr-2 text-blue-600" />
                    Email
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            {selectedCompanyBill.customer_bill_id && (
              <Button variant="outline" onClick={() => {
                const customerBill = allBills?.find(b => b.id === selectedCompanyBill.customer_bill_id);
                if (customerBill) {
                  setBillTypeTab('customer');
                  setSelectedBillId(customerBill.id);
                }
              }}>
                <Eye className="h-4 w-4 mr-2" />
                View Customer Bill
              </Button>
            )}
          </div>

          <Card className="print:shadow-none print:border-none" ref={billRef}>
            <CardContent className="p-8">
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
                    Generated: {formatDateOnly(selectedCompanyBill.created_at)}
                  </p>
                </div>
              </div>

              {/* Company Bill Details */}
              <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-3">BOOKING DETAILS</h4>
                  <div className="space-y-2 text-sm">
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
                      <span className="font-medium">{formatDateTime(selectedCompanyBill.start_at)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">End Date & Time:</span>{' '}
                      <span className="font-medium">{formatDateTime(selectedCompanyBill.end_at)}</span>
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
                          }
                          return null;
                        })()}
                      </>
                    )}
                  </div>
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
                  {selectedCompanyBill.vehicle_details.map((vehicle: any, idx: number) => (
                    <div key={idx} className="border rounded-lg p-4 bg-muted/20">
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Vehicle Number</p>
                          <p className="font-semibold text-base">{vehicle.vehicle_number}</p>
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
                  ))}
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
        </>
      )}
        </TabsContent>
      </Tabs>

      {/* Select Booking Dialog */}
      <Dialog open={selectBookingOpen} onOpenChange={setSelectBookingOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Select Booking</DialogTitle>
            <DialogDescription>
              Choose a booking to generate a bill for
            </DialogDescription>
          </DialogHeader>
          
          {/* Search Bar and Sort Controls */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by booking ref, customer name, phone, or pickup/dropoff..."
                value={bookingSearch}
                onChange={(e) => setBookingSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Sort Controls */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Sort by:</span>
              <Select value={sortField} onValueChange={(value: any) => setSortField(value)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="booking_ref">Booking ID</SelectItem>
                  <SelectItem value="customer_name">Customer Name</SelectItem>
                  <SelectItem value="start_at">Start Date</SelectItem>
                  <SelectItem value="end_at">End Date</SelectItem>
                  <SelectItem value="rate_type">Rate Type</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
              >
                {sortDirection === 'asc' ? '↑' : '↓'}
              </Button>
            </div>
          </div>

          {/* Bookings List */}
          <div className="flex-1 overflow-y-auto mt-4">
            {(() => {
              // Get booking IDs that already have bills
              const bookingsWithBills = new Set(
                allBills?.filter(b => b.booking_id).map(b => b.booking_id) || []
              );
              
              // Filter out bookings that already have bills and only show ongoing/completed
              const eligibleBookings = bookings?.filter(b => 
                ['ongoing', 'completed'].includes(b.status) && 
                !bookingsWithBills.has(b.id)
              ) || [];
              
              const filteredBookings = eligibleBookings.filter(booking => {
                if (!bookingSearch) return true;
                const searchLower = bookingSearch.toLowerCase();
                return (
                  booking.booking_ref.toLowerCase().includes(searchLower) ||
                  booking.customer_name.toLowerCase().includes(searchLower) ||
                  booking.customer_phone.includes(bookingSearch) ||
                  (booking.pickup?.toLowerCase().includes(searchLower)) ||
                  (booking.dropoff?.toLowerCase().includes(searchLower))
                );
              });
              
              // Sort bookings
              const sortedBookings = [...filteredBookings].sort((a, b) => {
                let aValue: any;
                let bValue: any;
                
                if (sortField === 'status') {
                  aValue = a.status;
                  bValue = b.status;
                } else if (sortField === 'booking_ref') {
                  aValue = a.booking_ref;
                  bValue = b.booking_ref;
                } else if (sortField === 'customer_name') {
                  aValue = a.customer_name.toLowerCase();
                  bValue = b.customer_name.toLowerCase();
                } else if (sortField === 'start_at') {
                  aValue = new Date(a.start_at).getTime();
                  bValue = new Date(b.start_at).getTime();
                } else if (sortField === 'end_at') {
                  aValue = new Date(a.end_at).getTime();
                  bValue = new Date(b.end_at).getTime();
                } else if (sortField === 'rate_type') {
                  const aRateType = a.booking_requested_vehicles?.[0]?.rate_type || 
                                   a.booking_vehicles?.[0]?.rate_type || 
                                   'total';
                  const bRateType = b.booking_requested_vehicles?.[0]?.rate_type || 
                                   b.booking_vehicles?.[0]?.rate_type || 
                                   'total';
                  aValue = aRateType;
                  bValue = bRateType;
                }
                
                if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
                return 0;
              });

              if (filteredBookings.length === 0) {
                return (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">
                      {eligibleBookings.length === 0
                        ? 'No eligible bookings found. Bookings must be in "ongoing" or "completed" status and not already have bills generated.'
                        : 'No bookings match your search.'}
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-2">
                  {sortedBookings.map(booking => {
                    const rateType = booking.booking_requested_vehicles?.[0]?.rate_type || 
                                   booking.booking_vehicles?.[0]?.rate_type || 
                                   'total';
                    const startDate = new Date(booking.start_at);
                    const endDate = new Date(booking.end_at);
                    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) || 1;
                    
                    return (
                      <div
                        key={booking.id}
                        className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => handleSelectBooking(booking.id)}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <p className="font-mono font-semibold text-sm">{booking.booking_ref}</p>
                              <Badge variant="outline" className="text-xs">
                                {booking.status}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {RATE_TYPE_LABELS[rateType as keyof typeof RATE_TYPE_LABELS]}
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 text-sm mb-2">
                              <div>
                                <p className="font-medium">{booking.customer_name}</p>
                                <p className="text-muted-foreground text-xs">{booking.customer_phone}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-xs">Trip Dates</p>
                                <p className="font-medium">
                                  {formatDateOnly(startDate)} - {formatDateOnly(endDate)}
                                </p>
                                <p className="text-xs text-muted-foreground">{days} {days === 1 ? 'day' : 'days'}</p>
                              </div>
                            </div>
                            
                            {(booking.pickup || booking.dropoff) && (
                              <div className="text-xs text-muted-foreground space-y-1">
                                {booking.pickup && (
                                  <p><span className="font-medium">Pickup:</span> {booking.pickup}</p>
                                )}
                                {booking.dropoff && (
                                  <p><span className="font-medium">Drop:</span> {booking.dropoff}</p>
                                )}
                              </div>
                            )}
                            
                            {booking.booking_vehicles && booking.booking_vehicles.length > 0 && (
                              <div className="mt-2 pt-2 border-t">
                                <p className="text-xs text-muted-foreground mb-1">Assigned Vehicles:</p>
                                <div className="flex flex-wrap gap-2">
                                  {booking.booking_vehicles.map((bv, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {bv.car?.vehicle_number || 'N/A'}
                                      {bv.driver_name && ` • ${bv.driver_name}`}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectBooking(booking.id);
                            }}
                          >
                            Select
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setSelectBookingOpen(false);
              setBookingSearch('');
              setSortField('status');
              setSortDirection('asc');
            }}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Bill Dialog */}
      {selectedBookingId && (
        <GenerateBillDialog
          bookingId={selectedBookingId}
          open={generateBillOpen}
          onOpenChange={(open) => {
            setGenerateBillOpen(open);
            if (!open) setSelectedBookingId(null);
          }}
          onSuccess={() => {
            setGenerateBillOpen(false);
            setSelectedBookingId(null);
            refetchBills();
          }}
        />
      )}

      {/* Standalone Bill Dialog */}
      <CreateStandaloneBillDialog
        open={standaloneBillOpen}
        onOpenChange={setStandaloneBillOpen}
        onSuccess={() => {
          setStandaloneBillOpen(false);
          refetchBills();
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
