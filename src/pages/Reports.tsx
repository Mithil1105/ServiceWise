import { useState } from 'react';
import { useCars } from '@/hooks/use-cars';
import { useAssignedCarIdsForCurrentUser } from '@/hooks/use-car-assignments';
import { useServiceRecords } from '@/hooks/use-services';
import { useOdometerEntries } from '@/hooks/use-odometer';
import { useTrafficChallans } from '@/hooks/use-traffic-challans';
import { useIncidents } from '@/hooks/use-incidents';
import { useDowntimeLogs } from '@/hooks/use-downtime';
import { supabase } from '@/integrations/supabase/client';
import { invokeAuthed } from '@/lib/functions-invoke';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import * as TableUI from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FileText, Download, CalendarIcon, Loader2, User, Receipt } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { formatDateDMY } from '@/lib/date';
import { cn, formatCarLabel } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { DateRange } from 'react-day-picker';

export default function Reports() {
  const { data: cars } = useCars();
  const { data: serviceRecords } = useServiceRecords();
  const { data: odometerEntries } = useOdometerEntries();
  const { assignedCarIds } = useAssignedCarIdsForCurrentUser();
  const { toast } = useToast();

  const scopedCars = assignedCarIds
    ? (cars ?? []).filter((c) => assignedCarIds.includes(c.id))
    : (cars ?? []);
  const scopedServiceRecords = assignedCarIds
    ? (serviceRecords ?? []).filter((r) => assignedCarIds.includes(r.car_id))
    : (serviceRecords ?? []);
  const scopedOdometerEntries = assignedCarIds
    ? (odometerEntries ?? []).filter((e) => assignedCarIds.includes(e.car_id))
    : (odometerEntries ?? []);

  const [selectedCars, setSelectedCars] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [includeServices, setIncludeServices] = useState(true);
  const [includeOdometer, setIncludeOdometer] = useState(false);
  const [includeExpenses, setIncludeExpenses] = useState(false);
  const [includeIncidents, setIncludeIncidents] = useState(false);
  const [includeDowntime, setIncludeDowntime] = useState(false);
  const [includeChallans, setIncludeChallans] = useState(false);
  const [exportFullTimeData, setExportFullTimeData] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(false);

  const challanStart = dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined;
  const challanEnd = dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') + 'T23:59:59.999Z' : undefined;
  const challanDateFilter =
    exportFullTimeData || !challanStart || !challanEnd
      ? undefined
      : { startDate: challanStart + 'T00:00:00.000Z', endDate: challanEnd };
  const { data: trafficChallans = [] } = useTrafficChallans(challanDateFilter);

  const incidentStart = dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') + 'T00:00:00.000Z' : undefined;
  const incidentEnd = dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') + 'T23:59:59.999Z' : undefined;
  const incidentFilters =
    exportFullTimeData || !incidentStart || !incidentEnd
      ? undefined
      : { startDate: incidentStart, endDate: incidentEnd };
  const { data: incidentsRaw = [] } = useIncidents(incidentFilters);
  const scopedIncidents = assignedCarIds
    ? (incidentsRaw ?? []).filter((i) => assignedCarIds.includes(i.car_id))
    : (incidentsRaw ?? []);
  const { data: downtimeLogsRaw = [] } = useDowntimeLogs();
  const scopedDowntimeLogs = assignedCarIds
    ? (downtimeLogsRaw ?? []).filter((d) => assignedCarIds.includes(d.car_id))
    : (downtimeLogsRaw ?? []);

  const handleSelectAllCars = () => {
    setSelectedCars(scopedCars.map((c) => c.id));
  };

  const handleClearCars = () => {
    setSelectedCars([]);
  };

  const handleReverseCars = () => {
    const allIds = scopedCars.map((c) => c.id);
    setSelectedCars(allIds.filter((id) => !selectedCars.includes(id)));
  };

  const handleToggleCar = (carId: string) => {
    setSelectedCars((prev) =>
      prev.includes(carId) ? prev.filter((id) => id !== carId) : [...prev, carId]
    );
  };

  const hasAtLeastOneDataType =
    includeServices || includeOdometer || includeExpenses || includeIncidents || includeDowntime || includeChallans;

  const handleExportCSV = async () => {
    if (selectedCars.length === 0) {
      toast({
        title: 'No vehicles selected',
        description: 'Please select at least one vehicle to export.',
        variant: 'destructive',
      });
      return;
    }
    if (!hasAtLeastOneDataType) {
      toast({
        title: 'No data types selected',
        description: 'Select at least one data type to include in the export.',
        variant: 'destructive',
      });
      return;
    }

    setIsExporting(true);

    try {
      const rows: string[][] = [];
      const headers = [
        'Date',
        'Time',
        'Vehicle',
        'Record Type',
        'Driver Name',
        'Created By',
        'Service Name',
        'Category / Service',
        'Vendor Name',
        'Vendor Location',
        'Amount (₹)',
        'Odometer (km)',
        'Notes',
        'Bill / Invoice Path',
        'Serial Number',
        'Warranty Expiry',
        'Custom Attributes',
        'Source',
      ];
      const emptyRow = (): string[] => headers.map(() => '');
      const formatLabel = (s: string) =>
        (s || '')
          .trim()
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());

      // Date-only comparison (avoids timezone boundary issues). When export full time, no date filter.
      const fromStr = exportFullTimeData ? '' : (dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : '');
      const toStr = exportFullTimeData ? '' : (dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : '');
      const inDateRange = (dateStrOrDate: string | Date) => {
        if (!fromStr || !toStr) return true;
        const d = format(typeof dateStrOrDate === 'string' ? new Date(dateStrOrDate) : dateStrOrDate, 'yyyy-MM-dd');
        return d >= fromStr && d <= toStr;
      };

      // Collect user IDs for "Added By" and fetch profile names (avoid logout by not refreshing during export)
      const userIds = new Set<string>();
      if (includeServices) {
        scopedServiceRecords.forEach((r) => {
          if (selectedCars.includes(r.car_id) && inDateRange(r.serviced_at) && (r as { entered_by?: string }).entered_by) {
            userIds.add((r as { entered_by: string }).entered_by);
          }
        });
      }
      if (includeIncidents) {
        scopedIncidents.forEach((r) => {
          if (selectedCars.includes(r.car_id) && inDateRange(r.incident_at) && r.created_by) userIds.add(r.created_by);
        });
      }
      if (includeDowntime) {
        scopedDowntimeLogs.forEach((r) => {
          if (selectedCars.includes(r.car_id) && inDateRange(r.started_at) && (r as { created_by?: string }).created_by) {
            userIds.add((r as { created_by: string }).created_by);
          }
        });
      }
      if (includeChallans) {
        (trafficChallans as { car_id: string; incident_at: string; created_by?: string }[]).forEach((c) => {
          if (selectedCars.includes(c.car_id) && inDateRange(c.incident_at) && c.created_by) userIds.add(c.created_by);
        });
      }
      let profileMap: Record<string, string> = {};
      if (userIds.size > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', Array.from(userIds));
        profileMap = (profiles || []).reduce((acc, p) => ({ ...acc, [p.id]: p.name }), {});
      }

      const getAddedBy = (userId: string | null | undefined) => (userId ? profileMap[userId] ?? '' : '');

      // Add service records (if selected) — full form fields + driver N/A, added by
      if (includeServices) {
        const filteredServices = scopedServiceRecords.filter((record) => {
          if (!selectedCars.includes(record.car_id)) return false;
          return inDateRange(record.serviced_at);
        });
        for (const record of filteredServices) {
          const car = scopedCars.find((c) => c.id === record.car_id);
          const r = record as Record<string, unknown>;
          const customAttrs = r.custom_attributes && typeof r.custom_attributes === 'object'
            ? JSON.stringify(r.custom_attributes)
            : '';
          const row = emptyRow();
          row[0] = formatDateDMY(record.serviced_at);
          row[1] = '';
          row[2] = car ? formatCarLabel(car) : '';
          row[3] = 'Service';
          row[4] = '';
          row[5] = getAddedBy((record as { entered_by?: string }).entered_by);
          row[6] = record.service_name;
          row[7] = record.service_name;
          row[8] = record.vendor_name || '';
          row[9] = (record as { vendor_location?: string }).vendor_location || '';
          row[10] = record.cost?.toString() ?? '';
          row[11] = record.odometer_km.toString();
          row[12] = record.notes || '';
          row[13] = (record as { bill_path?: string }).bill_path || '';
          row[14] = (record as { serial_number?: string }).serial_number || '';
          row[15] = (record as { warranty_expiry?: string }).warranty_expiry || '';
          row[16] = customAttrs;
          row[17] = 'Fleet';
          rows.push(row);
        }
      }

      // Add odometer entries if selected
      if (includeOdometer) {
        const filteredOdometer = scopedOdometerEntries.filter((entry) => {
          if (!selectedCars.includes(entry.car_id)) return false;
          return inDateRange(entry.reading_at);
        });
        for (const entry of filteredOdometer) {
          const car = scopedCars.find((c) => c.id === entry.car_id);
          const row = emptyRow();
          row[0] = formatDateDMY(entry.reading_at);
          row[1] = format(new Date(entry.reading_at), 'HH:mm');
          row[2] = car ? formatCarLabel(car) : '';
          row[3] = 'Odometer Entry';
          row[11] = entry.odometer_km.toString();
          row[17] = 'Fleet';
          rows.push(row);
        }
      }

      // Fetch external expenses if selected — skip refresh to avoid logout; only call if session exists
      if (includeExpenses) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          setIsLoadingExpenses(true);
          for (const carId of selectedCars) {
            const car = scopedCars.find((c) => c.id === carId);
            if (!car) continue;
            try {
              const data = await invokeAuthed<{ expenses?: unknown[] }>(
                'petty-expenses',
                {
                  vehicle_number: car.vehicle_number,
                  from: exportFullTimeData ? undefined : (dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined),
                  to: exportFullTimeData ? undefined : (dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined),
                },
                { skipRefresh: true }
              );
              if (data?.expenses) {
                for (const expense of data.expenses as { date?: string; category?: string; vendor?: string; amount?: number; notes?: string }[]) {
                  const row = emptyRow();
                  row[0] = expense.date ?? '';
                  row[2] = car.vehicle_number;
                  row[3] = 'External Expense (Petty Cash)';
                  row[7] = expense.category ?? '';
                  row[8] = expense.vendor ?? '';
                  row[10] = expense.amount?.toString() ?? '';
                  row[12] = expense.notes ?? '';
                  row[17] = 'Petty Cash';
                  rows.push(row);
                }
              }
            } catch (e) {
              console.log('Could not fetch external expenses:', e);
            }
          }
          setIsLoadingExpenses(false);
        }
      }

      // Incidents (if selected) — driver name, added by
      if (includeIncidents) {
        const filteredIncidents = scopedIncidents.filter(
          (record) => selectedCars.includes(record.car_id) && inDateRange(record.incident_at)
        );
        for (const record of filteredIncidents) {
          const car = scopedCars.find((c) => c.id === record.car_id);
          const notes = [record.description, `Severity: ${record.severity}`, record.resolved ? 'Resolved' : 'Open']
            .filter(Boolean)
            .join('; ');
          const row = emptyRow();
          row[0] = formatDateDMY(record.incident_at);
          row[1] = format(new Date(record.incident_at), 'HH:mm');
          row[2] = car ? formatCarLabel(car) : '';
          row[3] = 'Incident';
          row[4] = record.driver_name || '';
          row[5] = getAddedBy(record.created_by);
          row[7] = formatLabel(record.type || '');
          row[10] = record.cost?.toString() ?? '';
          row[12] = notes;
          row[17] = 'Fleet';
          rows.push(row);
        }
      }

      // Downtime logs (if selected) — added by
      if (includeDowntime) {
        const filteredDowntime = scopedDowntimeLogs.filter(
          (record) => selectedCars.includes(record.car_id) && inDateRange(record.started_at)
        );
        for (const record of filteredDowntime) {
          const car = scopedCars.find((c) => c.id === record.car_id);
          const endStr = record.ended_at ? formatDateDMY(record.ended_at) : 'Ongoing';
          const row = emptyRow();
          row[0] = formatDateDMY(record.started_at);
          row[1] = format(new Date(record.started_at), 'HH:mm');
          row[2] = car ? formatCarLabel(car) : '';
          row[3] = 'Downtime';
          row[5] = getAddedBy((record as { created_by?: string }).created_by);
          row[7] = formatLabel(record.reason || '');
          row[12] = [record.notes, `Ended: ${endStr}`].filter(Boolean).join('; ');
          row[17] = 'Fleet';
          rows.push(row);
        }
      }

      // Traffic challans (if selected) — driver name
      if (includeChallans) {
        const filteredChallans = (trafficChallans as { car_id: string; incident_at: string; driver_name?: string | null; amount?: number; challan_types?: { name: string } | null; description?: string | null; created_by?: string }[]).filter(
          (c) => selectedCars.includes(c.car_id) && inDateRange(c.incident_at)
        );
        for (const c of filteredChallans) {
          const car = scopedCars.find((x) => x.id === c.car_id);
          const typeName = formatLabel(c.challan_types?.name ?? '');
          const row = emptyRow();
          row[0] = formatDateDMY(c.incident_at);
          row[1] = format(new Date(c.incident_at), 'HH:mm');
          row[2] = car ? formatCarLabel(car) : '';
          row[3] = 'Traffic Challan';
          row[4] = c.driver_name ?? '';
          row[5] = c.created_by ? getAddedBy(c.created_by) : '';
          row[7] = typeName;
          row[10] = (c.amount ?? 0).toString();
          row[12] = (c.description || '').trim();
          row[17] = 'Fleet';
          rows.push(row);
        }
      }

      if (rows.length === 0) {
        toast({
          title: 'No records found',
          description:
            "No data matched the selected vehicles and options. Try selecting 'All time' for date range, or enable more data types (e.g. Service Records, Incidents).",
          variant: 'destructive',
        });
      } else {
        // Sort by date descending
        rows.sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());

        // Generate CSV
        const csv = [headers, ...rows]
          .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
          .join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fleet-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        toast({
          title: 'Export complete',
          description: `Exported ${rows.length} records to CSV.`,
        });
      }
    } catch (error) {
      toast({
        title: 'Export failed',
        description: 'An error occurred while exporting.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Reports & Exports
          </h1>
          <p className="text-muted-foreground">
            Export service history and fleet data
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Export Options */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Export Configuration</CardTitle>
              <CardDescription>
                Select vehicles, date range, and data types to include
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Date Range */}
              <div className="space-y-2">
                <Label>Date Range</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !dateRange && !exportFullTimeData && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {exportFullTimeData ? (
                        <span>All time</span>
                      ) : dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {formatDateDMY(dateRange.from)} -{' '}
                            {formatDateDMY(dateRange.to)}
                          </>
                        ) : (
                          formatDateDMY(dateRange.from)
                        )
                      ) : (
                        <span>Pick a date range</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={(range) => {
                        setDateRange(range);
                        if (range?.from) setExportFullTimeData(false);
                      }}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExportFullTimeData(true)}
                    className={exportFullTimeData ? 'bg-accent' : undefined}
                  >
                    All time
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setExportFullTimeData(false);
                      setDateRange({
                        from: subDays(new Date(), 7),
                        to: new Date(),
                      });
                    }}
                  >
                    Last 7 days
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setExportFullTimeData(false);
                      setDateRange({
                        from: subDays(new Date(), 30),
                        to: new Date(),
                      });
                    }}
                  >
                    Last 30 days
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setExportFullTimeData(false);
                      setDateRange({
                        from: startOfMonth(new Date()),
                        to: endOfMonth(new Date()),
                      });
                    }}
                  >
                    This month
                  </Button>
                </div>
              </div>

              {/* Data Types */}
              <div className="space-y-3">
                <Label>Include Data Types</Label>
                <p className="text-xs text-muted-foreground">Select at least one type to export.</p>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="services"
                      checked={includeServices}
                      onCheckedChange={(checked) => setIncludeServices(!!checked)}
                    />
                    <label htmlFor="services" className="text-sm font-medium leading-none">
                      Service Records
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="odometer"
                      checked={includeOdometer}
                      onCheckedChange={(checked) => setIncludeOdometer(!!checked)}
                    />
                    <label
                      htmlFor="odometer"
                      className="text-sm font-medium leading-none"
                    >
                      Odometer Entries
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="expenses"
                      checked={includeExpenses}
                      onCheckedChange={(checked) => setIncludeExpenses(!!checked)}
                    />
                    <label
                      htmlFor="expenses"
                      className="text-sm font-medium leading-none"
                    >
                      External Expenses (Petty Cash)
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="incidents"
                      checked={includeIncidents}
                      onCheckedChange={(checked) => setIncludeIncidents(!!checked)}
                    />
                    <label htmlFor="incidents" className="text-sm font-medium leading-none">
                      Incidents
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="downtime"
                      checked={includeDowntime}
                      onCheckedChange={(checked) => setIncludeDowntime(!!checked)}
                    />
                    <label htmlFor="downtime" className="text-sm font-medium leading-none">
                      Downtime
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="challans"
                      checked={includeChallans}
                      onCheckedChange={(checked) => setIncludeChallans(!!checked)}
                    />
                    <label htmlFor="challans" className="text-sm font-medium leading-none">
                      Traffic challans
                    </label>
                  </div>
                </div>
              </div>

              {/* Export all data (no date filter) */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="exportFullTime"
                    checked={exportFullTimeData}
                    onCheckedChange={(checked) => setExportFullTimeData(!!checked)}
                  />
                  <label htmlFor="exportFullTime" className="text-sm font-medium leading-none">
                    Export all data (ignore date range)
                  </label>
                </div>
                {exportFullTimeData && (
                  <p className="text-xs text-muted-foreground">
                    All records for selected vehicles will be included regardless of date range.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Export Button */}
          <Button
            size="lg"
            className="w-full"
            onClick={handleExportCSV}
            disabled={isExporting || selectedCars.length === 0 || !hasAtLeastOneDataType}
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {isLoadingExpenses ? 'Fetching expenses...' : 'Generating...'}
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export to CSV
              </>
            )}
          </Button>
        </div>

        {/* Vehicle Selection */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Select Vehicles</CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={handleSelectAllCars}>
                  Select All
                </Button>
                <Button variant="ghost" size="sm" onClick={handleClearCars}>
                  Clear
                </Button>
                <Button variant="ghost" size="sm" onClick={handleReverseCars}>
                  Reverse
                </Button>
              </div>
            </div>
            <CardDescription>
              {selectedCars.length} of {scopedCars.length} selected
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {scopedCars.map((car) => (
                <div
                  key={car.id}
                  className={cn(
                    'flex items-center space-x-3 p-2 rounded-lg cursor-pointer transition-colors',
                    selectedCars.includes(car.id) ? 'bg-accent/10' : 'hover:bg-muted/50'
                  )}
                  onClick={() => handleToggleCar(car.id)}
                >
                  <Checkbox
                    checked={selectedCars.includes(car.id)}
                    onCheckedChange={() => handleToggleCar(car.id)}
                  />
                  <div>
                    <p className="text-sm font-medium">{formatCarLabel(car)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Challan reports */}
      <div className="space-y-6">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Traffic challan reports
        </h2>
        <p className="text-sm text-muted-foreground">
          Based on date range above. Log Traffic Challan incidents from the Incidents page to see data here.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Troublesome drivers
              </CardTitle>
              <CardDescription>
                Drivers with traffic challans in the selected period (count and total fines)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const byDriver = new Map<string, { name: string; phone: string; count: number; total: number }>();
                for (const c of trafficChallans) {
                  const key = (c.driver_phone || c.driver_name || 'Unknown').trim() || 'Unknown';
                  const cur = byDriver.get(key);
                  const amount = Number(c.amount) || 0;
                  if (cur) {
                    cur.count += 1;
                    cur.total += amount;
                  } else {
                    byDriver.set(key, {
                      name: (c.driver_name || '—').trim() || '—',
                      phone: (c.driver_phone || '—').trim() || '—',
                      count: 1,
                      total: amount,
                    });
                  }
                }
                const rows = Array.from(byDriver.entries())
                  .map(([_, v]) => v)
                  .sort((a, b) => b.count - a.count);
                if (rows.length === 0) {
                  return <p className="text-sm text-muted-foreground">No challans in this period.</p>;
                }
                return (
                  <TableUI.Table>
                    <TableUI.TableHeader>
                      <TableUI.TableRow>
                        <TableUI.TableHead>Driver</TableUI.TableHead>
                        <TableUI.TableHead>Phone</TableUI.TableHead>
                        <TableUI.TableHead className="text-right">Challans</TableUI.TableHead>
                        <TableUI.TableHead className="text-right">Total fines (₹)</TableUI.TableHead>
                      </TableUI.TableRow>
                    </TableUI.TableHeader>
                    <TableUI.TableBody>
                      {rows.map((r, i) => (
                        <TableUI.TableRow key={i}>
                          <TableUI.TableCell>{r.name}</TableUI.TableCell>
                          <TableUI.TableCell>{r.phone}</TableUI.TableCell>
                          <TableUI.TableCell className="text-right">{r.count}</TableUI.TableCell>
                          <TableUI.TableCell className="text-right">{r.total.toLocaleString('en-IN')}</TableUI.TableCell>
                        </TableUI.TableRow>
                      ))}
                    </TableUI.TableBody>
                  </TableUI.Table>
                );
              })()}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Total fines in challans
              </CardTitle>
              <CardDescription>
                Summary by challan type and overall total
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const byType = new Map<string, { name: string; count: number; total: number }>();
                let grandTotal = 0;
                for (const c of trafficChallans) {
                  const typeName = (c as { challan_types?: { name: string } | null }).challan_types?.name ?? 'Other';
                  const cur = byType.get(typeName);
                  const amount = Number(c.amount) || 0;
                  grandTotal += amount;
                  if (cur) {
                    cur.count += 1;
                    cur.total += amount;
                  } else {
                    byType.set(typeName, { name: typeName, count: 1, total: amount });
                  }
                }
                const rows = Array.from(byType.entries()).map(([_, v]) => v).sort((a, b) => b.total - a.total);
                if (rows.length === 0) {
                  return <p className="text-sm text-muted-foreground">No challans in this period.</p>;
                }
                return (
                  <div className="space-y-4">
                    <p className="text-sm font-medium">
                      Total fines (period): ₹{grandTotal.toLocaleString('en-IN')}
                    </p>
                    <TableUI.Table>
                      <TableUI.TableHeader>
                        <TableUI.TableRow>
                          <TableUI.TableHead>Challan type</TableUI.TableHead>
                          <TableUI.TableHead className="text-right">Count</TableUI.TableHead>
                          <TableUI.TableHead className="text-right">Total (₹)</TableUI.TableHead>
                        </TableUI.TableRow>
                      </TableUI.TableHeader>
                      <TableUI.TableBody>
                        {rows.map((r, i) => (
                          <TableUI.TableRow key={i}>
                            <TableUI.TableCell>{r.name}</TableUI.TableCell>
                            <TableUI.TableCell className="text-right">{r.count}</TableUI.TableCell>
                            <TableUI.TableCell className="text-right">{r.total.toLocaleString('en-IN')}</TableUI.TableCell>
                          </TableUI.TableRow>
                        ))}
                      </TableUI.TableBody>
                    </TableUI.Table>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
