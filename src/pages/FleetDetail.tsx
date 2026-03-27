import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useCar, useUpdateCar } from '@/hooks/use-cars';
import { useAssignedCarIdsForCurrentUser } from '@/hooks/use-car-assignments';
import { useOdometerEntries, useLatestOdometer } from '@/hooks/use-odometer';
import { useServiceRecords } from '@/hooks/use-services';
import { useActiveDowntime, useStartDowntime, useEndDowntime, useDowntimeLogs } from '@/hooks/use-downtime';
import { useOrganizationSettings } from '@/hooks/use-organization-settings';
import { type DowntimeFormBuiltInFieldKey, DOWNTIME_FORM_FIELD_LABELS, DEFAULT_DOWNTIME_REASON_OPTIONS, type FleetNewCarCustomField } from '@/types/form-config';
import { useIncidents } from '@/hooks/use-incidents';
import { useCarNotes, useCreateCarNote, useDeleteCarNote, useTogglePinNote } from '@/hooks/use-car-notes';
import { useHighMaintenanceData } from '@/hooks/use-dashboard';
import { useFuelEntries, useFuelEntryBillsByFuelEntryIds } from '@/hooks/use-fuel';
import { useAuth } from '@/lib/auth-context';
import { storageGetSignedUrl } from '@/lib/storage';
import DocumentsSection from '@/components/fleet/DocumentsSection';
import { computeFuelMileageForCar } from '@/lib/fuel-mileage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  Car,
  Gauge,
  Wrench,
  Calendar,
  DollarSign,
  Download,
  Loader2,
  Clock,
  Fuel,
  PauseCircle,
  PlayCircle,
  AlertTriangle,
  StickyNote,
  Pin,
  Trash2,
  Plus,
  HelpCircle,
  UserCheck,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { formatDateDMY, formatDateTimeDMY } from '@/lib/date';
import type { FuelEntryBill, TimelineItem, DowntimeLog } from '@/types';

