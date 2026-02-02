import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useIncidents, useCreateIncident, useResolveIncident } from '@/hooks/use-incidents';
import { useCars } from '@/hooks/use-cars';
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
import type { Incident } from '@/types';

const INCIDENT_TYPES = [
  { value: 'breakdown', label: 'Breakdown' },
  { value: 'overheating', label: 'Overheating' },
  { value: 'puncture', label: 'Puncture' },
  { value: 'towing', label: 'Towing' },
  { value: 'accident', label: 'Accident' },
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

  // Add incident form
  const [addOpen, setAddOpen] = useState(false);
  const [selectedCarId, setSelectedCarId] = useState('');
  const [incidentType, setIncidentType] = useState<Incident['type']>('breakdown');
  const [severity, setSeverity] = useState<Incident['severity']>('medium');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [cost, setCost] = useState('');
  const [driverName, setDriverName] = useState('');
  const [incidentDate, setIncidentDate] = useState(() => toLocalDateTimeInputValue());
  const [estimatedReturn, setEstimatedReturn] = useState('');

  // Resolve incident
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveNotes, setResolveNotes] = useState('');
  const [resolveDate, setResolveDate] = useState(() => toLocalDateTimeInputValue());
  const [resolvingIncident, setResolvingIncident] = useState<string | null>(null);

  const { data: cars } = useCars();
  const { data: incidents, isLoading } = useIncidents({
    unresolvedOnly,
    severity: severityFilter === 'all' ? undefined : severityFilter,
    carId: carFilter || undefined,
  });

  const createMutation = useCreateIncident();
  const resolveMutation = useResolveIncident();

  // Handle resolve from URL param
  useEffect(() => {
    if (resolveId) {
      setResolvingIncident(resolveId);
      setResolveOpen(true);
      // Clear the param
      setSearchParams({});
    }
  }, [resolveId]);

  const carOptions = (cars || []).map((car) => ({
    value: car.id,
    label: `${car.vehicle_number} - ${car.model}`,
  }));

  const handleAddIncident = () => {
    if (!selectedCarId) return;

    createMutation.mutate(
      {
        car_id: selectedCarId,
        incident_at: new Date(incidentDate).toISOString(),
        estimated_return_at: estimatedReturn ? new Date(estimatedReturn).toISOString() : undefined,
        type: incidentType,
        severity,
        description: description || undefined,
        location: location || undefined,
        cost: cost ? parseFloat(cost) : undefined,
        driver_name: driverName || undefined,
      },
      {
        onSuccess: () => {
          setAddOpen(false);
          resetAddForm();
        },
      }
    );
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
    setIncidentDate(toLocalDateTimeInputValue());
    setEstimatedReturn('');
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
              <div className="space-y-2">
                <Label>Vehicle *</Label>
                <SearchableSelect
                  options={carOptions}
                  value={selectedCarId}
                  onValueChange={setSelectedCarId}
                  placeholder="Select vehicle..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Incident Date & Time *
                  </Label>
                  <Input
                    type="datetime-local"
                    value={incidentDate}
                    onChange={(e) => setIncidentDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Est. Return to Road
                  </Label>
                  <Input
                    type="datetime-local"
                    value={estimatedReturn}
                    onChange={(e) => setEstimatedReturn(e.target.value)}
                    min={incidentDate}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
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
                </div>

                <div className="space-y-2">
                  <Label>Severity</Label>
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
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What happened?"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Where it happened"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Driver Name
                  </Label>
                  <Input
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    placeholder="Driver at the time"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Cost (₹)</Label>
                <Input
                  type="number"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="0"
                />
              </div>
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
          ) : incidents && incidents.length > 0 ? (
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
                {incidents.map((incident) => (
                  <TableRow key={incident.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDateTimeDMY(incident.incident_at)}
                    </TableCell>
                    <TableCell>
                      <Link
                        to={`/app/fleet/${incident.car_id}`}
                        className="font-medium hover:text-primary"
                      >
                        {incident.cars?.vehicle_number}
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
            <DialogDescription>Mark this incident as resolved. The vehicle will be marked as back on the road.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Return to Road Date & Time *
              </Label>
              <Input
                type="datetime-local"
                value={resolveDate}
                onChange={(e) => setResolveDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                When did the vehicle return to service?
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
