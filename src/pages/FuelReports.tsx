import { useMemo, useState } from 'react';
import { Download, Fuel as FuelIcon, Loader2, ShieldCheck } from 'lucide-react';
import { startOfMonth, endOfMonth } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import * as TableUI from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useCars } from '@/hooks/use-cars';
import { useAssignedCarIdsForCurrentUser } from '@/hooks/use-car-assignments';
import { useFuelEntries, useFuelEntryBillsByFuelEntryIds } from '@/hooks/use-fuel';
import { computeFuelMileageForCar } from '@/lib/fuel-mileage';
import { formatCarLabel } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { FuelEntryBill } from '@/types';
import { useAuth } from '@/lib/auth-context';
import { storageGetSignedUrl } from '@/lib/storage';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegendContent, ChartLegend } from '@/components/ui/chart';
import { formatDateTimeDMY } from '@/lib/date';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Bar, ComposedChart, Line } from 'recharts';
import { XAxis, YAxis, CartesianGrid } from 'recharts';

function toIsoStartOfDay(dateStr: string) {
  // treat dateStr as local date; convert to UTC ISO for DB query
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toISOString();
}

function toIsoEndOfDay(dateStr: string) {
  const d = new Date(`${dateStr}T23:59:59.999`);
  return d.toISOString();
}

