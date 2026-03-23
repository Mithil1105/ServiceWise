import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useServiceRecords } from '@/hooks/use-services';
import { useCars } from '@/hooks/use-cars';
import { useAssignedCarIdsForCurrentUser } from '@/hooks/use-car-assignments';
import { useServiceBillsByRecordIds, type ServiceBillFile } from '@/hooks/use-service-bills';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Wrench, Plus, Search, Loader2, Download, Calendar, ClipboardList, ExternalLink, FileText, Image as ImageIcon } from 'lucide-react';
import { formatDateDMY } from '@/lib/date';
import { formatCarLabel } from '@/lib/utils';
import { storageGetSignedUrl } from '@/lib/storage';
import { toFullKey } from '@/lib/storage-keys';
import { DialogDescription } from '@/components/ui/dialog';

export default function Services() {
  const [search, setSearch] = useState('');
  const [carFilter, setCarFilter] = useState<string>('all');

  const { data: serviceRecords, isLoading } = useServiceRecords();
  const { data: cars } = useCars();
  const { assignedCarIds } = useAssignedCarIdsForCurrentUser();

  const scopedCars = assignedCarIds
    ? (cars ?? []).filter((c) => assignedCarIds.includes(c.id))
    : (cars ?? []);
  const scopedRecords = assignedCarIds
    ? (serviceRecords ?? []).filter((r) => assignedCarIds.includes(r.car_id))
    : (serviceRecords ?? []);

  const filteredRecords = scopedRecords.filter((record) => {
    const car = scopedCars.find((c) => c.id === record.car_id);
    const matchesSearch =
      record.service_name.toLowerCase().includes(search.toLowerCase()) ||
      record.vendor_name?.toLowerCase().includes(search.toLowerCase()) ||
      car?.vehicle_number.toLowerCase().includes(search.toLowerCase());

    const matchesCar = carFilter === 'all' || record.car_id === carFilter;

    return matchesSearch && matchesCar;
  }) || [];

  const recordIds = useMemo(() => filteredRecords.map((r) => r.id), [filteredRecords]);
  const { data: billsByRecord } = useServiceBillsByRecordIds(recordIds);

  const [selectedRecord, setSelectedRecord] = useState<(typeof filteredRecords)[number] | null>(null);
  const [billUrls, setBillUrls] = useState<Record<string, string>>({});
  const [legacyBillUrl, setLegacyBillUrl] = useState<string | null>(null);
  const [billLoading, setBillLoading] = useState(false);
  const [addedByName, setAddedByName] = useState<string | null>(null);
  const [addedByLoading, setAddedByLoading] = useState(false);

  const selectedCar = useMemo(() => {
    if (!selectedRecord) return null;
    return scopedCars.find((c) => c.id === selectedRecord.car_id) ?? null;
  }, [selectedRecord, scopedCars]);

  useEffect(() => {
    let cancelled = false;
    const loadBills = async () => {
      if (!selectedRecord) return;
      setBillLoading(true);
      setLegacyBillUrl(null);
      try {
        const bills: ServiceBillFile[] = billsByRecord?.[selectedRecord.id] || [];
        const urls: Record<string, string> = {};
        for (const bill of bills) {
          try {
            const key = toFullKey('SERVICE_BILLS', bill.file_path);
            if (key) urls[bill.id] = await storageGetSignedUrl(key, 3600, undefined, 'service-bills');
          } catch (e) {
            // Signed URL generation failures should not block showing the rest of the dialog.
            // eslint-disable-next-line no-console
            console.error('Error loading service bill URL:', e);
          }
        }
        if (!cancelled) setBillUrls(urls);

        // Legacy fallback: older rows may store the bill directly on service_records.bill_path.
        if (!cancelled && bills.length === 0 && selectedRecord.bill_path) {
          try {
            const url = await storageGetSignedUrl(selectedRecord.bill_path, 3600, undefined, 'service-bills');
            setLegacyBillUrl(url);
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error('Error loading legacy service bill URL:', e);
          }
        }
      } finally {
        if (!cancelled) setBillLoading(false);
      }
    };

    loadBills();
    return () => {
      cancelled = true;
    };
  }, [selectedRecord, billsByRecord]);

  useEffect(() => {
    let cancelled = false;
    const loadAddedBy = async () => {
      if (!selectedRecord) {
        setAddedByName(null);
        return;
      }
      const enteredById = (selectedRecord as { entered_by?: string }).entered_by;
      if (!enteredById) {
        setAddedByName(null);
        return;
      }

      setAddedByLoading(true);
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', enteredById)
          .maybeSingle();

        if (!cancelled) setAddedByName(profile?.name ?? null);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Error loading added-by profile:', e);
        if (!cancelled) setAddedByName(null);
      } finally {
        if (!cancelled) setAddedByLoading(false);
      }
    };

    void loadAddedBy();
    return () => {
      cancelled = true;
    };
  }, [selectedRecord]);

  const carOptions = [
    { value: 'all', label: 'All Vehicles' },
    ...(scopedCars.map((car) => ({
      value: car.id,
      label: formatCarLabel(car),
    })) || []),
  ];

  const handleExportAll = () => {
    const headers = ['Date', 'Vehicle', 'Service', 'Vendor', 'Location', 'Cost (INR)', 'Odometer (km)'];
    const rows = filteredRecords.map((record) => {
      const car = scopedCars.find((c) => c.id === record.car_id);
      return [
        formatDateDMY(record.serviced_at),
        car ? formatCarLabel(car) : '',
        record.service_name,
        record.vendor_name || '',
        record.vendor_location || '',
        record.cost?.toString() || '',
        record.odometer_km.toString(),
      ];
    });

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `service-records-${formatDateDMY(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Services</h1>
          <p className="text-muted-foreground">Service records across all vehicles</p>
        </div>
        <Button asChild>
          <Link to="/app/services/new">
            <Plus className="h-4 w-4 mr-2" />
            Add Service Record
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by service, vendor, or vehicle..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <SearchableSelect
              options={carOptions}
              value={carFilter}
              onValueChange={setCarFilter}
              placeholder="Filter by vehicle"
              searchPlaceholder="Search vehicles..."
              triggerClassName="w-[200px]"
            />
            <Button variant="outline" onClick={handleExportAll}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Records Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Service Records ({filteredRecords.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRecords.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Odometer</TableHead>
                    <TableHead>Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record) => {
                    const car = scopedCars.find((c) => c.id === record.car_id);
                    return (
                      <TableRow
                        key={record.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedRecord(record)}
                        role="button"
                        tabIndex={0}
                      >
                        <TableCell>
                          {formatDateDMY(record.serviced_at)}
                        </TableCell>
                        <TableCell>
                          <Link
                            to={`/app/fleet/${record.car_id}`}
                            className="font-medium text-accent hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {car ? formatCarLabel(car) : 'Unknown'}
                          </Link>
                        </TableCell>
                        <TableCell className="font-medium">
                          {record.service_name}
                        </TableCell>
                        <TableCell>
                          {record.vendor_name || '-'}
                          {record.vendor_location && (
                            <span className="text-xs text-muted-foreground block">
                              {record.vendor_location}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{record.odometer_km.toLocaleString()} km</TableCell>
                        <TableCell>
                          {record.cost ? (
                            <span className="font-medium">₹{record.cost.toLocaleString()}</span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Wrench className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">No service records found</h3>
              <p className="text-muted-foreground mb-4">
                {search || carFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Add your first service record'}
              </p>
              {!search && carFilter === 'all' && (
                <Button asChild>
                  <Link to="/app/services/new">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Service Record
                  </Link>
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Service Details Dialog */}
      <Dialog open={!!selectedRecord} onOpenChange={(open) => { if (!open) setSelectedRecord(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          {selectedRecord && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Service Details
                </DialogTitle>
                <DialogDescription>
                  {formatDateDMY(selectedRecord.serviced_at)} - {selectedRecord.service_name}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Vehicle</p>
                    <p className="font-medium">{selectedCar?.vehicle_number ?? '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Added By</p>
                    <p className="font-medium">
                      {addedByLoading ? 'Loading...' : (addedByName ?? '-')}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Vendor</p>
                    <p className="font-medium">
                      {selectedRecord.vendor_name || '-'}
                      {selectedRecord.vendor_location ? ` (${selectedRecord.vendor_location})` : ''}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Cost</p>
                    <p className="font-medium">
                      {selectedRecord.cost ? `₹${selectedRecord.cost.toLocaleString()}` : '-'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Odometer</p>
                    <p className="font-medium">{selectedRecord.odometer_km.toLocaleString()} km</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Warranty Expiry</p>
                    <p className="font-medium">
                      {(selectedRecord as any).warranty_expiry || '-'}
                    </p>
                  </div>
                </div>

                {selectedRecord.notes && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Notes</p>
                    <p className="whitespace-pre-wrap">{selectedRecord.notes}</p>
                  </div>
                )}

                <div className="pt-2 border-t">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <p className="font-semibold">Bills</p>
                    {billsByRecord?.[selectedRecord.id]?.length ? (
                      <Badge variant="secondary">{billsByRecord[selectedRecord.id].length} file(s)</Badge>
                    ) : (
                      <Badge variant="muted">No bills</Badge>
                    )}
                  </div>

                  {billLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {(billsByRecord?.[selectedRecord.id] || []).map((bill) => {
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
                      })}
                      {(billsByRecord?.[selectedRecord.id] || []).length === 0 && (
                        legacyBillUrl ? (
                          <div className="border rounded-lg p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {selectedRecord.bill_path?.toLowerCase().includes('.pdf') ? (
                                  <FileText className="h-4 w-4 text-destructive" />
                                ) : (
                                  <ImageIcon className="h-4 w-4 text-primary" />
                                )}
                                <span className="font-medium">
                                  {selectedRecord.bill_path?.split('/').filter(Boolean).pop() || 'service-bill'}
                                </span>
                              </div>
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm" asChild>
                                  <a href={legacyBillUrl} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-3 w-3 mr-1" />
                                    Open
                                  </a>
                                </Button>
                                <Button size="sm" asChild>
                                  <a
                                    href={legacyBillUrl}
                                    download={selectedRecord.bill_path?.split('/').filter(Boolean).pop() || 'service-bill'}
                                  >
                                    <Download className="h-3 w-3 mr-1" />
                                    Download
                                  </a>
                                </Button>
                              </div>
                            </div>

                            {selectedRecord.bill_path?.toLowerCase().includes('.pdf') ? (
                              <iframe
                                src={legacyBillUrl}
                                className="w-full h-[500px] rounded-lg border"
                                title="Legacy service bill"
                              />
                            ) : (
                              <img
                                src={legacyBillUrl}
                                alt="Legacy service bill"
                                className="w-full rounded-lg border max-h-[500px] object-contain"
                              />
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-6 text-muted-foreground">No bills uploaded for this service.</div>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
