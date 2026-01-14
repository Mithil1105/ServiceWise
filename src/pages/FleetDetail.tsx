import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useCar } from '@/hooks/use-cars';
import { useOdometerEntries, useLatestOdometer } from '@/hooks/use-odometer';
import { useServiceRecords } from '@/hooks/use-services';
import { useActiveDowntime, useStartDowntime, useEndDowntime, useDowntimeLogs } from '@/hooks/use-downtime';
import { useIncidents } from '@/hooks/use-incidents';
import { useCarNotes, useCreateCarNote, useDeleteCarNote, useTogglePinNote } from '@/hooks/use-car-notes';
import { useHighMaintenanceData } from '@/hooks/use-dashboard';
import { useAuth } from '@/lib/auth-context';
import DocumentsSection from '@/components/fleet/DocumentsSection';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
} from 'lucide-react';
import { formatDateDMY, formatDateTimeDMY } from '@/lib/date';
import type { TimelineItem, DowntimeLog } from '@/types';

export default function FleetDetail() {
  const { id } = useParams<{ id: string }>();
  const { isAdmin } = useAuth();
  const { data: car, isLoading: carLoading } = useCar(id!);
  const { data: latestOdo } = useLatestOdometer(id!);
  const { data: odometerEntries, isLoading: odoLoading } = useOdometerEntries(id);
  const { data: serviceRecords, isLoading: servicesLoading } = useServiceRecords(id);
  const { data: activeDowntime } = useActiveDowntime(id!);
  const { data: downtimeLogs } = useDowntimeLogs(id);
  const { data: incidents } = useIncidents({ carId: id });
  const { data: notes } = useCarNotes(id!);
  const { data: maintenanceData } = useHighMaintenanceData(id!);
  
  const startDowntime = useStartDowntime();
  const endDowntime = useEndDowntime();
  const createNote = useCreateCarNote();
  const deleteNote = useDeleteCarNote();
  const togglePin = useTogglePinNote();

  const [downtimeOpen, setDowntimeOpen] = useState(false);
  const [downtimeReason, setDowntimeReason] = useState<DowntimeLog['reason']>('service');
  const [downtimeNotes, setDowntimeNotes] = useState('');
  const [estimatedUptime, setEstimatedUptime] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [pinNewNote, setPinNewNote] = useState(false);

  const currentKm = latestOdo?.odometer_km || 0;

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
    startDowntime.mutate(
      { 
        car_id: id!, 
        reason: downtimeReason, 
        notes: downtimeNotes || undefined,
        estimated_uptime_at: estimatedUptime ? new Date(estimatedUptime).toISOString() : undefined,
      },
      {
        onSuccess: () => {
          setDowntimeOpen(false);
          setDowntimeReason('service');
          setDowntimeNotes('');
          setEstimatedUptime('');
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
          <Link to="/fleet">Back to Fleet</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/fleet">
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
            <p className="text-muted-foreground">{car.model}</p>
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
              <DialogContent>
                <DialogHeader>
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
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Reason</Label>
                    <Select value={downtimeReason} onValueChange={(v) => setDowntimeReason(v as any)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="service">Service</SelectItem>
                        <SelectItem value="breakdown">Breakdown</SelectItem>
                        <SelectItem value="accident">Accident</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Estimated Back Up Date</Label>
                    <Input
                      type="date"
                      value={estimatedUptime}
                      onChange={(e) => setEstimatedUptime(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">When do you expect the car to be back?</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Notes (optional)</Label>
                    <Textarea
                      value={downtimeNotes}
                      onChange={(e) => setDowntimeNotes(e.target.value)}
                      placeholder="Add notes about the downtime..."
                    />
                  </div>
                </div>
                <DialogFooter>
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
            <Link to={`/odometer?car=${car.id}`}>
              <Gauge className="h-4 w-4 mr-2" />
              Update Odometer
            </Link>
          </Button>
          <Button asChild>
            <Link to={`/services/new?car=${car.id}`}>
              <Wrench className="h-4 w-4 mr-2" />
              Add Service
            </Link>
          </Button>
        </div>
      </div>

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
    </div>
  );
}
