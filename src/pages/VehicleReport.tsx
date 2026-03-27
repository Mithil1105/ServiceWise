import { useState, useMemo } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useCar } from '@/hooks/use-cars';
import { useAssignedCarIdsForCurrentUser } from '@/hooks/use-car-assignments';
import { useOdometerEntries, useLatestOdometer } from '@/hooks/use-odometer';
import { useFuelEntries, useFuelEntryBillsByFuelEntryIds } from '@/hooks/use-fuel';
import { useServiceRecords } from '@/hooks/use-services';
import { useServiceBillsByRecordIds, ServiceBillFile } from '@/hooks/use-service-bills';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Gauge,
  Wrench,
  Download,
  Loader2,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  Printer,
  Calendar,
  Car,
  Fuel as FuelIcon,
} from 'lucide-react';
import { formatDateDMY, formatDateTimeDMY } from '@/lib/date';
import { storageGetSignedUrl } from '@/lib/storage';
import { toFullKey } from '@/lib/storage-keys';
import { computeFuelMileageForCar } from '@/lib/fuel-mileage';
import type { FuelEntryBill } from '@/types';

export default function VehicleReport() {
  const { id } = useParams<{ id: string }>();
  const { assignedCarIds, isRestricted } = useAssignedCarIdsForCurrentUser();
  const { data: car, isLoading: carLoading } = useCar(id!);
  const { data: latestOdo } = useLatestOdometer(id!);
  const { data: odometerEntries, isLoading: odoLoading } = useOdometerEntries(id);
  const { data: serviceRecords, isLoading: servicesLoading } = useServiceRecords(id);
  const { data: fuelEntries = [], isLoading: fuelLoading } = useFuelEntries({ carId: id! });

  if (isRestricted && id && assignedCarIds && !assignedCarIds.includes(id)) {
    return <Navigate to="/app" replace />;
  }

  const recordIds = useMemo(() => serviceRecords?.map((r) => r.id) || [], [serviceRecords]);
  const { data: billsByRecord } = useServiceBillsByRecordIds(recordIds);

  const [selectedBills, setSelectedBills] = useState<{ bills: ServiceBillFile[]; serviceName: string } | null>(null);
  const [billUrls, setBillUrls] = useState<Record<string, string>>({});
  const [billLoading, setBillLoading] = useState(false);

  const [fuelBillPreviewOpen, setFuelBillPreviewOpen] = useState(false);
  const [fuelBillPreview, setFuelBillPreview] = useState<FuelEntryBill | null>(null);
  const [fuelBillPreviewUrl, setFuelBillPreviewUrl] = useState<string | null>(null);
  const [fuelBillPreviewLoading, setFuelBillPreviewLoading] = useState(false);

  const currentKm = latestOdo?.odometer_km || 0;
  const totalServices = serviceRecords?.length || 0;
  const totalServiceCost = serviceRecords?.reduce((sum, r) => sum + (r.cost || 0), 0) || 0;

  const fuelEntriesAsc = useMemo(
    () =>
      [...(fuelEntries ?? [])].sort(
        (a, b) => new Date(a.filled_at).getTime() - new Date(b.filled_at).getTime()
      ),
    [fuelEntries]
  );
  const fuelSummary = fuelEntriesAsc.length ? computeFuelMileageForCar(fuelEntriesAsc) : null;

  const fuelTotalsByType = useMemo(() => {
    const byType = new Map<string, { liters: number; spend: number }>();
    for (const e of fuelEntriesAsc) {
      const t = String((e as any).fuel_type || 'unknown').trim().toLowerCase();
      if (!byType.has(t)) byType.set(t, { liters: 0, spend: 0 });
      const cur = byType.get(t)!;
      cur.liters += Number(e.fuel_liters) || 0;
      cur.spend += Number(e.amount_inr) || 0;
    }
    return Array.from(byType.entries())
      .map(([fuel_type, v]) => ({
        fuel_type,
        liters: v.liters,
        spend: v.spend,
        avgPricePerL: v.liters > 0 ? v.spend / v.liters : null,
      }))
      .sort((a, b) => b.spend - a.spend);
  }, [fuelEntriesAsc]);

  const fuelEntryIds = useMemo(() => fuelEntriesAsc.map((e) => e.id), [fuelEntriesAsc]);
  const {
    data: fuelEntryBillsByEntryId = {} as Record<string, FuelEntryBill[]>,
    isLoading: fuelBillsLoading,
  } = useFuelEntryBillsByFuelEntryIds(fuelEntryIds);

  const handleViewBills = async (bills: ServiceBillFile[], serviceName: string) => {
    setBillLoading(true);
    setSelectedBills({ bills, serviceName });
    
    const urls: Record<string, string> = {};
    for (const bill of bills) {
      try {
        const key = toFullKey('SERVICE_BILLS', bill.file_path);
        if (key) urls[bill.id] = await storageGetSignedUrl(key, 3600, undefined, 'service-bills');
      } catch (e) {
        console.error('Error loading bill:', e);
      }
    }
    setBillUrls(urls);
    setBillLoading(false);
  };

  const openFuelBillPreview = async (bill: FuelEntryBill) => {
    setFuelBillPreview(bill);
    setFuelBillPreviewOpen(true);
    setFuelBillPreviewUrl(null);
    setFuelBillPreviewLoading(true);
    try {
      const url = await storageGetSignedUrl(bill.file_path, 3600);
      setFuelBillPreviewUrl(url);
    } catch (e) {
      console.error('Error loading fuel bill:', e);
      setFuelBillPreviewUrl(null);
    } finally {
      setFuelBillPreviewLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportDetailed = async () => {
    if (!car || !serviceRecords || !odometerEntries) return;

    // Create a detailed HTML report
    const exportBillUrls: { serviceName: string; date: string; url: string; fileName: string; isPdf: boolean }[] = [];
    
    // Get signed URLs for all bills from the new table
    for (const record of serviceRecords) {
      const bills = billsByRecord?.[record.id] || [];
      for (const bill of bills) {
        try {
          const key = toFullKey('SERVICE_BILLS', bill.file_path);
          if (key) {
            const url = await storageGetSignedUrl(key, 86400, undefined, 'service-bills');
            exportBillUrls.push({
              serviceName: record.service_name,
              date: formatDateDMY(record.serviced_at),
              url,
              fileName: bill.file_name,
              isPdf: bill.file_type === 'application/pdf',
            });
          }
        } catch (e) {
          console.error('Error getting bill URL:', e);
        }
      }
    }

    const exportFuelBillUrls: { date: string; url: string; fileName: string; isPdf: boolean }[] = [];
    for (const fill of fuelEntriesAsc ?? []) {
      const bills = fuelEntryBillsByEntryId[fill.id] ?? [];
      for (const bill of bills) {
        try {
          const url = await storageGetSignedUrl(bill.file_path, 86400);
          exportFuelBillUrls.push({
            date: formatDateDMY(fill.filled_at),
            url,
            fileName: bill.file_name,
            isPdf: bill.file_type === 'application/pdf',
          });
        } catch (e) {
          console.error('Error getting fuel bill URL:', e);
        }
      }
    }

    // Generate HTML report
    const reportHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vehicle Service Report - ${car.vehicle_number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; background: #fff; color: #333; }
    .header { border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { font-size: 28px; color: #1e40af; }
    .header p { color: #666; margin-top: 5px; }
    .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }
    .info-card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; }
    .info-card .label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
    .info-card .value { font-size: 24px; font-weight: 700; color: #1e293b; margin-top: 5px; }
    .section { margin-bottom: 30px; }
    .section-title { font-size: 18px; font-weight: 600; color: #1e293b; padding: 10px 0; border-bottom: 2px solid #e2e8f0; margin-bottom: 15px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { background: #f1f5f9; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #475569; }
    td { font-size: 14px; }
    .cost { font-weight: 600; color: #059669; }
    .bill-link { color: #2563eb; text-decoration: none; }
    .bill-link:hover { text-decoration: underline; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; }
    .bill-images { margin-top: 30px; page-break-before: always; }
    .bill-image { margin-bottom: 30px; page-break-inside: avoid; }
    .bill-image img { max-width: 100%; border: 1px solid #e2e8f0; border-radius: 8px; }
    .bill-image .caption { font-size: 12px; color: #64748b; margin-top: 10px; }
    @media print {
      body { padding: 20px; }
      .info-grid { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🚗 Vehicle Service Report</h1>
    <p>${car.vehicle_number} - ${car.model}${car.year ? ` (${car.year})` : ''}</p>
    <p>Generated on: ${formatDateTimeDMY(new Date().toISOString())}</p>
  </div>

  <div class="info-grid">
    <div class="info-card">
      <div class="label">Current Odometer</div>
      <div class="value">${currentKm.toLocaleString()} km</div>
    </div>
    <div class="info-card">
      <div class="label">Total Services</div>
      <div class="value">${totalServices}</div>
    </div>
    <div class="info-card">
      <div class="label">Total Service Cost</div>
      <div class="value">₹${totalServiceCost.toLocaleString()}</div>
    </div>
    <div class="info-card">
      <div class="label">Fuel Type</div>
      <div class="value">${car.fuel_type || 'N/A'}</div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">📋 Service Records</h2>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Service</th>
          <th>Vendor</th>
          <th>Location</th>
          <th>Odometer</th>
          <th>Cost</th>
          <th>Notes</th>
          <th>Bills</th>
        </tr>
      </thead>
      <tbody>
        ${serviceRecords?.map((record) => {
          const bills = billsByRecord?.[record.id] || [];
          const billCount = bills.length;
          return `
          <tr>
            <td>${formatDateDMY(record.serviced_at)}</td>
            <td><strong>${record.service_name}</strong></td>
            <td>${record.vendor_name || '-'}</td>
            <td>${record.vendor_location || '-'}</td>
            <td>${record.odometer_km.toLocaleString()} km</td>
            <td class="cost">${record.cost ? '₹' + record.cost.toLocaleString() : '-'}</td>
            <td>${record.notes || '-'}</td>
            <td>${billCount > 0 ? '✓ ' + billCount + ' file' + (billCount > 1 ? 's' : '') : '-'}</td>
          </tr>
        `}).join('') || '<tr><td colspan="8">No service records</td></tr>'}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2 class="section-title">📊 Odometer History</h2>
    <table>
      <thead>
        <tr>
          <th>Date & Time</th>
          <th>Reading</th>
          <th>Change</th>
        </tr>
      </thead>
      <tbody>
        ${odometerEntries?.map((entry, idx) => {
          const prevEntry = odometerEntries[idx + 1];
          const change = prevEntry ? entry.odometer_km - prevEntry.odometer_km : 0;
          return `
            <tr>
              <td>${formatDateTimeDMY(entry.reading_at)}</td>
              <td><strong>${entry.odometer_km.toLocaleString()} km</strong></td>
              <td>${change > 0 ? '+' + change.toLocaleString() + ' km' : '-'}</td>
            </tr>
          `;
        }).join('') || '<tr><td colspan="3">No odometer entries</td></tr>'}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2 class="section-title">⛽ Fuel Fills</h2>
    <p class="muted">
      Total fuel: ${fuelSummary?.litersTotal.toLocaleString() ?? '0'} L • Spend: ₹${fuelSummary?.spendTotal.toLocaleString() ?? '0'} • Est. distance: ${fuelSummary?.estimatedDistanceKm.toLocaleString() ?? '0'} km
    </p>
    ${
      fuelTotalsByType.length > 0
        ? `
    <p class="muted">
      Totals by fuel type:
      ${fuelTotalsByType
        .map(
          (r) =>
            `${r.fuel_type}: ${r.liters.toLocaleString()} L / ₹${r.spend.toLocaleString()}`
        )
        .join(' • ')}
    </p>
    `
        : ''
    }
    <table>
      <thead>
        <tr>
          <th>Date & Time</th>
          <th>Fuel Type</th>
          <th>Liters</th>
          <th>Amount (INR)</th>
          <th>Odometer</th>
          <th>Full Tank</th>
          <th>Est km/L</th>
          <th>Full-tank km/L</th>
          <th>Bills</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        ${(fuelEntriesAsc ?? [])
          .slice()
          .reverse()
          .map((fill) => {
            const est = fuelSummary?.estimatedPoints.find((p) => p.entryId === fill.id) ?? null;
            const full = fuelSummary?.fullTankSegments.find((s) => s.endEntryId === fill.id) ?? null;
            const bills = fuelEntryBillsByEntryId[fill.id] ?? [];

            const estText = est?.kmPerL != null ? est.kmPerL.toFixed(2) : '-';
            const fullText = full?.kmPerL != null ? full.kmPerL.toFixed(2) : '-';
            const billsText = bills.length > 0 ? `✓ ${bills.length} file${bills.length > 1 ? 's' : ''}` : '-';

            const fuelType = String((fill as any).fuel_type || 'unknown');
            return `
              <tr>
                <td>${formatDateTimeDMY(fill.filled_at)}</td>
                <td>${fuelType}</td>
                <td>${fill.fuel_liters.toLocaleString()}</td>
                <td class="cost">₹${fill.amount_inr.toLocaleString()}</td>
                <td>${fill.odometer_km.toLocaleString()} km</td>
                <td>${fill.is_full_tank ? '✓' : '-'}</td>
                <td>${estText}</td>
                <td>${fullText}</td>
                <td>${billsText}</td>
                <td>${fill.notes || '-'}</td>
              </tr>
            `;
          })
          .join('') || '<tr><td colspan="10">No fuel fills</td></tr>'}
      </tbody>
    </table>
  </div>

  ${exportFuelBillUrls.length > 0 ? `
  <div class="bill-images">
    <h2 class="section-title">📎 Fuel Bills (${exportFuelBillUrls.length} files)</h2>
    ${exportFuelBillUrls.map((bill) => bill.isPdf ? `
      <div class="bill-image">
        <p class="caption"><strong>${bill.date}</strong></p>
        <p><a href="${bill.url}" class="bill-link" target="_blank">📄 ${bill.fileName} (PDF - Click to View)</a></p>
      </div>
    ` : `
      <div class="bill-image">
        <img src="${bill.url}" alt="Fuel bill for ${bill.date}" />
        <p class="caption"><strong>${bill.date}</strong> - ${bill.fileName}</p>
      </div>
    `).join('')}
  </div>
  ` : ''}

  ${exportBillUrls.length > 0 ? `
  <div class="bill-images">
    <h2 class="section-title">📎 Service Bills (${exportBillUrls.length} files)</h2>
    ${exportBillUrls.map((bill) => bill.isPdf ? `
      <div class="bill-image">
        <p class="caption"><strong>${bill.serviceName}</strong> - ${bill.date}</p>
        <p><a href="${bill.url}" class="bill-link" target="_blank">📄 ${bill.fileName} (PDF - Click to View)</a></p>
      </div>
    ` : `
      <div class="bill-image">
        <img src="${bill.url}" alt="Service bill for ${bill.serviceName}" />
        <p class="caption"><strong>${bill.serviceName}</strong> - ${bill.date} - ${bill.fileName}</p>
      </div>
    `).join('')}
  </div>
  ` : ''}

  <div class="footer">
    <p>This report was generated from ServiceWise Fleet Management System.</p>
    <p>For showroom verification, all service records are authentic and verifiable.</p>
  </div>
</body>
</html>
    `;

    // Create and download the HTML file
    const blob = new Blob([reportHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${car.vehicle_number}-service-report-${formatDateDMY(new Date())}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (carLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!car) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">Vehicle not found</h2>
        <Button asChild>
          <Link to="/app/odometer">Back to Odometer</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in print:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/app/odometer">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="page-title flex items-center gap-2">
              <FileText className="h-6 w-6" />
              Vehicle Report
            </h1>
            <p className="text-muted-foreground">
              Complete history for {car.vehicle_number}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button onClick={handleExportDetailed}>
            <Download className="h-4 w-4 mr-2" />
            Export Full Report
          </Button>
        </div>
      </div>

      {/* Print Header (only visible on print) */}
      <div className="hidden print:block border-b-2 border-primary pb-4 mb-6">
        <h1 className="text-2xl font-bold">Vehicle Service Report</h1>
        <p className="text-muted-foreground">
          {car.vehicle_number} - {car.model} {car.year && `(${car.year})`}
        </p>
        <p className="text-sm text-muted-foreground">
          Generated on: {formatDateTimeDMY(new Date().toISOString())}
        </p>
      </div>

      {/* Vehicle Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="stat-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Car className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vehicle</p>
              <p className="font-semibold">{car.vehicle_number}</p>
            </div>
          </div>
        </Card>
        <Card className="stat-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10">
              <Gauge className="h-4 w-4 text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Current Odometer</p>
              <p className="font-semibold">{currentKm.toLocaleString()} km</p>
            </div>
          </div>
        </Card>
        <Card className="stat-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <Wrench className="h-4 w-4 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Services</p>
              <p className="font-semibold">{totalServices}</p>
            </div>
          </div>
        </Card>
        <Card className="stat-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <Calendar className="h-4 w-4 text-warning" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Cost</p>
              <p className="font-semibold">₹{totalServiceCost.toLocaleString()}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Service Records */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Complete Service History
          </CardTitle>
          <CardDescription>
            All service records with bills for showroom verification
          </CardDescription>
        </CardHeader>
        <CardContent>
          {servicesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : serviceRecords && serviceRecords.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Odometer</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="print:hidden">Bill</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {serviceRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDateDMY(record.serviced_at)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {record.service_name}
                      </TableCell>
                      <TableCell>{record.vendor_name || '-'}</TableCell>
                      <TableCell>{record.vendor_location || '-'}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {record.odometer_km.toLocaleString()} km
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-medium text-success">
                        {record.cost ? `₹${record.cost.toLocaleString()}` : '-'}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {record.notes || '-'}
                      </TableCell>
                      <TableCell className="print:hidden">
                        {billsByRecord && billsByRecord[record.id]?.length > 0 ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewBills(billsByRecord[record.id], record.service_name)}
                            disabled={billLoading}
                          >
                            {billLoading ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <ImageIcon className="h-3 w-3 mr-1" />
                                View {billsByRecord[record.id].length} Bill{billsByRecord[record.id].length > 1 ? 's' : ''}
                              </>
                            )}
                          </Button>
                        ) : record.bill_path ? (
                          <Badge variant="secondary">Legacy Bill</Badge>
                        ) : (
                          <Badge variant="muted">No Bill</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No service records found
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fuel History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FuelIcon className="h-5 w-5 text-warning" />
            Fuel Fill History
          </CardTitle>
          <CardDescription>
            Total fuel: {fuelSummary?.litersTotal != null ? fuelSummary.litersTotal.toLocaleString() : '0'} L • Spend: ₹{fuelSummary?.spendTotal != null ? fuelSummary.spendTotal.toLocaleString() : '0'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fuelLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : fuelEntriesAsc.length > 0 ? (
            <div className="space-y-4">
              {fuelTotalsByType.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {fuelTotalsByType.map((r) => (
                    <div key={r.fuel_type} className="p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className="capitalize">{r.fuel_type}</Badge>
                        <span className="text-xs text-muted-foreground">{r.avgPricePerL == null ? '—' : `₹${r.avgPricePerL.toFixed(2)}/L`}</span>
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        <div>{r.liters.toLocaleString()} L</div>
                        <div>₹{r.spend.toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Fuel Type</TableHead>
                    <TableHead className="text-right">Liters</TableHead>
                    <TableHead className="text-right">Amount (₹)</TableHead>
                    <TableHead className="text-right">Odometer (km)</TableHead>
                    <TableHead>Full Tank</TableHead>
                    <TableHead className="text-right">Est km/L</TableHead>
                    <TableHead className="text-right">Full-tank km/L</TableHead>
                    <TableHead>Bill</TableHead>
                    <TableHead className="max-w-xs">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...fuelEntriesAsc].reverse().map((fill) => (
                    <TableRow key={fill.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDateTimeDMY(fill.filled_at)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant="secondary" className="capitalize">
                          {String((fill as any).fuel_type || 'unknown')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {fill.fuel_liters.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap font-medium">
                        ₹{fill.amount_inr.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {fill.odometer_km.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={fill.is_full_tank ? 'success' : 'muted'}>
                          {fill.is_full_tank ? 'Yes' : 'No'}
                        </Badge>
                      </TableCell>
                      {(() => {
                        const est = fuelSummary?.estimatedPoints.find((p) => p.entryId === fill.id) ?? null;
                        const full = fuelSummary?.fullTankSegments.find((s) => s.endEntryId === fill.id) ?? null;
                        const estKmPerL = est?.kmPerL ?? null;
                        const fullKmPerL = full?.kmPerL ?? null;
                        const bills = fuelEntryBillsByEntryId[fill.id] ?? [];

                        return (
                          <>
                            <TableCell className="text-right whitespace-nowrap">
                              {estKmPerL == null ? <Badge variant="muted">N/A</Badge> : <Badge variant="secondary">{estKmPerL.toFixed(2)} km/L</Badge>}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              {fullKmPerL == null ? <Badge variant="muted">N/A</Badge> : <Badge variant="secondary">{fullKmPerL.toFixed(2)} km/L</Badge>}
                            </TableCell>
                            <TableCell>
                              {bills.length > 0 ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openFuelBillPreview(bills[0])}
                                  disabled={fuelBillsLoading || fuelBillPreviewLoading}
                                >
                                  View ({bills.length})
                                </Button>
                              ) : (
                                <Badge variant="muted">No bill</Badge>
                              )}
                            </TableCell>
                            <TableCell className="max-w-xs truncate">{fill.notes || '-'}</TableCell>
                          </>
                        );
                      })()}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No fuel fills recorded
            </div>
          )}
        </CardContent>
      </Card>

      {/* Odometer History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            Complete Odometer History
          </CardTitle>
          <CardDescription>
            All recorded odometer readings
          </CardDescription>
        </CardHeader>
        <CardContent>
          {odoLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : odometerEntries && odometerEntries.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Reading</TableHead>
                    <TableHead>Change from Previous</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {odometerEntries.map((entry, idx) => {
                    const prevEntry = odometerEntries[idx + 1];
                    const change = prevEntry ? entry.odometer_km - prevEntry.odometer_km : 0;
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-nowrap">
                          {formatDateTimeDMY(entry.reading_at)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {entry.odometer_km.toLocaleString()} km
                        </TableCell>
                        <TableCell>
                          {change > 0 ? (
                            <span className="text-success">+{change.toLocaleString()} km</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No odometer entries found
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bills Preview Dialog */}
      <Dialog open={!!selectedBills} onOpenChange={() => setSelectedBills(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Bills: {selectedBills?.serviceName}
            </DialogTitle>
          </DialogHeader>
          {selectedBills && (
            <div className="space-y-6">
              {billLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                selectedBills.bills.map((bill) => {
                  const url = billUrls[bill.id];
                  const isPdf = bill.file_type === 'application/pdf';
                  return (
                    <div key={bill.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isPdf ? (
                            <FileText className="h-4 w-4 text-destructive" />
                          ) : (
                            <ImageIcon className="h-4 w-4 text-primary" />
                          )}
                          <span className="font-medium">{bill.file_name}</span>
                        </div>
                        {url && (
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" asChild>
                              <a href={url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3 mr-1" />
                                Open
                              </a>
                            </Button>
                            <Button size="sm" asChild>
                              <a href={url} download={bill.file_name}>
                                <Download className="h-3 w-3 mr-1" />
                                Download
                              </a>
                            </Button>
                          </div>
                        )}
                      </div>
                      {url && !isPdf && (
                        <img
                          src={url}
                          alt={bill.file_name}
                          className="w-full rounded-lg border max-h-[500px] object-contain"
                        />
                      )}
                      {url && isPdf && (
                        <iframe
                          src={url}
                          className="w-full h-[500px] rounded-lg border"
                          title={bill.file_name}
                        />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Fuel bill preview dialog */}
      <Dialog
        open={fuelBillPreviewOpen}
        onOpenChange={(open) => {
          setFuelBillPreviewOpen(open);
          if (!open) {
            setFuelBillPreview(null);
            setFuelBillPreviewUrl(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {fuelBillPreview?.file_type?.startsWith('image/') ? (
                <ImageIcon className="h-5 w-5 text-primary" />
              ) : (
                <FileText className="h-5 w-5 text-destructive" />
              )}
              {fuelBillPreview?.file_name || 'Fuel Bill'}
            </DialogTitle>
          </DialogHeader>

          {fuelBillPreviewLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : fuelBillPreviewUrl && fuelBillPreview ? (
            <div className="space-y-4">
              {fuelBillPreview.file_type?.startsWith('image/') ? (
                <img
                  src={fuelBillPreviewUrl}
                  alt={fuelBillPreview.file_name}
                  className="w-full rounded-lg border max-h-[600px] object-contain"
                />
              ) : (
                <iframe
                  src={fuelBillPreviewUrl}
                  title={fuelBillPreview.file_name}
                  className="w-full h-[600px] rounded-lg border"
                />
              )}

              <div className="flex gap-2">
                <Button variant="outline" type="button" asChild>
                  <a href={fuelBillPreviewUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Open in new tab
                  </a>
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No preview available.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
