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
import { Users, Car, Plus, Trash2, Activity, Search, CheckSquare } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useCars } from '@/hooks/use-cars';
import {
  useSupervisors,
  useCarAssignments,
  useAssignCarToSupervisor,
  useUnassignCarFromSupervisor,
} from '@/hooks/use-car-assignments';
import { useSupervisorActivityLogs } from '@/hooks/use-supervisor-activity';
import { format } from 'date-fns';

export default function Supervisors() {
  const { isAdmin, isManager } = useAuth();
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>('');
  const [selectedCarIds, setSelectedCarIds] = useState<Set<string>>(new Set());
  const [carSearchQuery, setCarSearchQuery] = useState('');
  const [notes, setNotes] = useState('');
  const [activityFilter, setActivityFilter] = useState<string>('');

  const { data: supervisors = [], isLoading: loadingSupervisors } = useSupervisors();
  const { data: allAssignments = [], isLoading: loadingAssignments } = useCarAssignments();
  const { data: cars = [] } = useCars();
  const { data: activityLogs = [], isLoading: loadingActivity } = useSupervisorActivityLogs(
    activityFilter || undefined
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

  const getActionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      service_added: 'Added Service Record',
      odometer_updated: 'Updated Odometer',
      incident_reported: 'Reported Incident',
      document_uploaded: 'Uploaded Document',
    };
    return labels[type] || type;
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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Supervisors</h1>
          <p className="text-muted-foreground">Monitor supervisors and manage car assignments</p>
        </div>
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
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
                          <span className="font-medium">{car.vehicle_number}</span>
                          <span className="text-muted-foreground ml-2">{car.model}</span>
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
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">
            <Users className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="assignments">
            <Car className="h-4 w-4 mr-2" />
            All Assignments
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Activity className="h-4 w-4 mr-2" />
            Activity Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {loadingSupervisors ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">Loading supervisors...</p>
              </CardContent>
            </Card>
          ) : supervisors.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  No supervisors found. Add supervisor role to users in User Management.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {supervisors.map((supervisor) => {
                const assignments = getSupervisorCars(supervisor.id);
                return (
                  <Card key={supervisor.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{supervisor.name}</CardTitle>
                        <Badge variant="outline">{assignments.length} cars</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {assignments.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No cars assigned</p>
                      ) : (
                        <ScrollArea className="h-32">
                          <div className="space-y-2">
                            {assignments.map((a) => (
                              <div
                                key={a.id}
                                className="flex items-center justify-between text-sm p-2 bg-muted rounded"
                              >
                                <div>
                                  <span className="font-medium">{a.cars.vehicle_number}</span>
                                  <span className="text-muted-foreground ml-2">{a.cars.model}</span>
                                </div>
                                {isAdmin && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => handleUnassign(a.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
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

        <TabsContent value="assignments">
          <Card>
            <CardHeader>
              <CardTitle>All Car Assignments</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingAssignments ? (
                <p className="text-center text-muted-foreground py-4">Loading...</p>
              ) : allAssignments.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No assignments yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Supervisor</TableHead>
                      <TableHead>Assigned On</TableHead>
                      <TableHead>Notes</TableHead>
                      {isAdmin && <TableHead className="w-[80px]">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allAssignments.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <div>
                            <span className="font-medium">{a.cars.vehicle_number}</span>
                            <span className="text-muted-foreground ml-2">{a.cars.model}</span>
                          </div>
                        </TableCell>
                        <TableCell>{a.supervisor?.name || 'Unknown'}</TableCell>
                        <TableCell>{format(new Date(a.assigned_at), 'dd MMM yyyy')}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {a.notes || '-'}
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleUnassign(a.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
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

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Supervisor Activity Log</CardTitle>
                <Select value={activityFilter} onValueChange={setActivityFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="All supervisors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All supervisors</SelectItem>
                    {supervisors.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {loadingActivity ? (
                <p className="text-center text-muted-foreground py-4">Loading...</p>
              ) : activityLogs.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No activity recorded yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supervisor</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activityLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{log.supervisor?.name || 'Unknown'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{getActionTypeLabel(log.action_type)}</Badge>
                        </TableCell>
                        <TableCell>
                          {log.cars ? (
                            <span>
                              {log.cars.vehicle_number} - {log.cars.model}
                            </span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {log.action_details ? JSON.stringify(log.action_details) : '-'}
                        </TableCell>
                        <TableCell>
                          {format(new Date(log.created_at), 'dd MMM yyyy HH:mm')}
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
