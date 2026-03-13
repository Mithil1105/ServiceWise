import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useIncidents, useCreateIncident, useResolveIncident } from '@/hooks/use-incidents';
import { useCars } from '@/hooks/use-cars';
import { useChallanTypes } from '@/hooks/use-challan-types';
import { useDriverForCarAtTime, useCreateTrafficChallan } from '@/hooks/use-traffic-challans';
import { useAssignedCarIdsForCurrentUser } from '@/hooks/use-car-assignments';
import { useOrganizationSettings } from '@/hooks/use-organization-settings';
import { type IncidentFormBuiltInFieldKey, INCIDENT_FORM_FIELD_LABELS, type FleetNewCarCustomField } from '@/types/form-config';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertTriangle,
  Plus,
  Check,
  Loader2,
  HelpCircle,
  Filter,
  Calendar,
  Clock,
  User,
} from 'lucide-react';
import { formatDateTimeDMY, toLocalDateTimeInputValue } from '@/lib/date';
import { formatCarLabel } from '@/lib/utils';
import type { Incident } from '@/types';

const INCIDENT_TYPES = [
  { value: 'breakdown', label: 'Breakdown' },
  { value: 'overheating', label: 'Overheating' },
  { value: 'puncture', label: 'Puncture' },
  { value: 'towing', label: 'Towing' },
  { value: 'accident', label: 'Accident' },
  { value: 'traffic_challan', label: 'Traffic Challan' },
  { value: 'other', label: 'Other' },
];

const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

