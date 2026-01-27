import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useCar } from '@/hooks/use-cars';
import { useOdometerEntries, useLatestOdometer } from '@/hooks/use-odometer';
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
} from 'lucide-react';
import { formatDateDMY, formatDateTimeDMY } from '@/lib/date';
import { supabase } from '@/integrations/supabase/client';

export default function VehicleReport() {
  const { id } = useParams<{ id: string }>();
  const { data: car, isLoading: carLoading } = useCar(id!);
  const { data: latestOdo } = useLatestOdometer(id!);
  const { data: odometerEntries, isLoading: odoLoading } = useOdometerEntries(id);
  const { data: serviceRecords, isLoading: servicesLoading } = useServiceRecords(id);

  const recordIds = useMemo(() => serviceRecords?.map((r) => r.id) || [], [serviceRecords]);
  const { data: billsByRecord } = useServiceBillsByRecordIds(recordIds);

  const [selectedBills, setSelectedBills] = useState<{ bills: ServiceBillFile[]; serviceName: string } | null>(null);
  const [billUrls, setBillUrls] = useState<Record<string, string>>({});
  const [billLoading, setBillLoading] = useState(false);

  const currentKm = latestOdo?.odometer_km || 0;
  const totalServices = serviceRecords?.length || 0;
  const totalServiceCost = serviceRecords?.reduce((sum, r) => sum + (r.cost || 0), 0) || 0;

  const handleViewBills = async (bills: ServiceBillFile[], serviceName: string) => {
    setBillLoading(true);
    setSelectedBills({ bills, serviceName });
    
    const urls: Record<string, string> = {};
    for (const bill of bills) {
      try {
        const { data, error } = await supabase.storage
          .from('service-bills')
          .createSignedUrl(bill.file_path, 3600);
        if (!error && data?.signedUrl) {
          urls[bill.id] = data.signedUrl;
        }
      } catch (e) {
        console.error('Error loading bill:', e);
      }
    }
    setBillUrls(urls);
    setBillLoading(false);
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
          const { data } = await supabase.storage
            .from('service-bills')
            .createSignedUrl(bill.file_path, 86400); // 24 hours
          
          if (data?.signedUrl) {
            exportBillUrls.push({
              serviceName: record.service_name,
              date: formatDateDMY(record.serviced_at),
              url: data.signedUrl,
              fileName: bill.file_name,
              isPdf: bill.file_type === 'application/pdf',
            });
          }
        } catch (e) {
          console.error('Error getting bill URL:', e);
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
          <Link to="/odometer">Back to Odometer</Link>
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
            <Link to="/odometer">
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
    </div>
  );
}
