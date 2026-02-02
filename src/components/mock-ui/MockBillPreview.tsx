import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { FileDown } from 'lucide-react';
import { AppWindowFrame } from '@/components/mock-ui/AppWindowFrame';

/** Mock bill preview matching the actual Bills page layout (customer bill). */
export function MockBillPreview({ className }: { className?: string }) {
  return (
    <AppWindowFrame title="ServiceWise Bill" className={className}>
      <div className="p-4 text-left">
        {/* Bill Header - matches Bills.tsx */}
        <div className="flex justify-between items-start mb-4">
          <div className="h-8 w-16 rounded bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground">
            Logo
          </div>
          <div className="text-right">
            <h3 className="text-sm font-semibold text-slate-900">FINAL BILL</h3>
            <p className="text-xs font-mono mt-0.5 text-slate-700">BILL-2025-0042</p>
            <p className="text-[10px] text-muted-foreground">Generated: 02 Feb 2025</p>
          </div>
        </div>

        <Separator className="my-3" />

        {/* Booking & Customer Info - two columns */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <h4 className="font-semibold text-[10px] text-muted-foreground mb-2 uppercase">Booking Details</h4>
            <div className="space-y-1 text-[10px]">
              <div><span className="text-muted-foreground">Booking:</span> <span className="font-medium text-slate-800">BKG-1842</span></div>
              <div><span className="text-muted-foreground">Trip:</span> <span className="font-medium text-slate-800">2 days</span></div>
              <div><span className="text-muted-foreground">Start:</span> <span className="font-medium text-slate-800">02 Feb 2025</span></div>
              <div><span className="text-muted-foreground">Total KM:</span> <span className="font-semibold text-slate-800">320 km</span></div>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-[10px] text-muted-foreground mb-2 uppercase">Billed To</h4>
            <div className="space-y-1 text-[10px]">
              <div className="font-medium text-slate-800">ABC Travels</div>
              <div className="text-muted-foreground">+91 98765 43210</div>
            </div>
          </div>
        </div>

        <Separator className="my-3" />

        {/* Vehicle & Rate Details - one block like Bills.tsx */}
        <div className="mb-4">
          <h4 className="font-semibold text-[10px] text-muted-foreground mb-2 uppercase">Vehicle & Rate Details</h4>
          <div className="border rounded-lg p-3 bg-muted/20 space-y-2">
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground">Vehicle</span>
              <span className="font-semibold text-slate-800">MH-12-AB-1234</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground">Rate Per KM:</span>
              <span className="font-medium text-slate-800">₹45/km</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground">KM Charged (min. 300/day):</span>
              <span className="font-medium text-slate-800">600 km</span>
            </div>
            <div className="flex justify-between text-[10px] pt-1 border-t font-semibold">
              <span>Vehicle Amount:</span>
              <span className="text-slate-900">₹27,000</span>
            </div>
          </div>
        </div>

        {/* Payment Summary - matches Bills.tsx */}
        <div className="mb-4">
          <h4 className="font-semibold text-[10px] text-muted-foreground mb-2 uppercase">Payment Summary</h4>
          <div className="bg-muted/30 rounded-lg p-3 space-y-1.5 text-[10px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal (All Vehicles):</span>
              <span className="font-semibold text-slate-800">₹27,000</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Advance Paid:</span>
              <span className="font-semibold text-green-600">- ₹5,000</span>
            </div>
            <Separator className="my-1.5" />
            <div className="flex justify-between items-center pt-1">
              <span className="font-bold text-slate-900">Balance Amount Due:</span>
              <span className="text-sm font-bold text-primary">₹22,000</span>
            </div>
          </div>
        </div>

        <Button variant="outline" size="sm" className="w-full border-slate-200 text-slate-700 hover:bg-slate-50 text-xs">
          <FileDown className="w-3.5 h-3.5 mr-2" aria-hidden />
          Download PDF
        </Button>
      </div>
    </AppWindowFrame>
  );
}