export default function FuelReports() {
  const { isAdmin, isFuelFiller, isManager, isSupervisor } = useAuth();
  const canViewFuelReports = isFuelFiller || isAdmin || isManager || isSupervisor;
  const { toast } = useToast();
  const showAccessRestricted = !canViewFuelReports;
  const { data: cars } = useCars();
  const { assignedCarIds, isRestricted } = useAssignedCarIdsForCurrentUser();

  const scopedCars = useMemo(() => {
    if (!cars) return [];
    if (assignedCarIds) return cars.filter((c) => assignedCarIds.includes(c.id));
    return cars;
  }, [cars, assignedCarIds]);

  const [exportFullTimeData, setExportFullTimeData] = useState(false);
  const [fromDate, setFromDate] = useState(() => {
    const d = startOfMonth(new Date());
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => endOfMonth(new Date()).toISOString().slice(0, 10));
  const [carFilterId, setCarFilterId] = useState<string>('all');
  const [fuelTypeFilter, setFuelTypeFilter] = useState<string>('all');
  const [timelineSearch, setTimelineSearch] = useState('');

  const fromIso = exportFullTimeData || !fromDate ? undefined : toIsoStartOfDay(fromDate);
  const toIso = exportFullTimeData || !toDate ? undefined : toIsoEndOfDay(toDate);

  const { data: fuelEntriesRaw = [], isLoading } = useFuelEntries({
    carId: carFilterId === 'all' ? undefined : carFilterId,
    from: fromIso,
    to: toIso,
  });

  const scopedFuelEntries = useMemo(() => {
    if (!isRestricted || !assignedCarIds) return fuelEntriesRaw;
    const allowed = new Set(assignedCarIds);
    return fuelEntriesRaw.filter((e) => allowed.has(e.car_id));
  }, [fuelEntriesRaw, isRestricted, assignedCarIds]);

  const fuelEntries = useMemo(() => {
    if (fuelTypeFilter === 'all') return scopedFuelEntries;
    return scopedFuelEntries.filter((e) => String((e as any).fuel_type || '').toLowerCase() === fuelTypeFilter);
  }, [scopedFuelEntries, fuelTypeFilter]);

  const carById = useMemo(() => {
    const map = new Map<string, (typeof scopedCars)[number]>();
    for (const car of scopedCars) map.set(car.id, car);
    if (cars) {
      for (const car of cars) {
        if (!map.has(car.id)) map.set(car.id, car);
      }
    }
    return map;
  }, [scopedCars, cars]);

  const perCar = useMemo(() => {
    const grouped = new Map<string, typeof fuelEntries>();
    for (const e of fuelEntries) {
      if (!grouped.has(e.car_id)) grouped.set(e.car_id, []);
      grouped.get(e.car_id)!.push(e);
    }

    const summaries = Array.from(grouped.entries()).map(([carId, entriesDesc]) => {
      const entriesAsc = [...entriesDesc].sort((a, b) => new Date(a.filled_at).getTime() - new Date(b.filled_at).getTime());
      return computeFuelMileageForCar(entriesAsc);
    });

    return summaries;
  }, [fuelEntries]);

  const overall = useMemo(() => {
    const litersTotal = perCar.reduce((sum, s) => sum + s.litersTotal, 0);
    const spendTotal = perCar.reduce((sum, s) => sum + s.spendTotal, 0);
    const distanceTotal = perCar.reduce((sum, s) => sum + s.estimatedDistanceKm, 0);
    const costPerKm = distanceTotal > 0 ? spendTotal / distanceTotal : null;
    const avgPricePerL = litersTotal > 0 ? spendTotal / litersTotal : null;

    return { litersTotal, spendTotal, distanceTotal, costPerKm, avgPricePerL };
  }, [perCar]);

  const byFuelType = useMemo(() => {
    const map = new Map<string, { liters: number; spend: number }>();
    for (const e of fuelEntries) {
      const t = String((e as any).fuel_type || 'unknown').trim().toLowerCase();
      if (!map.has(t)) map.set(t, { liters: 0, spend: 0 });
      const cur = map.get(t)!;
      cur.liters += Number(e.fuel_liters) || 0;
      cur.spend += Number(e.amount_inr) || 0;
    }
    return Array.from(map.entries())
      .map(([fuel_type, v]) => ({
        fuel_type,
        liters: v.liters,
        spend: v.spend,
        avgPricePerL: v.liters > 0 ? v.spend / v.liters : null,
      }))
      .sort((a, b) => b.spend - a.spend);
  }, [fuelEntries]);

  const fuelEntryIds = useMemo(() => fuelEntries.map((e) => e.id), [fuelEntries]);
  const {
    data: fuelEntryBillsByEntryId = {} as Record<string, FuelEntryBill[]>,
    isLoading: fuelBillsLoading,
  } = useFuelEntryBillsByFuelEntryIds(fuelEntryIds);

  const [billPreviewOpen, setBillPreviewOpen] = useState(false);
  const [billPreviewLoading, setBillPreviewLoading] = useState(false);
  const [billPreview, setBillPreview] = useState<FuelEntryBill | null>(null);
  const [billPreviewUrl, setBillPreviewUrl] = useState<string | null>(null);

  const localDayKey = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  const filledAtByEntryId = useMemo(() => {
    const map = new Map<string, Date>();
    for (const e of fuelEntries) map.set(e.id, new Date(e.filled_at));
    return map;
  }, [fuelEntries]);

  const litersSpendSeries = useMemo(() => {
    const map = new Map<string, { liters: number; spend: number }>();

    for (const e of fuelEntries) {
      const dt = new Date(e.filled_at);
      const key = localDayKey(dt);
      if (!map.has(key)) map.set(key, { liters: 0, spend: 0 });
      const cur = map.get(key)!;
      cur.liters += e.fuel_liters;
      cur.spend += e.amount_inr;
    }

    return Array.from(map.entries())
      .map(([day, v]) => ({ day, liters: v.liters, spend: v.spend }))
      .sort((a, b) => (a.day < b.day ? -1 : 1));
  }, [fuelEntries]);

  const mileageSeries = useMemo(() => {
    const estMap = new Map<string, { dist: number; liters: number }>();
    const fullMap = new Map<string, { dist: number; liters: number }>();

    for (const s of perCar) {
      for (const p of s.estimatedPoints) {
        if (!p.valid || p.kmPerL == null) continue;
        const dt = filledAtByEntryId.get(p.entryId);
        if (!dt) continue;
        const day = localDayKey(dt);
        if (!estMap.has(day)) estMap.set(day, { dist: 0, liters: 0 });
        const cur = estMap.get(day)!;
        cur.dist += p.distanceKm;
        cur.liters += p.liters;
      }

      for (const seg of s.fullTankSegments) {
        if (!seg.valid || seg.kmPerL == null) continue;
        const dt = filledAtByEntryId.get(seg.endEntryId);
        if (!dt) continue;
        const day = localDayKey(dt);
        if (!fullMap.has(day)) fullMap.set(day, { dist: 0, liters: 0 });
        const cur = fullMap.get(day)!;
        cur.dist += seg.distanceKm;
        cur.liters += seg.litersPurchased;
      }
    }

    const allDays = new Set<string>([...estMap.keys(), ...fullMap.keys()]);
    return Array.from(allDays)
      .sort((a, b) => (a < b ? -1 : 1))
      .map((day) => {
        const e = estMap.get(day);
        const f = fullMap.get(day);
        return {
          day,
          estKmPerL: e && e.liters > 0 ? e.dist / e.liters : null,
          fullTankKmPerL: f && f.liters > 0 ? f.dist / f.liters : null,
        };
      });
  }, [perCar, filledAtByEntryId]);

  const estimatedPointByEntryId = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of perCar) {
      for (const p of s.estimatedPoints) {
        if (p.valid && p.kmPerL != null) map.set(p.entryId, p.kmPerL);
      }
    }
    return map;
  }, [perCar]);

  const fullTankSegmentByEndEntryId = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of perCar) {
      for (const seg of s.fullTankSegments) {
        if (seg.valid && seg.kmPerL != null) map.set(seg.endEntryId, seg.kmPerL);
      }
    }
    return map;
  }, [perCar]);

  const timelineEntries = useMemo(() => {
    const query = timelineSearch.trim().toLowerCase();
    const sorted = [...fuelEntries].sort((a, b) => new Date(b.filled_at).getTime() - new Date(a.filled_at).getTime());
    if (!query) return sorted;

    return sorted.filter((fill) => {
      const car = carById.get(fill.car_id);
      const vehicleText = car ? `${car.vehicle_number} ${car.model} ${car.brand ?? ''}`.toLowerCase() : '';
      const amountText = String(fill.amount_inr);
      const litersText = String(fill.fuel_liters);
      const odoText = String(fill.odometer_km);
      return vehicleText.includes(query)
        || fill.car_id.toLowerCase().includes(query)
        || amountText.includes(query)
        || litersText.includes(query)
        || odoText.includes(query);
    });
  }, [fuelEntries, timelineSearch, carById]);

  const openBillPreview = async (bill: FuelEntryBill) => {
    try {
      setBillPreview(bill);
      setBillPreviewUrl(null);
      setBillPreviewOpen(true);
      setBillPreviewLoading(true);
      const url = await storageGetSignedUrl(bill.file_path, 3600);
      setBillPreviewUrl(url);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      toast({ title: 'Failed to load bill preview', description: message, variant: 'destructive' });
      setBillPreviewOpen(false);
    } finally {
      setBillPreviewLoading(false);
    }
  };

  const handleExportCSV = () => {
    try {
      const headers = [
        'Vehicle',
        'Liters Total',
        'Spend Total (INR)',
        'Estimated Distance (km)',
        'Cost per km (INR)',
        'Avg Price per Liter (INR)',
        'Last Estimated Mileage (km/L)',
        'Last Full-Tank Mileage (km/L)',
      ];

      const rows = perCar.map((s) => {
        const car = scopedCars.find((c) => c.id === s.carId);
        return [
          car ? formatCarLabel(car) : s.carId,
          s.litersTotal.toString(),
          s.spendTotal.toString(),
          s.estimatedDistanceKm.toString(),
          s.costPerKm == null ? '' : String(s.costPerKm),
          s.avgPricePerL == null ? '' : String(s.avgPricePerL),
          s.estimatedLast?.kmPerL == null ? '' : String(s.estimatedLast.kmPerL),
          s.fullTankLast?.kmPerL == null ? '' : String(s.fullTankLast.kmPerL),
        ];
      });

      const csv = [headers, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fuel-reports-${exportFullTimeData ? 'all-time' : `${fromDate}_to_${toDate}`}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: 'Export complete', description: 'Fuel report CSV generated.' });
    } catch (e) {
      toast({ title: 'Export failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  if (showAccessRestricted) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center max-w-xl mx-auto space-y-4">
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold">Access restricted</h1>
        <p className="text-muted-foreground">You don’t have permission to view fuel reports.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <FuelIcon className="h-6 w-6" />
            Fuel Reports
          </h1>
          <p className="text-muted-foreground">Mileage + fuel spend summaries (estimated + full-tank accurate).</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Choose a date range and optionally a vehicle</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4 md:items-end">
            <div className="flex-1 space-y-2">
              <Label>Date Range</Label>
              <div className="flex gap-3 items-center">
                <Button
                  type="button"
                  variant={exportFullTimeData ? 'default' : 'outline'}
                  onClick={() => setExportFullTimeData((v) => !v)}
                >
                  {exportFullTimeData ? 'All time enabled' : 'All time'}
                </Button>
                {!exportFullTimeData && (
                  <>
                    <div className="space-y-1 flex-1">
                      <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                    </div>
                    <div className="space-y-1 flex-1">
                      <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="w-full md:w-72 space-y-2">
              <Label>Vehicle</Label>
              <SearchableSelect
                value={carFilterId}
                onValueChange={setCarFilterId}
                placeholder="All vehicles"
                options={[
                  { value: 'all', label: 'All vehicles' },
                  ...scopedCars.map((car) => ({
                    value: car.id,
                    label: `${car.vehicle_number} - ${car.model}`,
                  })),
                ]}
              />
            </div>

            <div className="w-full md:w-56 space-y-2">
              <Label>Fuel type</Label>
              <SearchableSelect
                value={fuelTypeFilter}
                onValueChange={setFuelTypeFilter}
                placeholder="All types"
                options={[
                  { value: 'all', label: 'All types' },
                  { value: 'petrol', label: 'PETROL' },
                  { value: 'diesel', label: 'DIESEL' },
                  { value: 'cng', label: 'CNG' },
                  { value: 'electric', label: 'ELECTRIC' },
                ]}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              Distance totals use only valid estimated mileage intervals.
            </div>
            <Button onClick={handleExportCSV} disabled={isLoading || perCar.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Fuel Fills Over Time</CardTitle>
            <CardDescription>Liters and spend (date-filtered)</CardDescription>
          </CardHeader>
          <CardContent>
            {litersSpendSeries.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">No fuel fills in this range.</div>
            ) : (
              <ChartContainer
                id="fuel-fills-over-time"
                config={{
                  liters: { label: 'Liters', color: 'hsl(var(--warning))' },
                  spend: { label: 'Spend', color: 'hsl(var(--primary))' },
                }}
              >
                <ComposedChart data={litersSpendSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" tickMargin={8} />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar yAxisId="left" dataKey="liters" fill="var(--color-liters)" barSize={14} />
                  <Line yAxisId="right" type="monotone" dataKey="spend" stroke="var(--color-spend)" dot={false} />
                </ComposedChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mileage Over Time</CardTitle>
            <CardDescription>Estimated vs full-tank mileage segments</CardDescription>
          </CardHeader>
          <CardContent>
            {mileageSeries.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">No mileage data in this range.</div>
            ) : (
              <ChartContainer
                id="fuel-mileage-over-time"
                config={{
                  estKmPerL: { label: 'Estimated km/L', color: 'hsl(var(--accent))' },
                  fullTankKmPerL: { label: 'Full-tank km/L', color: 'hsl(var(--warning))' },
                }}
              >
                <ComposedChart data={mileageSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" tickMargin={8} />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="estKmPerL" stroke="var(--color-estKmPerL)" dot={false} />
                  <Line type="monotone" dataKey="fullTankKmPerL" stroke="var(--color-fullTankKmPerL)" dot={false} strokeDasharray="6 4" />
                </ComposedChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="stat-card">
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Total Liters</div>
            <div className="text-2xl font-bold">{overall.litersTotal.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Total Spend</div>
            <div className="text-2xl font-bold">₹{overall.spendTotal.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Estimated Distance</div>
            <div className="text-2xl font-bold">{overall.distanceTotal.toLocaleString()} km</div>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Cost per km</div>
            <div className="text-2xl font-bold">
              {overall.costPerKm == null ? '—' : `₹${overall.costPerKm.toLocaleString()}`}
            </div>
          </CardContent>
        </Card>
      </div>

      {byFuelType.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Fuel bifurcation (by fuel type)</CardTitle>
            <CardDescription>Totals for the selected filters</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {byFuelType.map((r) => (
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
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Per Vehicle Summary</CardTitle>
          <CardDescription>Latest valid estimates (and full-tank accurate when available)</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : perCar.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No fuel entries in this period.</div>
          ) : (
            <div className="overflow-x-auto">
              <TableUI.Table>
                <TableUI.TableHeader>
                  <TableUI.TableRow>
                    <TableUI.TableHead>Vehicle</TableUI.TableHead>
                    <TableUI.TableHead className="text-right">Liters</TableUI.TableHead>
                    <TableUI.TableHead className="text-right">Spend (₹)</TableUI.TableHead>
                    <TableUI.TableHead className="text-right">Est. Distance</TableUI.TableHead>
                    <TableUI.TableHead className="text-right">Est. Mileage</TableUI.TableHead>
                    <TableUI.TableHead className="text-right">Full-tank Mileage</TableUI.TableHead>
                  </TableUI.TableRow>
                </TableUI.TableHeader>
                <TableUI.TableBody>
                  {perCar
                    .sort((a, b) => b.estimatedDistanceKm - a.estimatedDistanceKm)
                    .map((s) => {
                      const car = scopedCars.find((c) => c.id === s.carId);
                      const estValid = s.estimatedPoints.filter((p) => p.valid && p.kmPerL != null);
                      const estDist = estValid.reduce((sum, p) => sum + p.distanceKm, 0);
                      const estLiters = estValid.reduce((sum, p) => sum + p.liters, 0);
                      const est = estLiters > 0 ? estDist / estLiters : null;

                      const fullValid = s.fullTankSegments.filter((seg) => seg.valid && seg.kmPerL != null);
                      const fullDist = fullValid.reduce((sum, seg) => sum + seg.distanceKm, 0);
                      const fullLiters = fullValid.reduce((sum, seg) => sum + seg.litersPurchased, 0);
                      const full = fullLiters > 0 ? fullDist / fullLiters : null;

                      return (
                        <TableUI.TableRow key={s.carId}>
                          <TableUI.TableCell className="font-medium whitespace-nowrap">
                            {car ? `${car.vehicle_number} - ${car.model}` : s.carId}
                          </TableUI.TableCell>
                          <TableUI.TableCell className="text-right whitespace-nowrap">
                            {s.litersTotal.toLocaleString()}
                          </TableUI.TableCell>
                          <TableUI.TableCell className="text-right whitespace-nowrap">
                            ₹{s.spendTotal.toLocaleString()}
                          </TableUI.TableCell>
                          <TableUI.TableCell className="text-right whitespace-nowrap">
                            {s.estimatedDistanceKm.toLocaleString()} km
                          </TableUI.TableCell>
                          <TableUI.TableCell className="text-right whitespace-nowrap">
                            {est == null ? (
                              <Badge variant="muted">N/A</Badge>
                            ) : (
                              <Badge variant="secondary">{est.toFixed(2)} km/L</Badge>
                            )}
                          </TableUI.TableCell>
                          <TableUI.TableCell className="text-right whitespace-nowrap">
                            {full == null ? (
                              <Badge variant="muted">N/A</Badge>
                            ) : (
                              <Badge variant="secondary">{full.toFixed(2)} km/L</Badge>
                            )}
                          </TableUI.TableCell>
                        </TableUI.TableRow>
                      );
                    })}
                </TableUI.TableBody>
              </TableUI.Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fuel Timeline</CardTitle>
          <CardDescription>Fuel fills with computed mileage + optional bill attachment</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              value={timelineSearch}
              onChange={(e) => setTimelineSearch(e.target.value)}
              placeholder="Search by number plate, model, liters, amount, odometer..."
            />
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : timelineEntries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No fuel fills to display.</div>
          ) : (
            <div className="overflow-x-auto">
              <TableUI.Table>
                <TableUI.TableHeader>
                  <TableUI.TableRow>
                    <TableUI.TableHead>Date & Time</TableUI.TableHead>
                    <TableUI.TableHead>Vehicle</TableUI.TableHead>
                    <TableUI.TableHead className="text-right">Liters</TableUI.TableHead>
                    <TableUI.TableHead className="text-right">Amount (₹)</TableUI.TableHead>
                    <TableUI.TableHead className="text-right">Odometer (km)</TableUI.TableHead>
                    <TableUI.TableHead className="text-right">Est. km/L</TableUI.TableHead>
                    <TableUI.TableHead className="text-right">Full-tank km/L</TableUI.TableHead>
                    <TableUI.TableHead>Attachment</TableUI.TableHead>
                  </TableUI.TableRow>
                </TableUI.TableHeader>
                <TableUI.TableBody>
                  {timelineEntries.map((fill) => {
                      const car = carById.get(fill.car_id);
                      const estKmPerL = estimatedPointByEntryId.get(fill.id) ?? null;
                      const fullTankKmPerL = fullTankSegmentByEndEntryId.get(fill.id) ?? null;
                      const bills = fuelEntryBillsByEntryId[fill.id] ?? [];
                      const hasBill = bills.length > 0;

                      return (
                        <TableUI.TableRow key={fill.id}>
                          <TableUI.TableCell className="whitespace-nowrap">
                            {formatDateTimeDMY(fill.filled_at)}
                          </TableUI.TableCell>
                          <TableUI.TableCell className="font-medium">
                            {car ? `${car.vehicle_number} - ${car.model}` : `Vehicle ${fill.car_id.slice(0, 8)}`}
                          </TableUI.TableCell>
                          <TableUI.TableCell className="text-right whitespace-nowrap">
                            {fill.fuel_liters.toLocaleString()}
                          </TableUI.TableCell>
                          <TableUI.TableCell className="text-right whitespace-nowrap">
                            ₹{fill.amount_inr.toLocaleString()}
                          </TableUI.TableCell>
                          <TableUI.TableCell className="text-right whitespace-nowrap">
                            {fill.odometer_km.toLocaleString()}
                          </TableUI.TableCell>
                          <TableUI.TableCell className="text-right whitespace-nowrap">
                            {estKmPerL == null ? (
                              <Badge variant="muted">N/A</Badge>
                            ) : (
                              <Badge variant="secondary">{estKmPerL.toFixed(2)}</Badge>
                            )}
                          </TableUI.TableCell>
                          <TableUI.TableCell className="text-right whitespace-nowrap">
                            {fullTankKmPerL == null ? (
                              <Badge variant="muted">N/A</Badge>
                            ) : (
                              <Badge variant="secondary">{fullTankKmPerL.toFixed(2)}</Badge>
                            )}
                          </TableUI.TableCell>
                          <TableUI.TableCell>
                            {hasBill ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openBillPreview(bills[0])}
                                disabled={billPreviewLoading || fuelBillsLoading}
                              >
                                View ({bills.length})
                              </Button>
                            ) : (
                              <Badge variant="muted">No bill</Badge>
                            )}
                          </TableUI.TableCell>
                        </TableUI.TableRow>
                      );
                  })}
                </TableUI.TableBody>
              </TableUI.Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={billPreviewOpen}
        onOpenChange={(open) => {
          setBillPreviewOpen(open);
          if (!open) {
            setBillPreviewUrl(null);
            setBillPreview(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              Fuel Bill: {billPreview?.file_name || ''}
            </DialogTitle>
          </DialogHeader>
          {billPreviewLoading || (!billPreviewUrl && billPreview) ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : billPreviewUrl && billPreview ? (
            <div className="space-y-4">
              {billPreview.file_type.startsWith('image/') ? (
                <img src={billPreviewUrl} alt={billPreview.file_name} className="max-w-full rounded-md border" />
              ) : (
                <iframe
                  src={billPreviewUrl}
                  title={billPreview.file_name}
                  className="w-full rounded-md border"
                  style={{ height: '70vh' }}
                />
              )}
              <div className="flex gap-2">
                <a href={billPreviewUrl} target="_blank" rel="noreferrer">
                  <Button variant="outline" type="button">
                    Open in new tab
                  </Button>
                </a>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

