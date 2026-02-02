import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCarsWithStatus } from '@/hooks/use-cars';
import { useCarsInDowntime } from '@/hooks/use-downtime';
import { useCarUtilization, useHighMaintenanceData } from '@/hooks/use-dashboard';
import { useSupervisorAssignments } from '@/hooks/use-car-assignments';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect } from '@/components/ui/searchable-select';
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
  Car,
  Plus,
  Search,
  Eye,
  Gauge,
  Wrench,
  Loader2,
  AlertTriangle,
  PauseCircle,
  TrendingUp,
  TrendingDown,
  HelpCircle,
} from 'lucide-react';

// Component to show high maintenance badge with tooltip
function HighMaintenanceBadge({ carId }: { carId: string }) {
  const { data: maintenanceData } = useHighMaintenanceData(carId);
  
  if (!maintenanceData?.isHighMaintenance) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="error" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          High Maint.
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="font-medium mb-1">High Maintenance Flag</p>
        <ul className="text-xs space-y-1">
          <li>• Cost (180d): ₹{maintenanceData.maintenance_cost_180d.toLocaleString()}</li>
          <li>• Downtime (90d): {maintenanceData.downtime_days_90d} days</li>
          <li>• Incidents (180d): {maintenanceData.incidents_180d}</li>
        </ul>
        <p className="text-xs mt-2 text-muted-foreground">
          Guidance flag based on last 3-6 months data
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

export default function Fleet() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [fuelFilter, setFuelFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('attention');

  const { user, isSupervisor, isAdmin, isManager } = useAuth();
  const { data: cars, isLoading } = useCarsWithStatus();
  const { data: carsInDowntime } = useCarsInDowntime();
  const { data: utilization } = useCarUtilization();
  const { data: supervisorAssignments } = useSupervisorAssignments(isSupervisor ? user?.id : undefined);

  // Create a set of car IDs that are in downtime
  const downtimeCarIds = new Set(carsInDowntime?.map((d: any) => d.car_id) || []);

  // Create a map of car utilization
  const utilizationMap = new Map(
    utilization?.map((u) => [u.car_id, u]) || []
  );

  // For supervisors, filter cars to only assigned ones
  const assignedCarIds = new Set(supervisorAssignments?.map((a) => a.car_id) || []);

  // Filter and sort cars
  const filteredCars = cars?.filter((car) => {
    // For supervisors, only show assigned cars
    if (isSupervisor && !assignedCarIds.has(car.id)) return false;

    const matchesSearch =
      car.vehicle_number.toLowerCase().includes(search.toLowerCase()) ||
      car.model.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'downtime' ? downtimeCarIds.has(car.id) : car.status === statusFilter);
    const matchesFuel = fuelFilter === 'all' || car.fuel_type === fuelFilter;

    return matchesSearch && matchesStatus && matchesFuel;
  }) || [];

  const sortedCars = [...filteredCars].sort((a, b) => {
    if (sortBy === 'attention') {
      const statusOrder = { overdue: 0, 'due-soon': 1, ok: 2 };
      return (statusOrder[a.next_critical_status] || 2) - (statusOrder[b.next_critical_status] || 2);
    }
    if (sortBy === 'vehicle') {
      return a.vehicle_number.localeCompare(b.vehicle_number);
    }
    if (sortBy === 'km') {
      return b.current_km - a.current_km;
    }
    return 0;
  });

  const fuelTypes = [...new Set(cars?.map(c => c.fuel_type).filter(Boolean))];

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'downtime', label: 'In Downtime' },
  ];

  const fuelOptions = [
    { value: 'all', label: 'All Fuel Types' },
    ...fuelTypes.map((fuel) => ({ value: fuel!, label: fuel! })),
  ];

  const sortOptions = [
    { value: 'attention', label: 'Needs Attention First' },
    { value: 'vehicle', label: 'Vehicle Number' },
    { value: 'km', label: 'Highest KM First' },
  ];

  const getUtilizationBadge = (carId: string) => {
    const util = utilizationMap.get(carId);
    if (!util) return null;

    if (util.label === 'insufficient-data') {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="muted" className="gap-1">
              <HelpCircle className="h-3 w-3" />
              N/A
            </Badge>
          </TooltipTrigger>
          <TooltipContent>Not enough data for utilization</TooltipContent>
        </Tooltip>
      );
    }

    if (util.label === 'over-used') {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="warning" className="gap-1">
              <TrendingUp className="h-3 w-3" />
              High Use
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            {util.usage_30d_km?.toLocaleString()} km in 30 days (above average)
          </TooltipContent>
        </Tooltip>
      );
    }

    if (util.label === 'under-used') {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="accent" className="gap-1">
              <TrendingDown className="h-3 w-3" />
              Low Use
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            {util.usage_30d_km?.toLocaleString()} km in 30 days (below average)
          </TooltipContent>
        </Tooltip>
      );
    }

    return null;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Fleet</h1>
          <p className="text-muted-foreground">
            {isSupervisor 
              ? `Your assigned vehicles (${filteredCars.length})` 
              : 'Manage your vehicles'}
          </p>
        </div>
        {(isAdmin || isManager) && (
          <Button asChild>
            <Link to="/app/fleet/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Vehicle
            </Link>
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by vehicle number or model..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <SearchableSelect
              options={statusOptions}
              value={statusFilter}
              onValueChange={setStatusFilter}
              placeholder="Status"
              triggerClassName="w-[160px]"
            />
            <SearchableSelect
              options={fuelOptions}
              value={fuelFilter}
              onValueChange={setFuelFilter}
              placeholder="Fuel Type"
              triggerClassName="w-[160px]"
            />
            <SearchableSelect
              options={sortOptions}
              value={sortBy}
              onValueChange={setSortBy}
              placeholder="Sort by"
              triggerClassName="w-[180px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Fleet Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Car className="h-5 w-5" />
            Vehicles ({sortedCars.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : sortedCars.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Fuel</TableHead>
                    <TableHead>Current KM</TableHead>
                    <TableHead>Service Status</TableHead>
                    <TableHead>Utilization</TableHead>
                    <TableHead>Flags</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedCars.map((car) => (
                    <TableRow key={car.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {car.vehicle_number}
                          {downtimeCarIds.has(car.id) && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="muted" className="gap-1">
                                  <PauseCircle className="h-3 w-3" />
                                  Downtime
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>Currently in downtime</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p>{car.model}</p>
                          {car.year && (
                            <p className="text-xs text-muted-foreground">{car.year}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {car.fuel_type && (
                          <Badge variant="muted">{car.fuel_type}</Badge>
                        )}
                      </TableCell>
                      <TableCell>{car.current_km.toLocaleString()} km</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge
                            variant={
                              car.next_critical_status === 'overdue'
                                ? 'error'
                                : car.next_critical_status === 'due-soon'
                                ? 'warning'
                                : 'success'
                            }
                          >
                            {car.next_critical_status === 'overdue'
                              ? 'Overdue'
                              : car.next_critical_status === 'due-soon'
                              ? 'Due Soon'
                              : 'OK'}
                          </Badge>
                          {car.next_critical_info && (
                            <span className="text-xs text-muted-foreground">
                              {car.next_critical_info.service_name}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getUtilizationBadge(car.id)}
                      </TableCell>
                      <TableCell>
                        <HighMaintenanceBadge carId={car.id} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" asChild>
                            <Link to={`/app/fleet/${car.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" asChild>
                            <Link to={`/odometer?car=${car.id}`}>
                              <Gauge className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" asChild>
                            <Link to={`/services/new?car=${car.id}`}>
                              <Wrench className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Car className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">No vehicles found</h3>
              <p className="text-muted-foreground mb-4">
                {search || statusFilter !== 'all' || fuelFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Get started by adding your first vehicle'}
              </p>
              {!search && statusFilter === 'all' && fuelFilter === 'all' && (
                <Button asChild>
                  <Link to="/app/fleet/new">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Vehicle
                  </Link>
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