export default function FleetDetail() {
  const { id } = useParams<{ id: string }>();
  const { isAdmin, isManager } = useAuth();
  const { assignedCarIds, isRestricted } = useAssignedCarIdsForCurrentUser();
  const { data: car, isLoading: carLoading } = useCar(id!);
  const updateCar = useUpdateCar();
  const { data: latestOdo } = useLatestOdometer(id!);
  const { data: odometerEntries, isLoading: odoLoading } = useOdometerEntries(id);
  const { data: serviceRecords, isLoading: servicesLoading } = useServiceRecords(id);
  const { data: activeDowntime } = useActiveDowntime(id!);
  const { data: downtimeLogs } = useDowntimeLogs(id);
  const { data: incidents } = useIncidents({ carId: id });
  const { data: fuelEntries, isLoading: fuelLoading } = useFuelEntries({ carId: id! });
  const { data: notes } = useCarNotes(id!);
  const { data: maintenanceData } = useHighMaintenanceData(id!);
  
  const startDowntime = useStartDowntime();
  const endDowntime = useEndDowntime();
  const createNote = useCreateCarNote();
  const deleteNote = useDeleteCarNote();
  const togglePin = useTogglePinNote();

  if (isRestricted && id && assignedCarIds && !assignedCarIds.includes(id)) {
    return <Navigate to="/app" replace />;
  }

  const [downtimeOpen, setDowntimeOpen] = useState(false);
  const [downtimeReason, setDowntimeReason] = useState<string>('service');
  const [downtimeNotes, setDowntimeNotes] = useState('');
  const [estimatedUptime, setEstimatedUptime] = useState('');
  const [downtimeCustomValues, setDowntimeCustomValues] = useState<Record<string, string | number | boolean | null>>({});

  const { data: orgSettings } = useOrganizationSettings();
  const downtimeFormConfig = orgSettings?.downtime_form_config ?? {};
  const downtimeFieldOverrides = downtimeFormConfig.fieldOverrides ?? {};
  const downtimeReasonOptions = (downtimeFormConfig.reasonOptions?.length ? downtimeFormConfig.reasonOptions : DEFAULT_DOWNTIME_REASON_OPTIONS).filter((o) => o.value && o.label);
  const downtimeCustomFields = (downtimeFormConfig.customFields ?? []).sort((a, b) => a.order - b.order);
  const getDowntimeFieldLabel = (key: DowntimeFormBuiltInFieldKey) => downtimeFieldOverrides[key]?.label ?? DOWNTIME_FORM_FIELD_LABELS[key];
  const isDowntimeFieldHidden = (key: DowntimeFormBuiltInFieldKey) => downtimeFieldOverrides[key]?.hidden === true;
  const isDowntimeFieldRequired = (key: DowntimeFormBuiltInFieldKey) => downtimeFieldOverrides[key]?.required ?? (key === 'reason');
  const [noteOpen, setNoteOpen] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [pinNewNote, setPinNewNote] = useState(false);
  const [assignmentNote, setAssignmentNote] = useState('');
  const [assignmentNoteTouched, setAssignmentNoteTouched] = useState(false);
  const [ownerName, setOwnerName] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState<string>('');
  const [fuelType, setFuelType] = useState<string>('');
  const [vehicleType, setVehicleType] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [notesValue, setNotesValue] = useState('');

  useEffect(() => {
    if (car?.permanent_assignment_note != null) setAssignmentNote(car.permanent_assignment_note);
    else if (!assignmentNoteTouched) setAssignmentNote('');
  }, [car?.permanent_assignment_note]);

  useEffect(() => {
    if (!car) return;
    setOwnerName(car.owner_name ?? '');
    setBrand(car.brand ?? '');
    setModel(car.model ?? '');
    setYear(car.year ? String(car.year) : '');
    setFuelType(car.fuel_type ?? '');
    setVehicleType(car.vehicle_type ?? '');
    setStatus(car.status ?? 'active');
    setNotesValue(car.notes ?? '');
  }, [car]);

  const currentKm = latestOdo?.odometer_km || 0;

  const fuelEntriesAsc = (fuelEntries ?? []).slice().sort((a, b) => {
    return new Date(a.filled_at).getTime() - new Date(b.filled_at).getTime();
  });
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

  const fuelEntryIds = fuelEntriesAsc.map((e) => e.id);
  const {
    data: fuelEntryBillsByEntryId = {} as Record<string, FuelEntryBill[]>,
    isLoading: fuelBillsLoading,
  } = useFuelEntryBillsByFuelEntryIds(fuelEntryIds);

  const [fuelBillPreviewOpen, setFuelBillPreviewOpen] = useState(false);
  const [fuelBillPreview, setFuelBillPreview] = useState<FuelEntryBill | null>(null);
  const [fuelBillPreviewUrl, setFuelBillPreviewUrl] = useState<string | null>(null);
  const [fuelBillPreviewLoading, setFuelBillPreviewLoading] = useState(false);

  const openFuelBillPreview = async (bill: FuelEntryBill) => {
    setFuelBillPreview(bill);
    setFuelBillPreviewOpen(true);
    setFuelBillPreviewUrl(null);
    setFuelBillPreviewLoading(true);
    try {
      const url = await storageGetSignedUrl(bill.file_path, 3600);
      setFuelBillPreviewUrl(url);
    } catch (e) {
      console.error('Failed to load fuel bill preview:', e);
      setFuelBillPreviewUrl(null);
    } finally {
      setFuelBillPreviewLoading(false);
    }
  };

  // Build timeline with incidents and downtime
  const timeline: TimelineItem[] = [
    ...(odometerEntries || []).map((entry) => ({
      id: entry.id,
      type: 'odometer' as const,
      date: entry.reading_at,
      title: 'Odometer Updated',
      description: `Reading: ${entry.odometer_km.toLocaleString()} km`,
      source: 'Fleet' as const,
    })),
    ...(serviceRecords || []).map((record) => ({
      id: record.id,
      type: 'service' as const,
      date: record.serviced_at,
      title: `Service: ${record.service_name}`,
      description: record.vendor_name
        ? `at ${record.vendor_name}${record.vendor_location ? `, ${record.vendor_location}` : ''}`
        : undefined,
      details: {
        cost: record.cost,
        odometer_km: record.odometer_km,
      },
      source: 'Fleet' as const,
    })),
    ...(fuelEntries || []).map((fill) => ({
      id: fill.id,
      type: 'fuel' as const,
      date: fill.filled_at,
      title: 'Fuel Fill',
      description: (() => {
        const est = fuelSummary?.estimatedPoints.find((p) => p.entryId === fill.id) ?? null;
        const full = fuelSummary?.fullTankSegments.find((s) => s.endEntryId === fill.id) ?? null;
        const estText = est?.kmPerL != null ? `Est: ${est.kmPerL.toFixed(2)} km/L` : 'Est: N/A';
        const fullText = full?.kmPerL != null ? `Full: ${full.kmPerL.toFixed(2)} km/L` : 'Full: N/A';

        const bills = fuelEntryBillsByEntryId[fill.id] ?? [];
        const billText = fuelBillsLoading
          ? 'Bills: ...'
          : bills.length > 0
            ? `Bills: ${bills.length}`
            : 'No bill';

        return `${fill.fuel_liters.toLocaleString()} L • ₹${fill.amount_inr.toLocaleString()} • ${estText} • ${fullText} • ${billText}`;
      })(),
      details: {
        cost: fill.amount_inr,
        odometer_km: fill.odometer_km,
        fuel_liters: fill.fuel_liters,
        is_full_tank: fill.is_full_tank,
      },
      source: 'Fleet' as const,
    })),
    ...(incidents || []).map((inc) => ({
      id: inc.id,
      type: 'incident' as const,
      date: inc.incident_at,
      title: `Incident: ${inc.type}`,
      description: inc.description || `Severity: ${inc.severity}`,
      details: {
        severity: inc.severity,
        resolved: inc.resolved,
        cost: inc.cost,
      },
      source: 'Fleet' as const,
    })),
    ...(downtimeLogs || []).map((dt) => ({
      id: dt.id,
      type: 'downtime' as const,
      date: dt.started_at,
      title: `Downtime: ${dt.reason}`,
      description: dt.ended_at ? `Ended ${formatDateTimeDMY(dt.ended_at)}` : 'Currently active',
      details: { active: !dt.ended_at },
      source: 'Fleet' as const,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleExportCSV = () => {
    if (!serviceRecords) return;

    const headers = ['Date', 'Type', 'Service Name', 'Vendor', 'Location', 'Cost (INR)', 'Odometer (km)', 'Notes'];
    const rows = serviceRecords.map((record) => [
      formatDateDMY(record.serviced_at),
      'SERVICE',
      record.service_name,
      record.vendor_name || '',
      record.vendor_location || '',
      record.cost?.toString() || '',
      record.odometer_km.toString(),
      record.notes || '',
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${car?.vehicle_number || 'vehicle'}-service-history.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleStartDowntime = () => {
    const customAttrs: Record<string, string | number | boolean | null> = {};
    for (const f of downtimeCustomFields) {
      const v = downtimeCustomValues[f.key];
      if (v !== undefined && v !== null && v !== '') customAttrs[f.key] = v;
    }
    startDowntime.mutate(
      {
        car_id: id!,
        reason: downtimeReason,
        notes: downtimeNotes || undefined,
        estimated_uptime_at: estimatedUptime ? new Date(estimatedUptime).toISOString() : undefined,
        custom_attributes: Object.keys(customAttrs).length ? customAttrs : undefined,
      },
      {
        onSuccess: () => {
          setDowntimeOpen(false);
          setDowntimeReason(downtimeReasonOptions[0]?.value ?? 'service');
          setDowntimeNotes('');
          setEstimatedUptime('');
          setDowntimeCustomValues({});
        },
      }
    );
  };

  const handleEndDowntime = () => {
    if (activeDowntime) {
      endDowntime.mutate(activeDowntime.id);
    }
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    createNote.mutate(
      { car_id: id!, note: newNote.trim(), pinned: pinNewNote },
      {
        onSuccess: () => {
          setNoteOpen(false);
          setNewNote('');
          setPinNewNote(false);
        },
      }
    );
  };

  const getTimelineIcon = (type: string) => {
    switch (type) {
      case 'odometer':
        return <Gauge className="h-4 w-4 text-primary" />;
      case 'service':
        return <Wrench className="h-4 w-4 text-accent" />;
      case 'fuel':
        return <Fuel className="h-4 w-4 text-warning" />;
      case 'incident':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'downtime':
        return <PauseCircle className="h-4 w-4 text-warning" />;
      default:
        return <DollarSign className="h-4 w-4 text-warning" />;
    }
  };

  const getTimelineBg = (type: string) => {
    switch (type) {
      case 'odometer':
        return 'bg-primary/10';
      case 'service':
        return 'bg-accent/10';
      case 'fuel':
        return 'bg-warning/10';
      case 'incident':
        return 'bg-destructive/10';
      case 'downtime':
        return 'bg-warning/10';
      default:
        return 'bg-warning/10';
    }
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
          <Link to="/app/fleet">Back to Fleet</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/app/fleet">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="page-title">{car.vehicle_number}</h1>
              {activeDowntime && (
                <Badge variant="warning" className="gap-1">
                  <PauseCircle className="h-3 w-3" />
                  In Downtime
                </Badge>
              )}
              {maintenanceData?.isHighMaintenance && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="error" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      High Maintenance
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="font-medium mb-1">High Maintenance Flag</p>
                    <ul className="text-xs space-y-1">
                      <li>• Cost (180d): ₹{maintenanceData.maintenance_cost_180d.toLocaleString()}</li>
                      <li>• Downtime (90d): {maintenanceData.downtime_days_90d} days</li>
                      <li>• Incidents (180d): {maintenanceData.incidents_180d}</li>
                    </ul>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <p className="text-muted-foreground flex items-center gap-2">
              {car.model}
              <Badge variant="outline" className="font-normal">{car.vehicle_class === 'hmv' ? 'HMV' : 'LMV'}</Badge>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {activeDowntime ? (
            <Button variant="outline" onClick={handleEndDowntime} disabled={endDowntime.isPending}>
              {endDowntime.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-2" />}
              Mark Back Active
            </Button>
          ) : (
            <Dialog open={downtimeOpen} onOpenChange={setDowntimeOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <PauseCircle className="h-4 w-4 mr-2" />
                  Mark Downtime
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] flex flex-col overflow-hidden">
                <DialogHeader className="shrink-0">
                  <DialogTitle className="flex items-center gap-2">
                    <PauseCircle className="h-5 w-5" />
                    Start Downtime
                  </DialogTitle>
                  <DialogDescription className="flex items-center gap-1">
                    Mark this vehicle as unavailable
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3 w-3 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        Use downtime when a car is unavailable. This helps track lost availability and identify problematic vehicles.
                      </TooltipContent>
                    </Tooltip>
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 overflow-y-auto min-h-0 flex-1 pr-1">
                  {!isDowntimeFieldHidden('reason') && (
                    <div className="space-y-2">
                      <Label>{getDowntimeFieldLabel('reason')}{isDowntimeFieldRequired('reason') ? ' *' : ''}</Label>
                      <Select value={downtimeReason} onValueChange={setDowntimeReason}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {downtimeReasonOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {!isDowntimeFieldHidden('estimated_uptime_at') && (
                    <div className="space-y-2">
                      <Label>{getDowntimeFieldLabel('estimated_uptime_at')}{isDowntimeFieldRequired('estimated_uptime_at') ? ' *' : ''}</Label>
                      <Input
                        type="date"
                        value={estimatedUptime}
                        onChange={(e) => setEstimatedUptime(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">When do you expect the car to be back?</p>
                    </div>
                  )}
                  {!isDowntimeFieldHidden('notes') && (
                    <div className="space-y-2">
                      <Label>{getDowntimeFieldLabel('notes')}{isDowntimeFieldRequired('notes') ? ' *' : ''}</Label>
                      <Textarea
                        value={downtimeNotes}
                        onChange={(e) => setDowntimeNotes(e.target.value)}
                        placeholder="Add notes about the downtime..."
                      />
                    </div>
                  )}
                  {downtimeCustomFields.map((f) => (
                    <div key={f.id} className="space-y-2">
                      <Label>{f.label}{f.required ? ' *' : ''}</Label>
                      {f.type === 'number' ? (
                        <Input
                          type="number"
                          value={downtimeCustomValues[f.key] != null ? String(downtimeCustomValues[f.key]) : ''}
                          onChange={(e) => setDowntimeCustomValues(prev => ({ ...prev, [f.key]: e.target.value === '' ? null : parseFloat(e.target.value) }))}
                          placeholder={`${f.label}...`}
                        />
                      ) : f.type === 'date' ? (
                        <Input
                          type="date"
                          value={downtimeCustomValues[f.key] != null ? String(downtimeCustomValues[f.key]) : ''}
                          onChange={(e) => setDowntimeCustomValues(prev => ({ ...prev, [f.key]: e.target.value || null }))}
                        />
                      ) : f.type === 'select' ? (
                        <Select value={downtimeCustomValues[f.key] != null ? String(downtimeCustomValues[f.key]) : ''} onValueChange={(v) => setDowntimeCustomValues(prev => ({ ...prev, [f.key]: v }))}>
                          <SelectTrigger><SelectValue placeholder={`Select ${f.label}`} /></SelectTrigger>
                          <SelectContent>{(f.options ?? []).map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : (
                        <Input
                          type="text"
                          value={downtimeCustomValues[f.key] != null ? String(downtimeCustomValues[f.key]) : ''}
                          onChange={(e) => setDowntimeCustomValues(prev => ({ ...prev, [f.key]: e.target.value || null }))}
                          placeholder={`${f.label}...`}
                        />
                      )}
                    </div>
                  ))}
                </div>
                <DialogFooter className="shrink-0 border-t pt-4 mt-2">
                  <Button variant="outline" onClick={() => setDowntimeOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleStartDowntime} disabled={startDowntime.isPending}>
                    {startDowntime.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Start Downtime
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          <Button variant="outline" asChild>
            <Link to={`/app/odometer?car=${car.id}`}>
              <Gauge className="h-4 w-4 mr-2" />
              Update Odometer
            </Link>
          </Button>
          <Button asChild>
            <Link to={`/app/services/new?car=${car.id}`}>
              <Wrench className="h-4 w-4 mr-2" />
              Add Service
            </Link>
          </Button>
        </div>
      </div>

      {/* Editable Vehicle Details */}
      {(isAdmin || isManager) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Car className="h-5 w-5" />
              Vehicle details
            </CardTitle>
            <CardDescription>Edit basic information about this vehicle</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="owner-name">Owner name</Label>
              <Input
                id="owner-name"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand">Brand</Label>
              <Input
                id="brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="year">Year</Label>
              <Input
                id="year"
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Fuel type</Label>
              <Select value={fuelType} onValueChange={setFuelType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select fuel type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="petrol">Petrol</SelectItem>
                  <SelectItem value="diesel">Diesel</SelectItem>
                  <SelectItem value="cng">CNG</SelectItem>
                  <SelectItem value="electric">Electric</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Vehicle type</Label>
              <Select value={vehicleType} onValueChange={setVehicleType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select vehicle type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="car">Car</SelectItem>
                  <SelectItem value="bus">Bus</SelectItem>
                  <SelectItem value="tempo-traveller">Tempo Traveller</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="vehicle-notes">Internal notes</Label>
              <Textarea
                id="vehicle-notes"
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                placeholder="Notes about this vehicle"
              />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button
                onClick={() =>
                  updateCar.mutate({
                    id: id!,
                    owner_name: ownerName || null,
                    brand: brand || null,
                    model: model || null,
                    year: year ? Number(year) : null,
                    fuel_type: fuelType || null,
                    vehicle_type: vehicleType || null,
                    status: status || 'active',
                    notes: notesValue || null,
                  })
                }
                disabled={updateCar.isPending}
              >
                {updateCar.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save vehicle details
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Downtime Banner */}
      {activeDowntime && (
        <Card className="border-warning bg-warning/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <PauseCircle className="h-5 w-5 text-warning" />
                <div>
                  <p className="font-medium">Currently in downtime since {formatDateTimeDMY(activeDowntime.started_at)}</p>
                  <p className="text-sm text-muted-foreground">Reason: {activeDowntime.reason}</p>
                </div>
              </div>
              <Button onClick={handleEndDowntime} disabled={endDowntime.isPending}>
                {endDowntime.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                End Downtime
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overview Card */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="stat-card">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <Gauge className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Current Odometer</p>
              <p className="text-xl font-bold">{currentKm.toLocaleString()} km</p>
            </div>
          </div>
        </Card>

        <Card className="stat-card">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-accent/10">
              <Calendar className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Year</p>
              <p className="text-xl font-bold">{car.year || 'N/A'}</p>
            </div>
          </div>
        </Card>

        <Card className="stat-card">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-warning/10">
              <Fuel className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Fuel Type</p>
              <p className="text-xl font-bold">{car.fuel_type || 'N/A'}</p>
            </div>
          </div>
        </Card>

        <Card className="stat-card">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-success/10">
              <Car className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant={car.status === 'active' ? 'success' : 'muted'}>
                {car.status}
              </Badge>
            </div>
          </div>
        </Card>
      </div>

      {/* Permanent assignment (Admin/Manager) */}
      {(isAdmin || isManager) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Permanent assignment
            </CardTitle>
            <CardDescription>
              When on, this vehicle is excluded from booking assignment and check availability. Optionally note who or what it is assigned to.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch
                checked={!!car.on_permanent_assignment}
                onCheckedChange={(checked) =>
                  updateCar.mutate({
                    id: id!,
                    on_permanent_assignment: checked,
                    ...(checked ? {} : { permanent_assignment_note: null }),
                  })
                }
                disabled={updateCar.isPending}
              />
              <Label className="text-sm font-medium">
                On permanent assignment (not available for bookings)
              </Label>
            </div>
            {car.on_permanent_assignment && (
              <div className="space-y-2">
                <Label htmlFor="assignment-note">Assigned to (optional)</Label>
                <div className="flex gap-2">
                  <Input
                    id="assignment-note"
                    value={assignmentNote}
                    onChange={(e) => {
                      setAssignmentNote(e.target.value);
                      setAssignmentNoteTouched(true);
                    }}
                    placeholder="e.g. Driver name, CEO car"
                    className="max-w-sm"
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      updateCar.mutate({
                        id: id!,
                        permanent_assignment_note: assignmentNote.trim() || null,
                      });
                    }}
                    disabled={updateCar.isPending}
                  >
                    {updateCar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Notes Panel */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <StickyNote className="h-5 w-5" />
            Notes
          </CardTitle>
          <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Note
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Note</DialogTitle>
                <DialogDescription>Add an internal note for this vehicle</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Note</Label>
                  <Textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Enter your note..."
                    rows={4}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="pinNote"
                    checked={pinNewNote}
                    onChange={(e) => setPinNewNote(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="pinNote" className="cursor-pointer">Pin this note</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setNoteOpen(false)}>Cancel</Button>
                <Button onClick={handleAddNote} disabled={!newNote.trim() || createNote.isPending}>
                  {createNote.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Add Note
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {notes && notes.length > 0 ? (
            <div className="space-y-2">
              {notes.map((note) => (
                <div key={note.id} className={`p-3 rounded-lg ${note.pinned ? 'bg-accent/10 border border-accent/20' : 'bg-muted/30'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm">{note.note}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDateTimeDMY(note.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => togglePin.mutate({ id: note.id, car_id: id!, pinned: !note.pinned })}
                      >
                        <Pin className={`h-3 w-3 ${note.pinned ? 'text-accent' : 'text-muted-foreground'}`} />
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => deleteNote.mutate({ id: note.id, car_id: id! })}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No notes yet</p>
          )}
        </CardContent>
      </Card>

      {/* Documents Section */}
      <DocumentsSection carId={id!} isAdmin={isAdmin} />

      {/* Tabs */}
      <Tabs defaultValue="timeline" className="space-y-4">
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="services">Service History</TabsTrigger>
          <TabsTrigger value="odometer">Odometer History</TabsTrigger>
          <TabsTrigger value="fuel">Fuel History</TabsTrigger>
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Activity Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {timeline.length > 0 ? (
                <div className="space-y-4">
                  {timeline.map((item) => (
                    <div
                      key={item.id}
                      className="flex gap-4 p-4 rounded-lg bg-muted/30"
                    >
                      <div className={`p-2 rounded-lg h-fit ${getTimelineBg(item.type)}`}>
                        {getTimelineIcon(item.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{item.title}</p>
                          <Badge variant="muted" className="text-xs">
                            {item.type}
                          </Badge>
                        </div>
                        {item.description && (
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDateTimeDMY(item.date)}
                        </p>
                        {item.details?.cost && (
                          <p className="text-sm font-medium text-accent mt-1">
                            ₹{item.details.cost.toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No activity yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Service History
              </CardTitle>
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              {servicesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : serviceRecords && serviceRecords.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Odometer</TableHead>
                      <TableHead>Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {serviceRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          {formatDateDMY(record.serviced_at)}
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
                          {record.cost ? `₹${record.cost.toLocaleString()}` : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No service records yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="odometer">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gauge className="h-5 w-5" />
                Odometer History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {odoLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : odometerEntries && odometerEntries.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Reading</TableHead>
                      <TableHead>Change</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {odometerEntries.map((entry, idx) => {
                      const prevEntry = odometerEntries[idx + 1];
                      const change = prevEntry
                        ? entry.odometer_km - prevEntry.odometer_km
                        : 0;

                      return (
                        <TableRow key={entry.id}>
                          <TableCell>
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
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No odometer entries yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fuel">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Fuel className="h-5 w-5 text-warning" />
                Fuel History
              </CardTitle>
              <CardDescription>Fuel fills and odometer readings for this vehicle</CardDescription>
            </CardHeader>
            <CardContent>
              {fuelLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : fuelEntriesAsc.length > 0 ? (
                <div className="space-y-4">
                  {fuelSummary && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="p-3 rounded-lg bg-muted/30">
                        <div className="text-xs text-muted-foreground">Total Liters</div>
                        <div className="text-lg font-semibold">{fuelSummary.litersTotal.toLocaleString()} L</div>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30">
                        <div className="text-xs text-muted-foreground">Total Spend</div>
                        <div className="text-lg font-semibold">₹{fuelSummary.spendTotal.toLocaleString()}</div>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30">
                        <div className="text-xs text-muted-foreground">Est. Distance</div>
                        <div className="text-lg font-semibold">{fuelSummary.estimatedDistanceKm.toLocaleString()} km</div>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30">
                        <div className="text-xs text-muted-foreground">Last Est. Mileage</div>
                        <div className="text-lg font-semibold">
                          {fuelSummary.estimatedLast?.kmPerL == null ? '—' : `${fuelSummary.estimatedLast.kmPerL.toFixed(2)} km/L`}
                        </div>
                      </div>
                    </div>
                  )}

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
                                  {estKmPerL == null ? (
                                    <Badge variant="muted">N/A</Badge>
                                  ) : (
                                    <Badge variant="secondary">{estKmPerL.toFixed(2)} km/L</Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-right whitespace-nowrap">
                                  {fullKmPerL == null ? (
                                    <Badge variant="muted">N/A</Badge>
                                  ) : (
                                    <Badge variant="secondary">{fullKmPerL.toFixed(2)} km/L</Badge>
                                  )}
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
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No fuel fills recorded yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="incidents">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Incident History
              </CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link to={`/incidents?car=${id}`}>
                  View All Incidents →
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {incidents && incidents.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Est. Return</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Resolution</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incidents.map((incident) => (
                      <TableRow key={incident.id}>
                        <TableCell className="whitespace-nowrap">
                          {formatDateTimeDMY(incident.incident_at)}
                        </TableCell>
                        <TableCell className="capitalize font-medium">
                          {incident.type}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              incident.severity === 'high' ? 'error' : 
                              incident.severity === 'medium' ? 'warning' : 
                              'muted'
                            }
                          >
                            {incident.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          {incident.description || '-'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {incident.estimated_return_at 
                            ? formatDateTimeDMY(incident.estimated_return_at) 
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {incident.resolved ? (
                            <Badge variant="success">Resolved</Badge>
                          ) : (
                            <Badge variant="warning">Open</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {incident.resolved ? (
                            <div className="text-sm">
                              <p className="text-muted-foreground">
                                {formatDateTimeDMY(incident.resolved_at!)}
                              </p>
                              {incident.resolved_notes && (
                                <p className="text-xs mt-1 max-w-xs truncate">
                                  {incident.resolved_notes}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No incidents recorded</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
            <DialogTitle>{fuelBillPreview?.file_name || 'Fuel Bill'}</DialogTitle>
            <DialogDescription>
              {fuelBillPreview ? `${fuelBillPreview.file_type || 'document'} • ${new Date(fuelBillPreview.created_at).toLocaleString()}` : ''}
            </DialogDescription>
          </DialogHeader>

          {fuelBillPreviewLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : fuelBillPreviewUrl ? (
            <div className="space-y-4">
              {fuelBillPreview?.file_type?.startsWith('image/') ? (
                <img
                  src={fuelBillPreviewUrl}
                  alt={fuelBillPreview?.file_name || 'Fuel bill'}
                  className="max-w-full rounded-md border"
                />
              ) : (
                <iframe
                  src={fuelBillPreviewUrl}
                  title={fuelBillPreview?.file_name || 'Fuel bill'}
                  className="w-full rounded-md border"
                  style={{ height: '70vh' }}
                />
              )}

              <a href={fuelBillPreviewUrl} target="_blank" rel="noreferrer">
                <Button variant="outline" type="button">
                  Open in new tab
                </Button>
              </a>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No preview available.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
