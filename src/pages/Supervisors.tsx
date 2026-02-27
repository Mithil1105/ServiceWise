import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, Car, Plus, Trash2, Activity, Search, CheckSquare, ArrowRightLeft } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useCars } from '@/hooks/use-cars';
import {
  useSupervisors,
  useCarAssignments,
  useAssignCarToSupervisor,
  useUnassignCarFromSupervisor,
  type CarAssignmentWithDetails,
} from '@/hooks/use-car-assignments';
import { useSupervisorActivityLogs, useLogSupervisorActivity } from '@/hooks/use-supervisor-activity';
import { formatDateDMY, formatDateTimeFull } from '@/lib/date';
import { formatCarLabel } from '@/lib/utils';

export default function Supervisors() {
  const { isAdmin, isManager } = useAuth();
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>('');
  const [selectedCarIds, setSelectedCarIds] = useState<Set<string>>(new Set());
  const [carSearchQuery, setCarSearchQuery] = useState('');
  const [notes, setNotes] = useState('');
  const [activityFilter, setActivityFilter] = useState<string>('all');
  const [transferAssignment, setTransferAssignment] = useState<CarAssignmentWithDetails | null>(null);
  const [transferTargetSupervisorId, setTransferTargetSupervisorId] = useState<string>('');
  const [transferNotes, setTransferNotes] = useState('');

  const { data: supervisors = [], isLoading: loadingSupervisors } = useSupervisors();
  const { data: allAssignments = [], isLoading: loadingAssignments } = useCarAssignments();
  const { data: cars = [] } = useCars();
  const { data: activityLogs = [], isLoading: loadingActivity } = useSupervisorActivityLogs(
    activityFilter === 'all' ? undefined : activityFilter
  );
  const assignCar = useAssignCarToSupervisor();
  const unassignCar = useUnassignCarFromSupervisor();

  // Get cars assigned to each supervisor
  const getSupervisorCars = (supervisorId: string) => {
    return allAssignments.filter((a) => a.supervisor_id === supervisorId);
  };

  // Get unassigned cars
  const assignedCarIds = new Set(allAssignments.map((a) => a.car_id));
  const unassignedCars = cars.filter((c) => !assignedCarIds.has(c.id) && c.status === 'active');

  // Filter cars by search query
  const filteredUnassignedCars = useMemo(() => {
    if (!carSearchQuery.trim()) return unassignedCars;
    const query = carSearchQuery.toLowerCase();
    return unassignedCars.filter(
      (c) =>
        c.vehicle_number.toLowerCase().includes(query) ||
        c.model.toLowerCase().includes(query)
    );
  }, [unassignedCars, carSearchQuery]);

  const handleToggleCar = (carId: string) => {
    setSelectedCarIds((prev) => {
      const next = new Set(prev);
      if (next.has(carId)) {
        next.delete(carId);
      } else {
        next.add(carId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedCarIds.size === filteredUnassignedCars.length) {
      setSelectedCarIds(new Set());
    } else {
      setSelectedCarIds(new Set(filteredUnassignedCars.map((c) => c.id)));
    }
  };

  const handleAssign = async () => {
    if (!selectedSupervisorId || selectedCarIds.size === 0) return;

    // Assign each selected car
    for (const carId of selectedCarIds) {
      await assignCar.mutateAsync({
        carId,
        supervisorId: selectedSupervisorId,
        notes: notes || undefined,
      });
    }

    setAssignDialogOpen(false);
    setSelectedSupervisorId('');
    setSelectedCarIds(new Set());
    setCarSearchQuery('');
    setNotes('');
  };

  const handleUnassign = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to unassign this car?')) return;
    await unassignCar.mutateAsync({ id: assignmentId });
  };

  const logActivity = useLogSupervisorActivity();
  const handleTransfer = async () => {
    if (!transferAssignment || !transferTargetSupervisorId) return;
    const carId = transferAssignment.car_id;
    const assignmentId = transferAssignment.id;
    const fromName = transferAssignment.supervisor?.name ?? 'Unknown';
    const toSupervisor = supervisors.find((s) => s.id === transferTargetSupervisorId);
    const toName = toSupervisor?.name ?? 'Unknown';
    const vehicleLabel = transferAssignment.cars ? formatCarLabel(transferAssignment.cars) : '';
    try {
      await unassignCar.mutateAsync({ id: assignmentId });
      await assignCar.mutateAsync({
        carId,
        supervisorId: transferTargetSupervisorId,
        notes: transferNotes || undefined,
      });
      await logActivity.mutateAsync({
        carId,
        actionType: 'car_transferred',
        actionDetails: {
          from_supervisor_name: fromName,
          to_supervisor_name: toName,
          vehicle: vehicleLabel,
          notes: transferNotes || null,
        },
      });
      setTransferAssignment(null);
      setTransferTargetSupervisorId('');
      setTransferNotes('');
    } catch {
      // Toasts handled by mutations
    }
  };

  const getActionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      service_added: 'Added Service Record',
      odometer_updated: 'Updated Odometer',
      incident_reported: 'Reported Incident',
      document_uploaded: 'Uploaded Document',
      car_assigned: 'Car Assigned',
      car_unassigned: 'Car Unassigned',
      car_transferred: 'Car Transferred',
      downtime_started: 'Started Downtime',
      downtime_ended: 'Ended Downtime',
      incident_resolved: 'Resolved Incident',
    };
    return labels[type] || type.replace(/_/g, ' ');
  };

  const formatActivityDetails = (actionType: string, details: Record<string, unknown> | null): string => {
    if (!details || typeof details !== 'object') return '-';
    const d = details as Record<string, string | number | null | undefined>;
    switch (actionType) {
      case 'car_assigned':
        return [d.assigned_to_supervisor_name && `Assigned to ${d.assigned_to_supervisor_name}`, d.notes && `Notes: ${d.notes}`].filter(Boolean).join(' • ') || '-';
      case 'car_unassigned':
        return d.unassigned_supervisor_name ? `Unassigned from ${d.unassigned_supervisor_name}` : '-';
      case 'car_transferred':
        return [d.from_supervisor_name && d.to_supervisor_name && `From ${d.from_supervisor_name} → ${d.to_supervisor_name}`, d.notes && `Notes: ${d.notes}`].filter(Boolean).join(' • ') || '-';
      case 'service_added':
        return [d.service_name && `Service: ${d.service_name}`, d.odometer_km != null && `${Number(d.odometer_km).toLocaleString()} km`, d.cost != null && `₹${Number(d.cost).toLocaleString()}`, d.vendor_name && d.vendor_name].filter(Boolean).join(' • ') || '-';
      case 'odometer_updated':
        return d.odometer_km != null ? `Reading: ${Number(d.odometer_km).toLocaleString()} km` : '-';
      case 'incident_reported':
        return [d.type && `Type: ${d.type}`, d.severity && `Severity: ${d.severity}`, d.description && String(d.description)].filter(Boolean).join(' • ') || '-';
      case 'downtime_started':
        return [d.reason && `Reason: ${d.reason}`, d.notes && String(d.notes)].filter(Boolean).join(' • ') || '-';
      case 'downtime_ended':
        return d.reason ? `Reason was: ${d.reason}` : 'Ended';
      case 'incident_resolved':
        return d.resolved_notes ? `Notes: ${d.resolved_notes}` : 'Incident resolved';
      default:
        return Object.entries(d).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${k}: ${v}`).join(', ') || '-';
    }
  };

  if (!isAdmin && !isManager) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              You don't have permission to view this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Supervisors</h1>
          <p className="text-base text-muted-foreground mt-1">Monitor supervisors and manage car assignments</p>
        </div>
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="text-base">
              <Plus className="h-5 w-5 mr-2" />
              Assign Cars
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Assign Cars to Supervisor</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Supervisor</Label>
                <Select
                  value={selectedSupervisorId}
                  onValueChange={setSelectedSupervisorId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select supervisor" />
                  </SelectTrigger>
                  <SelectContent>
                    {supervisors.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Select Cars</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by vehicle number or model..."
                    value={carSearchQuery}
                    onChange={(e) => setCarSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {filteredUnassignedCars.length > 0 && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select-all"
                    checked={selectedCarIds.size === filteredUnassignedCars.length}
                    onCheckedChange={handleSelectAll}
                  />
                  <Label htmlFor="select-all" className="text-sm cursor-pointer">
                    Select All ({filteredUnassignedCars.length})
                  </Label>
                  {selectedCarIds.size > 0 && (
                    <Badge variant="secondary" className="ml-auto">
                      {selectedCarIds.size} selected
                    </Badge>
                  )}
                </div>
              )}

              <ScrollArea className="h-48 border rounded-md">
                {filteredUnassignedCars.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    {carSearchQuery ? 'No cars match your search' : 'No unassigned cars available'}
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {filteredUnassignedCars.map((car) => (
                      <div
                        key={car.id}
                        className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer"
                        onClick={() => handleToggleCar(car.id)}
                      >
                        <Checkbox
                          checked={selectedCarIds.has(car.id)}
                          onCheckedChange={() => handleToggleCar(car.id)}
                        />
                        <div className="flex-1">
                          <span className="font-medium">{formatCarLabel(car)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any notes about this assignment"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAssign}
                disabled={!selectedSupervisorId || selectedCarIds.size === 0 || assignCar.isPending}
              >
                {assignCar.isPending ? 'Assigning...' : `Assign ${selectedCarIds.size} Car${selectedCarIds.size !== 1 ? 's' : ''}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Transfer car dialog */}
        <Dialog
          open={!!transferAssignment}
          onOpenChange={(open) => {
            if (!open) {
              setTransferAssignment(null);
              setTransferTargetSupervisorId('');
              setTransferNotes('');
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Transfer car to another supervisor</DialogTitle>
            </DialogHeader>
            {transferAssignment && (
              <div className="space-y-4 pt-4">
                <div className="rounded-md bg-muted p-3 text-sm">
                  <span className="font-medium">Car: </span>
                  {formatCarLabel(transferAssignment.cars)}
                </div>
                <div className="space-y-2">
                  <Label>Transfer to supervisor</Label>
                  <Select
                    value={transferTargetSupervisorId}
                    onValueChange={setTransferTargetSupervisorId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select supervisor" />
                    </SelectTrigger>
                    <SelectContent>
                      {supervisors
                        .filter((s) => s.id !== transferAssignment.supervisor_id)
                        .map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Input
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                    placeholder="e.g. Reassignment reason"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setTransferAssignment(null);
                  setTransferTargetSupervisorId('');
                  setTransferNotes('');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleTransfer}
                disabled={
                  !transferTargetSupervisorId ||
                  (assignCar.isPending || unassignCar.isPending)
                }
              >
                {assignCar.isPending || unassignCar.isPending
                  ? 'Transferring...'
                  : 'Transfer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="h-12 w-full max-w-md sm:w-auto">
          <TabsTrigger value="overview" className="text-base px-6">
            <Users className="h-5 w-5 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="assignments" className="text-base px-6">
            <Car className="h-5 w-5 mr-2" />
            All Assignments
          </TabsTrigger>
          <TabsTrigger value="activity" className="text-base px-6">
            <Activity className="h-5 w-5 mr-2" />
            Activity Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          {loadingSupervisors ? (
            <Card>
              <CardContent className="py-12 px-6">
                <p className="text-center text-muted-foreground text-base">Loading supervisors...</p>
              </CardContent>
            </Card>
          ) : supervisors.length === 0 ? (
            <Card>
              <CardContent className="py-12 px-6">
                <p className="text-center text-muted-foreground text-base">
                  No supervisors found. Add supervisor role to users in User Management.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-8 grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3">
              {supervisors.map((supervisor) => {
                const assignments = getSupervisorCars(supervisor.id);
                return (
                  <Card key={supervisor.id} className="min-w-0 flex flex-col min-h-[420px]">
                    <CardHeader className="pb-4 px-6 pt-6">
                      <div className="flex items-center justify-between gap-3">
                        <CardTitle className="text-xl font-semibold truncate">{supervisor.name}</CardTitle>
                        <Badge variant="outline" className="shrink-0 text-sm px-3 py-1">{assignments.length} cars</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col min-h-0 px-6 pb-6">
                      {assignments.length === 0 ? (
                        <p className="text-base text-muted-foreground">No cars assigned</p>
                      ) : (
                        <ScrollArea className="h-[320px] min-h-[18rem] flex-1">
                          <div className="space-y-3 pr-4">
                            {assignments.map((a) => (
                              <div
                                key={a.id}
                                className="flex items-center justify-between text-base p-4 bg-muted/80 rounded-lg"
                              >
                                <div className="min-w-0 flex-1">
                                  <span className="font-medium">{formatCarLabel(a.cars)}</span>
                                </div>
                                {isAdmin && (
                                  <div className="flex items-center gap-1 shrink-0">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-9 w-9"
                                      onClick={() => {
                                        setTransferAssignment(a);
                                        setTransferTargetSupervisorId('');
                                        setTransferNotes('');
                                      }}
                                      title="Transfer to another supervisor"
                                    >
                                      <ArrowRightLeft className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-9 w-9"
                                      onClick={() => handleUnassign(a.id)}
                                      title="Unassign car"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="assignments" className="mt-6">
          <Card>
            <CardHeader className="px-6 py-5">
              <CardTitle className="text-xl">All Car Assignments</CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              {loadingAssignments ? (
                <p className="text-center text-muted-foreground py-8 text-base">Loading...</p>
              ) : allAssignments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-base">No assignments yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-base">Vehicle</TableHead>
                      <TableHead className="text-base">Supervisor</TableHead>
                      <TableHead className="text-base">Assigned On</TableHead>
                      <TableHead className="text-base">Notes</TableHead>
                      {isAdmin && <TableHead className="w-[120px] text-base">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allAssignments.map((a) => (
                      <TableRow key={a.id} className="text-base">
                        <TableCell className="py-4">
                          <span className="font-medium">{formatCarLabel(a.cars)}</span>
                        </TableCell>
                        <TableCell className="py-4">{a.supervisor?.name || 'Unknown'}</TableCell>
                        <TableCell className="py-4">{formatDateDMY(a.assigned_at)}</TableCell>
                        <TableCell className="max-w-[280px] truncate py-4">
                          {a.notes || '-'}
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="py-4">
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setTransferAssignment(a);
                                  setTransferTargetSupervisorId('');
                                  setTransferNotes('');
                                }}
                                title="Transfer to another supervisor"
                              >
                                <ArrowRightLeft className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleUnassign(a.id)}
                                title="Unassign car"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <Card>
            <CardHeader className="px-6 py-5">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <CardTitle className="text-xl">Supervisor Activity Log</CardTitle>
                <Select value={activityFilter} onValueChange={setActivityFilter}>
                  <SelectTrigger className="w-[240px] h-10 text-base">
                    <SelectValue placeholder="All supervisors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All supervisors</SelectItem>
                    {supervisors.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              {loadingActivity ? (
                <p className="text-center text-muted-foreground py-8 text-base">Loading...</p>
              ) : activityLogs.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-base">No activity recorded yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-base">Supervisor</TableHead>
                      <TableHead className="text-base">Action</TableHead>
                      <TableHead className="text-base">Vehicle</TableHead>
                      <TableHead className="text-base">Details</TableHead>
                      <TableHead className="text-base">Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activityLogs.map((log) => (
                      <TableRow key={log.id} className="text-base">
                        <TableCell className="py-4">{log.supervisor?.name || 'Unknown'}</TableCell>
                        <TableCell className="py-4">
                          <Badge variant="outline" className="text-sm">{getActionTypeLabel(log.action_type)}</Badge>
                        </TableCell>
                        <TableCell className="py-4">
                          {log.cars ? formatCarLabel(log.cars) : '-'}
                        </TableCell>
                        <TableCell className="max-w-[280px] py-4">
                          <span className="text-sm text-muted-foreground line-clamp-2" title={log.action_details ? formatActivityDetails(log.action_type, log.action_details as Record<string, unknown>) : ''}>
                            {log.action_details ? formatActivityDetails(log.action_type, log.action_details as Record<string, unknown>) : '-'}
                          </span>
                        </TableCell>
                        <TableCell className="py-4">
                          {formatDateTimeFull(log.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