export default function Incidents() {
  const [searchParams, setSearchParams] = useSearchParams();
  const resolveId = searchParams.get('resolve');

  // Filters
  const [unresolvedOnly, setUnresolvedOnly] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<Incident['severity'] | 'all'>('all');
  const [carFilter, setCarFilter] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  // Add incident form
  const [addOpen, setAddOpen] = useState(false);
  const [selectedCarId, setSelectedCarId] = useState('');
  const [incidentType, setIncidentType] = useState<Incident['type']>('breakdown');
  const [severity, setSeverity] = useState<Incident['severity']>('medium');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [cost, setCost] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [selectedChallanTypeId, setSelectedChallanTypeId] = useState<string>('');
  const [incidentDate, setIncidentDate] = useState(() => toLocalDateTimeInputValue());
  const [estimatedReturn, setEstimatedReturn] = useState('');
  const [incidentCustomValues, setIncidentCustomValues] = useState<Record<string, string | number | boolean | null>>({});
  const [addFormErrors, setAddFormErrors] = useState<Record<string, string>>({});

  const { data: orgSettings } = useOrganizationSettings();
  const { data: challanTypes = [] } = useChallanTypes();
  const { data: driverAtTime } = useDriverForCarAtTime(
    selectedCarId || null,
    incidentDate || null
  );
  const createTrafficChallan = useCreateTrafficChallan();

  useEffect(() => {
    if (!driverAtTime) return;
    // Only auto-fill when fields are empty so manual edits are preserved
    if (!driverName && driverAtTime.driver_name) {
      setDriverName(driverAtTime.driver_name);
    }
    if (!driverPhone && driverAtTime.driver_phone) {
      setDriverPhone(driverAtTime.driver_phone);
    }
  }, [driverAtTime?.driver_name, driverAtTime?.driver_phone]);
  const incidentFormConfig = orgSettings?.incident_form_config ?? {};
  const incidentFieldOverrides = incidentFormConfig.fieldOverrides ?? {};
  const incidentCustomFields = (incidentFormConfig.customFields ?? []).sort((a, b) => a.order - b.order);
  const getIncidentFieldLabel = (key: IncidentFormBuiltInFieldKey) => incidentFieldOverrides[key]?.label ?? INCIDENT_FORM_FIELD_LABELS[key];
  const isIncidentFieldHidden = (key: IncidentFormBuiltInFieldKey) => incidentFieldOverrides[key]?.hidden === true;
  const isIncidentFieldRequired = (key: IncidentFormBuiltInFieldKey) => incidentFieldOverrides[key]?.required ?? (key === 'car_id' || key === 'incident_at');

  // Resolve incident
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveNotes, setResolveNotes] = useState('');
  const [resolveDate, setResolveDate] = useState(() => toLocalDateTimeInputValue());
  const [resolvingIncident, setResolvingIncident] = useState<string | null>(null);
  const [resolvingIncidentType, setResolvingIncidentType] = useState<Incident['type'] | null>(null);

  const { data: cars } = useCars();
  const { assignedCarIds } = useAssignedCarIdsForCurrentUser();
  const { data: incidents, isLoading } = useIncidents({
    unresolvedOnly,
    severity: severityFilter === 'all' ? undefined : severityFilter,
    carId: carFilter || undefined,
  });

  const scopedCars = assignedCarIds
    ? (cars ?? []).filter((c) => assignedCarIds.includes(c.id))
    : (cars ?? []);
  const scopedIncidents = assignedCarIds
    ? (incidents ?? []).filter((i) => assignedCarIds.includes(i.car_id))
    : (incidents ?? []);

  const sortedIncidents = [...(scopedIncidents ?? [])].sort((a, b) => {
    const aTime = new Date(a.incident_at).getTime();
    const bTime = new Date(b.incident_at).getTime();
    return sortOrder === 'newest' ? bTime - aTime : aTime - bTime;
  });

  const createMutation = useCreateIncident();
  const resolveMutation = useResolveIncident();

  // Handle resolve from URL param
  useEffect(() => {
    if (resolveId && incidents && incidents.length > 0) {
      const incident = incidents.find((i) => i.id === resolveId) || null;
      setResolvingIncident(resolveId);
      setResolvingIncidentType(incident?.type ?? null);
      setResolveOpen(true);
      // Clear the param
      setSearchParams({});
    }
  }, [resolveId, incidents, setSearchParams]);

  const carOptions = (scopedCars || []).map((car) => ({
    value: car.id,
    label: `${car.vehicle_number} - ${car.model}`,
  }));

  const handleAddIncident = () => {
    setAddFormErrors({});
    const err: Record<string, string> = {};
    if (isIncidentFieldRequired('car_id') && !selectedCarId) err.car_id = 'Please select a vehicle';
    if (isIncidentFieldRequired('incident_at') && !incidentDate) err.incident_at = 'Incident date & time is required';
    if (isIncidentFieldRequired('estimated_return_at') && !estimatedReturn?.trim()) err.estimated_return_at = 'Est. return to road is required';
    if (isIncidentFieldRequired('type') && !incidentType) err.type = 'Type is required';
    if (isIncidentFieldRequired('severity') && !severity) err.severity = 'Severity is required';
    if (isIncidentFieldRequired('description') && !description?.trim()) err.description = 'Description is required';
    if (isIncidentFieldRequired('location') && !location?.trim()) err.location = 'Location is required';
    if (isIncidentFieldRequired('cost') && (cost === '' || cost == null)) err.cost = 'Cost is required';
    if (isIncidentFieldRequired('driver_name') && !driverName?.trim()) err.driver_name = 'Driver name is required';
    for (const f of incidentCustomFields) {
      if (!f.required) continue;
      const v = incidentCustomValues[f.key];
      if (v === undefined || v === null || v === '') err[`custom_${f.key}`] = `${f.label} is required`;
    }
    if (Object.keys(err).length > 0) {
      setAddFormErrors(err);
      return;
    }

    const customAttrs: Record<string, string | number | boolean | null> = {};
    for (const f of incidentCustomFields) {
      const v = incidentCustomValues[f.key];
      if (v !== undefined && v !== null && v !== '') customAttrs[f.key] = v;
    }

    const incidentPayload = {
      car_id: selectedCarId,
      incident_at: new Date(incidentDate).toISOString(),
      estimated_return_at: estimatedReturn ? new Date(estimatedReturn).toISOString() : undefined,
      type: incidentType,
      severity,
      description: description || undefined,
      location: location || undefined,
      cost: cost ? parseFloat(cost) : undefined,
      driver_name: driverName || undefined,
      custom_attributes: Object.keys(customAttrs).length ? customAttrs : undefined,
    };

    const done = () => {
      setAddOpen(false);
      resetAddForm();
    };

    if (incidentType === 'traffic_challan') {
      createMutation.mutate(incidentPayload, {
        onSuccess: (created) => {
          if (created?.id) {
            createTrafficChallan.mutate(
              {
                incident_id: created.id,
                car_id: selectedCarId,
                driver_name: driverName?.trim() || null,
                driver_phone: driverPhone?.trim() || null,
                challan_type_id: selectedChallanTypeId?.trim() || null,
                amount: cost ? parseFloat(cost) : 0,
                incident_at: new Date(incidentDate).toISOString(),
                location: location?.trim() || null,
                description: description?.trim() || null,
              },
              { onSuccess: done, onError: () => {} }
            );
          } else {
            done();
          }
        },
      });
    } else {
      createMutation.mutate(incidentPayload, { onSuccess: done });
    }
  };

  const handleResolve = () => {
    if (!resolvingIncident) return;

    resolveMutation.mutate(
      {
        id: resolvingIncident,
        resolved_notes: resolveNotes || undefined,
        resolved_at: new Date(resolveDate).toISOString(),
      },
      {
        onSuccess: () => {
          setResolveOpen(false);
          setResolvingIncident(null);
          setResolveNotes('');
          setResolveDate(toLocalDateTimeInputValue());
        },
      }
    );
  };

  const resetAddForm = () => {
    setSelectedCarId('');
    setIncidentType('breakdown');
    setSeverity('medium');
    setDescription('');
    setLocation('');
    setCost('');
    setDriverName('');
    setDriverPhone('');
    setSelectedChallanTypeId('');
    setIncidentDate(toLocalDateTimeInputValue());
    setEstimatedReturn('');
    setIncidentCustomValues({});
    setAddFormErrors({});
  };

  const getSeverityVariant = (sev: Incident['severity']) => {
    switch (sev) {
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'muted';
      default:
        return 'muted';
    }
  };

  const getEstimatedReturnDisplay = (incident: any) => {
    if (incident.resolved) {
      return incident.resolved_at ? formatDateTimeDMY(incident.resolved_at) : '-';
    }
    if (incident.estimated_return_at) {
      const returnDate = new Date(incident.estimated_return_at);
      const now = new Date();
      const isOverdue = returnDate < now;
      return (
        <span className={isOverdue ? 'text-destructive' : 'text-muted-foreground'}>
          {formatDateTimeDMY(incident.estimated_return_at)}
          {isOverdue && <span className="ml-1 text-xs">(Overdue)</span>}
        </span>
      );
    }
    return <span className="text-muted-foreground">-</span>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="page-title">Incidents</h1>
            <p className="text-muted-foreground">Log and track vehicle breakdowns and issues</p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>Log breakdowns and issues here. Incidents automatically mark vehicles as down until resolved.</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Log Incident
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Log New Incident</DialogTitle>
              <DialogDescription>Record a breakdown, accident, or other vehicle issue. The vehicle will be marked as down until resolved.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {!isIncidentFieldHidden('car_id') && (
                <div className="space-y-2">
                  <Label>{getIncidentFieldLabel('car_id')}{isIncidentFieldRequired('car_id') ? ' *' : ''}</Label>
                  <SearchableSelect
                    options={carOptions}
                    value={selectedCarId}
                    onValueChange={setSelectedCarId}
                    placeholder="Select vehicle..."
                  />
                  {addFormErrors.car_id && <p className="text-sm text-destructive">{addFormErrors.car_id}</p>}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {!isIncidentFieldHidden('incident_at') && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {getIncidentFieldLabel('incident_at')}{isIncidentFieldRequired('incident_at') ? ' *' : ''}
                    </Label>
                    <Input
                      type="datetime-local"
                      value={incidentDate}
                      onChange={(e) => setIncidentDate(e.target.value)}
                    />
                    {addFormErrors.incident_at && <p className="text-sm text-destructive">{addFormErrors.incident_at}</p>}
                  </div>
                )}

                {!isIncidentFieldHidden('estimated_return_at') && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {getIncidentFieldLabel('estimated_return_at')}{isIncidentFieldRequired('estimated_return_at') ? ' *' : ''}
                    </Label>
                    <Input
                      type="datetime-local"
                      value={estimatedReturn}
                      onChange={(e) => setEstimatedReturn(e.target.value)}
                      min={incidentDate}
                    />
                    {addFormErrors.estimated_return_at && <p className="text-sm text-destructive">{addFormErrors.estimated_return_at}</p>}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {!isIncidentFieldHidden('type') && (
                  <div className="space-y-2">
                    <Label>{getIncidentFieldLabel('type')}{isIncidentFieldRequired('type') ? ' *' : ''}</Label>
                    <Select value={incidentType} onValueChange={(v) => setIncidentType(v as Incident['type'])}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INCIDENT_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {addFormErrors.type && <p className="text-sm text-destructive">{addFormErrors.type}</p>}
                  </div>
                )}
                {incidentType === 'traffic_challan' && (
                  <div className="space-y-2">
                    <Label>Challan type</Label>
                    <Select value={selectedChallanTypeId} onValueChange={setSelectedChallanTypeId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select challan type (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {challanTypes.map((ct) => (
                          <SelectItem key={ct.id} value={ct.id}>
                            {ct.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {challanTypes.length === 0 && (
                      <p className="text-xs text-muted-foreground">Add challan types in Settings to categorize fines.</p>
                    )}
                  </div>
                )}

                {!isIncidentFieldHidden('severity') && (
                  <div className="space-y-2">
                    <Label>{getIncidentFieldLabel('severity')}{isIncidentFieldRequired('severity') ? ' *' : ''}</Label>
                    <Select value={severity} onValueChange={(v) => setSeverity(v as Incident['severity'])}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SEVERITY_OPTIONS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {addFormErrors.severity && <p className="text-sm text-destructive">{addFormErrors.severity}</p>}
                  </div>
                )}
              </div>

              {!isIncidentFieldHidden('description') && (
                <div className="space-y-2">
                  <Label>{getIncidentFieldLabel('description')}{isIncidentFieldRequired('description') ? ' *' : ''}</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What happened?"
                  />
                  {addFormErrors.description && <p className="text-sm text-destructive">{addFormErrors.description}</p>}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {!isIncidentFieldHidden('location') && (
                  <div className="space-y-2">
                    <Label>{getIncidentFieldLabel('location')}{isIncidentFieldRequired('location') ? ' *' : ''}</Label>
                    <Input
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Where it happened"
                    />
                    {addFormErrors.location && <p className="text-sm text-destructive">{addFormErrors.location}</p>}
                  </div>
                )}
                {!isIncidentFieldHidden('driver_name') && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {getIncidentFieldLabel('driver_name')}{isIncidentFieldRequired('driver_name') ? ' *' : ''}
                    </Label>
                    <Input
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      placeholder="Auto-filled from recent booking or enter manually"
                    />
                    {addFormErrors.driver_name && <p className="text-sm text-destructive">{addFormErrors.driver_name}</p>}
                  </div>
                )}
                {incidentType === 'traffic_challan' && (
                  <div className="space-y-2">
                    <Label>Driver phone</Label>
                    <Input
                      value={driverPhone}
                      onChange={(e) => setDriverPhone(e.target.value)}
                      placeholder="Auto-filled from booking or enter manually"
                    />
                  </div>
                )}
              </div>

              {!isIncidentFieldHidden('cost') && (
                <div className="space-y-2">
                  <Label>
                    {incidentType === 'traffic_challan' ? 'Fine (₹)' : getIncidentFieldLabel('cost')}
                    {isIncidentFieldRequired('cost') ? ' *' : ''}
                  </Label>
                  <Input
                    type="number"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    placeholder="0"
                  />
                  {addFormErrors.cost && <p className="text-sm text-destructive">{addFormErrors.cost}</p>}
                </div>
              )}

              {incidentCustomFields.map((f) => (
                <div key={f.id} className="space-y-2">
                  <Label>{f.label}{f.required ? ' *' : ''}</Label>
                  {f.type === 'number' ? (
                    <Input
                      type="number"
                      value={incidentCustomValues[f.key] != null ? String(incidentCustomValues[f.key]) : ''}
                      onChange={(e) => setIncidentCustomValues(prev => ({ ...prev, [f.key]: e.target.value === '' ? null : parseFloat(e.target.value) }))}
                      placeholder={`${f.label}...`}
                    />
                  ) : f.type === 'date' ? (
                    <Input
                      type="date"
                      value={incidentCustomValues[f.key] != null ? String(incidentCustomValues[f.key]) : ''}
                      onChange={(e) => setIncidentCustomValues(prev => ({ ...prev, [f.key]: e.target.value || null }))}
                    />
                  ) : f.type === 'select' ? (
                    <Select value={incidentCustomValues[f.key] != null ? String(incidentCustomValues[f.key]) : ''} onValueChange={(v) => setIncidentCustomValues(prev => ({ ...prev, [f.key]: v }))}>
                      <SelectTrigger><SelectValue placeholder={`Select ${f.label}`} /></SelectTrigger>
                      <SelectContent>{(f.options ?? []).map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type="text"
                      value={incidentCustomValues[f.key] != null ? String(incidentCustomValues[f.key]) : ''}
                      onChange={(e) => setIncidentCustomValues(prev => ({ ...prev, [f.key]: e.target.value || null }))}
                      placeholder={`${f.label}...`}
                    />
                  )}
                  {addFormErrors[`custom_${f.key}`] && <p className="text-sm text-destructive">{addFormErrors[`custom_${f.key}`]}</p>}
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddIncident} disabled={!selectedCarId || createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Log Incident
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="unresolvedOnly"
                checked={unresolvedOnly}
                onChange={(e) => setUnresolvedOnly(e.target.checked)}
                className="rounded border-input"
              />
              <Label htmlFor="unresolvedOnly" className="text-sm cursor-pointer">
                Unresolved only
              </Label>
            </div>

            <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as any)}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {SEVERITY_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="w-64">
              <SearchableSelect
                options={[{ value: '', label: 'All Vehicles' }, ...carOptions]}
                value={carFilter}
                onValueChange={setCarFilter}
                placeholder="Filter by vehicle..."
              />
            </div>

            <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as 'newest' | 'oldest')}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Incidents Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Incident Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : sortedIncidents && sortedIncidents.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Incident Date</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Est. Return / Resolved</TableHead>
                  <TableHead>Logged By</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedIncidents.map((incident) => (
                  <TableRow key={incident.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDateTimeDMY(incident.incident_at)}
                    </TableCell>
                    <TableCell>
                      <Link
                        to={`/app/fleet/${incident.car_id}`}
                        className="font-medium hover:text-primary"
                      >
                        {incident.cars ? formatCarLabel(incident.cars) : 'Unknown'}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {incident.driver_name ? (
                        <span className="font-medium">{incident.driver_name}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="capitalize">{incident.type}</TableCell>
                    <TableCell>
                      <Badge variant={getSeverityVariant(incident.severity)}>
                        {incident.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {getEstimatedReturnDisplay(incident)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <User className="h-3 w-3" />
                        {incident.profiles?.name || 'System'}
                      </div>
                    </TableCell>
                    <TableCell>
                      {incident.resolved ? (
                        <Badge variant="success">Resolved</Badge>
                      ) : (
                        <Badge variant="warning">Open</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {!incident.resolved && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setResolvingIncident(incident.id);
                            setResolvingIncidentType(incident.type);
                            setResolveDate(toLocalDateTimeInputValue());
                            setResolveOpen(true);
                          }}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Resolve
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No incidents found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resolve Dialog */}
      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent>
          <DialogHeader>
              <DialogTitle>Resolve Incident</DialogTitle>
              <DialogDescription>
                {resolvingIncidentType === 'traffic_challan'
                  ? 'Mark this challan as paid. The payment date will be stored with the incident.'
                  : 'Mark this incident as resolved. The vehicle will be marked as back on the road.'}
              </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {resolvingIncidentType === 'traffic_challan'
                  ? 'Challan Paid Date & Time *'
                  : 'Return to Road Date & Time *'}
              </Label>
              <Input
                type="datetime-local"
                value={resolveDate}
                onChange={(e) => setResolveDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {resolvingIncidentType === 'traffic_challan'
                  ? 'When was the challan paid?'
                  : 'When did the vehicle return to service?'}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Resolution Notes (optional)</Label>
              <Textarea
                value={resolveNotes}
                onChange={(e) => setResolveNotes(e.target.value)}
                placeholder="How was it resolved?"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleResolve} disabled={resolveMutation.isPending}>
              {resolveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Mark Resolved
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
