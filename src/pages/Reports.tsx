import { useState } from 'react';
import { useCars } from '@/hooks/use-cars';
import { useServiceRecords } from '@/hooks/use-services';
import { useOdometerEntries } from '@/hooks/use-odometer';
import { invokeAuthed } from '@/lib/functions-invoke';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { FileText, Download, CalendarIcon, Loader2 } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { DateRange } from 'react-day-picker';

export default function Reports() {
  const { data: cars } = useCars();
  const { data: serviceRecords } = useServiceRecords();
  const { data: odometerEntries } = useOdometerEntries();
  const { toast } = useToast();

  const [selectedCars, setSelectedCars] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [includeOdometer, setIncludeOdometer] = useState(false);
  const [includeExpenses, setIncludeExpenses] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(false);

  const handleSelectAllCars = () => {
    if (selectedCars.length === cars?.length) {
      setSelectedCars([]);
    } else {
      setSelectedCars(cars?.map((c) => c.id) || []);
    }
  };

  const handleToggleCar = (carId: string) => {
    setSelectedCars((prev) =>
      prev.includes(carId) ? prev.filter((id) => id !== carId) : [...prev, carId]
    );
  };

  const handleExportCSV = async () => {
    if (selectedCars.length === 0) {
      toast({
        title: 'No vehicles selected',
        description: 'Please select at least one vehicle to export.',
        variant: 'destructive',
      });
      return;
    }

    setIsExporting(true);

    try {
      const rows: string[][] = [];
      const headers = ['Date', 'Time', 'Vehicle', 'Type', 'Category/Service', 'Vendor', 'Amount (INR)', 'Odometer (km)', 'Notes', 'Source'];
      
      // Filter by selected cars and date range
      const filteredServices = serviceRecords?.filter((record) => {
        if (!selectedCars.includes(record.car_id)) return false;
        if (!dateRange?.from || !dateRange?.to) return true;
        const recordDate = new Date(record.serviced_at);
        return recordDate >= dateRange.from && recordDate <= dateRange.to;
      }) || [];

      // Add service records
      for (const record of filteredServices) {
        const car = cars?.find((c) => c.id === record.car_id);
        rows.push([
          format(new Date(record.serviced_at), 'yyyy-MM-dd'),
          '',
          car?.vehicle_number || '',
          'SERVICE',
          record.service_name,
          record.vendor_name || '',
          record.cost?.toString() || '',
          record.odometer_km.toString(),
          record.notes || '',
          'Fleet',
        ]);
      }

      // Add odometer entries if selected
      if (includeOdometer) {
        const filteredOdometer = odometerEntries?.filter((entry) => {
          if (!selectedCars.includes(entry.car_id)) return false;
          if (!dateRange?.from || !dateRange?.to) return true;
          const entryDate = new Date(entry.reading_at);
          return entryDate >= dateRange.from && entryDate <= dateRange.to;
        }) || [];

        for (const entry of filteredOdometer) {
          const car = cars?.find((c) => c.id === entry.car_id);
          rows.push([
            format(new Date(entry.reading_at), 'yyyy-MM-dd'),
            format(new Date(entry.reading_at), 'HH:mm'),
            car?.vehicle_number || '',
            'ODOMETER',
            'Odometer Update',
            '',
            '',
            entry.odometer_km.toString(),
            '',
            'Fleet',
          ]);
        }
      }

      // Fetch external expenses if selected
      if (includeExpenses) {
        setIsLoadingExpenses(true);
        for (const carId of selectedCars) {
          const car = cars?.find((c) => c.id === carId);
          if (!car) continue;

          try {
            const data = await invokeAuthed<{ expenses?: unknown[] }>('petty-expenses', {
              vehicle_number: car.vehicle_number,
              from: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined,
              to: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined,
            });

            if (data?.expenses) {
              for (const expense of data.expenses) {
                rows.push([
                  expense.date,
                  '',
                  car.vehicle_number,
                  'EXPENSE',
                  expense.category || '',
                  expense.vendor || '',
                  expense.amount?.toString() || '',
                  '',
                  expense.notes || '',
                  'PettyCash',
                ]);
              }
            }
          } catch (e) {
            // Continue without external expenses if edge function fails
            console.log('Could not fetch external expenses:', e);
          }
        }
        setIsLoadingExpenses(false);
      }

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
                        !dateRange && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, 'LLL dd, y')} -{' '}
                            {format(dateRange.to, 'LLL dd, y')}
                          </>
                        ) : (
                          format(dateRange.from, 'LLL dd, y')
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
                      onSelect={setDateRange}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
                <div className="flex gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setDateRange({
                        from: subDays(new Date(), 7),
                        to: new Date(),
                      })
                    }
                  >
                    Last 7 days
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setDateRange({
                        from: subDays(new Date(), 30),
                        to: new Date(),
                      })
                    }
                  >
                    Last 30 days
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setDateRange({
                        from: startOfMonth(new Date()),
                        to: endOfMonth(new Date()),
                      })
                    }
                  >
                    This month
                  </Button>
                </div>
              </div>

              {/* Data Types */}
              <div className="space-y-3">
                <Label>Include Data Types</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="services" checked disabled />
                    <label
                      htmlFor="services"
                      className="text-sm font-medium leading-none"
                    >
                      Service Records (always included)
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
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Export Button */}
          <Button
            size="lg"
            className="w-full"
            onClick={handleExportCSV}
            disabled={isExporting || selectedCars.length === 0}
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
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Select Vehicles</CardTitle>
              <Button variant="ghost" size="sm" onClick={handleSelectAllCars}>
                {selectedCars.length === cars?.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            <CardDescription>
              {selectedCars.length} of {cars?.length || 0} selected
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {cars?.map((car) => (
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
                    <p className="text-sm font-medium">{car.vehicle_number}</p>
                    <p className="text-xs text-muted-foreground">{car.model}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
