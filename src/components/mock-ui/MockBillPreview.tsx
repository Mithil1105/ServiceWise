import { Button } from '@/components/ui/button';
import { Send, FileDown, Printer, Check, FileText, Calendar } from 'lucide-react';
import { AppWindowFrame } from '@/components/mock-ui/AppWindowFrame';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const services = [
  { name: 'Airport Transfer (Premium)', qty: 5, rate: '$85', amount: '$425' },
  { name: 'City Tour (Half Day)', qty: 2, rate: '$150', amount: '$300' },
  { name: 'VIP Sedan (Full Day)', qty: 1, rate: '$350', amount: '$350' },
];

export function MockBillPreview({ className }: { className?: string }) {
  const handleSend = () => toast({ title: 'Send Bill', description: 'Invoice would be sent by email.' });
  const handleDownload = () => toast({ title: 'Download', description: 'PDF download started.' });
  const handlePrint = () => toast({ title: 'Print', description: 'Print dialog opened.' });
  const handleMarkPaid = () => toast({ title: 'Mark Paid', description: 'Invoice marked as paid.' });

  return (
    <AppWindowFrame title="Bill #INV-2026-0458" className={className}>
      <div className="p-3 sm:p-4 flex flex-col sm:flex-row gap-3 sm:gap-4">
        {/* Left: summary cards + bill details */}
        <div className="flex-1 min-w-0 flex flex-col gap-3 sm:gap-4">
          {/* Summary row - like Money Transfers KPI cards */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-2 sm:p-2.5">
              <FileText className="h-4 w-4 text-slate-600 mb-1" aria-hidden />
              <p className="text-base sm:text-lg font-bold text-slate-900">$1,075</p>
              <p className="text-[10px] text-slate-600">Total Due</p>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-100 p-2 sm:p-2.5">
              <span className="text-[10px] font-medium text-amber-800">Pending</span>
              <p className="text-xs sm:text-sm font-semibold text-amber-800 mt-0.5">Status</p>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-2 sm:p-2.5">
              <Calendar className="h-4 w-4 text-slate-600 mb-1" aria-hidden />
              <p className="text-xs font-bold text-slate-900">Feb 15</p>
              <p className="text-[10px] text-slate-600">Due</p>
            </div>
          </div>

          {/* Header row: logo + invoice info */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-slate-800 text-white flex items-center justify-center text-[10px] sm:text-xs font-bold shrink-0">
                SW
              </div>
              <div className="min-w-0">
                <p className="font-bold text-xs sm:text-sm text-slate-900 truncate">ServiceWise</p>
                <p className="text-[10px] text-slate-500">INV-2026-0458 · Feb 2, 2026</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800 shrink-0">
              Pending
            </span>
          </div>

          {/* Bill To */}
          <div className="border-b border-slate-100 pb-2">
            <h4 className="text-[10px] font-semibold uppercase text-slate-500 mb-0.5">Bill To</h4>
            <p className="font-medium text-xs sm:text-sm text-slate-900">Grand Hotels International</p>
            <p className="text-[10px] text-slate-500">123 Business District, City</p>
          </div>

          {/* Service table - clean, readable */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-hidden">
              <table className="w-full text-left text-[10px] sm:text-xs min-w-[280px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="py-2 px-2 font-semibold text-slate-700">Service</th>
                    <th className="py-2 px-2 font-semibold text-slate-700 w-10">Qty</th>
                    <th className="py-2 px-2 font-semibold text-slate-700 w-12">Rate</th>
                    <th className="py-2 px-2 font-semibold text-slate-700 w-14">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((row, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 px-2 text-slate-800">{row.name}</td>
                      <td className="py-2 px-2 text-slate-800">{row.qty}</td>
                      <td className="py-2 px-2 text-slate-800">{row.rate}</td>
                      <td className="py-2 px-2 font-semibold text-slate-900">{row.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end items-center gap-3 py-2 px-2 sm:py-2.5 sm:px-3 bg-slate-50 border-t border-slate-200">
              <span className="font-bold text-slate-900 text-xs sm:text-sm">Total Due</span>
              <span className="text-sm sm:text-base font-bold text-slate-900">$1,075.00</span>
            </div>
          </div>
        </div>

        {/* Right: action buttons - vertical stack on desktop, horizontal on small */}
        <div className="flex sm:flex-col gap-2 shrink-0 flex-wrap sm:flex-nowrap justify-center sm:justify-start">
          <Button
            size="sm"
            className={cn('bg-teal-600 hover:bg-teal-700 text-white flex-1 sm:flex-none min-w-[120px] sm:min-w-0')}
            onClick={handleSend}
          >
            <Send className="h-3.5 w-3.5 mr-2 shrink-0" aria-hidden />
            Send Bill
          </Button>
          <Button variant="outline" size="sm" className="flex-1 sm:flex-none border-slate-200 min-w-0" onClick={handleDownload}>
            <FileDown className="h-3.5 w-3.5 mr-2 shrink-0" aria-hidden />
            Download
          </Button>
          <Button variant="outline" size="sm" className="flex-1 sm:flex-none border-slate-200 min-w-0" onClick={handlePrint}>
            <Printer className="h-3.5 w-3.5 mr-2 shrink-0" aria-hidden />
            Print
          </Button>
          <Button
            size="sm"
            className="flex-1 sm:flex-none min-w-0 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handleMarkPaid}
          >
            <Check className="h-3.5 w-3.5 mr-2 shrink-0" aria-hidden />
            Mark Paid
          </Button>
        </div>
      </div>
    </AppWindowFrame>
  );
}
