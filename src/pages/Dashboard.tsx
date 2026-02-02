import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { useCarsWithStatus } from '@/hooks/use-cars';
import { useCriticalServices } from '@/hooks/use-services';
import { useIsSnoozed, useDismissForToday } from '@/hooks/use-snooze';
import { useAttentionItems, useMonthlySnapshot, useCarUtilization } from '@/hooks/use-dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Car,
  AlertTriangle,
  Clock,
  Gauge,
  Wrench,
  ChevronRight,
  X,
  TrendingUp,
  DollarSign,
  HelpCircle,
  AlertCircle,
  PauseCircle,
  TrendingDown,
} from 'lucide-react';
import { format } from 'date-fns';
import SupervisorDashboard from '@/components/dashboard/SupervisorDashboard';

export default function Dashboard() {
  const { isSupervisor, isAdmin, isManager } = useAuth();
  // If user is only a supervisor (not admin or manager), show supervisor dashboard
  if (isSupervisor && !isAdmin && !isManager) {
    return <SupervisorDashboard />;
  }

  const [showCriticalPopup, setShowCriticalPopup] = useState(false);
  const { data: cars, isLoading: carsLoading } = useCarsWithStatus();
  const { data: criticalServices, isLoading: criticalLoading } = useCriticalServices();
  const { data: attentionItems, isLoading: attentionLoading } = useAttentionItems();
  const { data: snapshot, isLoading: snapshotLoading } = useMonthlySnapshot();
  const { data: utilization } = useCarUtilization();
  const isSnoozed = useIsSnoozed();
  const dismissMutation = useDismissForToday();

  const activeCars = cars?.filter(c => c.status === 'active') || [];
  const overdue = criticalServices?.filter(s => s.status === 'overdue') || [];
  const dueSoon = criticalServices?.filter(s => s.status === 'due-soon') || [];

  // Get over-used and under-used cars
  const overUsedCars = utilization?.filter(u => u.label === 'over-used').slice(0, 3) || [];
  const underUsedCars = utilization?.filter(u => u.label === 'under-used').slice(0, 3) || [];

  useEffect(() => {
    if (!criticalLoading && criticalServices && criticalServices.length > 0 && !isSnoozed) {
      setShowCriticalPopup(true);
    }
  }, [criticalServices, criticalLoading, isSnoozed]);

  const handleDismiss = () => {
    dismissMutation.mutate();
    setShowCriticalPopup(false);
  };

  const currentMonth = format(new Date(), 'MMMM yyyy');

  const getAttentionIcon = (type: string) => {
    switch (type) {
      case 'overdue':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'due-soon':
        return <Clock className="h-4 w-4 text-warning" />;
      case 'downtime':
        return <PauseCircle className="h-4 w-4 text-muted-foreground" />;
      case 'incident':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'stale-odometer':
        return <Gauge className="h-4 w-4 text-accent" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title text-xl md:text-2xl">Dashboard</h1>
          <p className="text-muted-foreground text-sm md:text-base">Fleet overview and alerts</p>
        </div>
      </div>

      {/* Monthly Snapshot */}
      <Card className="border-accent/20 bg-accent/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base md:text-lg flex items-center gap-2">
            <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-accent flex-shrink-0" />
            <span className="truncate">{currentMonth} at a Glance</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {snapshotLoading ? (
            <div className="text-center py-4 text-muted-foreground">Loading...</div>
          ) : snapshot ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <p className="text-xl md:text-2xl font-bold">{snapshot.kmDriven.toLocaleString()}</p>
                  {snapshot.kmWarning && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3 w-3 md:h-4 md:w-4 text-warning flex-shrink-0" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        {snapshot.kmWarning}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <p className="text-xs md:text-sm text-muted-foreground">KM Driven</p>
              </div>
              <div className="text-center">
                <p className="text-xl md:text-2xl font-bold">{snapshot.servicesCompleted}</p>
                <p className="text-xs md:text-sm text-muted-foreground">Services Completed</p>
              </div>
              <div className="text-center">
                <p className={`text-xl md:text-2xl font-bold ${snapshot.criticalAlerts > 0 ? 'text-destructive' : ''}`}>
                  {snapshot.criticalAlerts}
                </p>
                <p className="text-xs md:text-sm text-muted-foreground">Critical Alerts</p>
              </div>
              <div className="text-center">
                <p className="text-xl md:text-2xl font-bold">₹{snapshot.expenses.toLocaleString()}</p>
                <p className="text-xs md:text-sm text-muted-foreground">Expenses</p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* What Needs Attention Today */}
      <Card className={attentionItems && attentionItems.length > 0 ? 'border-warning/30' : ''}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base md:text-lg flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 text-warning flex-shrink-0" />
            <span className="truncate">What Needs Attention Today</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {attentionLoading ? (
            <div className="text-center py-4 text-muted-foreground">Loading...</div>
          ) : attentionItems && attentionItems.length > 0 ? (
            <div className="space-y-2">
              {attentionItems.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="flex-shrink-0 mt-0.5">
                      {getAttentionIcon(item.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" asChild className="w-full sm:w-auto flex-shrink-0">
                    <Link to={item.actionLink}>
                      {item.actionLabel}
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Wrench className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm md:text-base">All caught up! No immediate attention needed.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card className="stat-card">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="p-2 md:p-3 rounded-lg bg-primary/10 flex-shrink-0">
              <Car className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground">Active Vehicles</p>
              <p className="text-xl md:text-2xl font-bold">{activeCars.length}</p>
            </div>
          </div>
        </Card>

        <Card className="stat-card">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="p-2 md:p-3 rounded-lg bg-destructive/10 flex-shrink-0">
              <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 text-destructive" />
            </div>
            <div className="min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground">Critical Overdue</p>
              <p className="text-xl md:text-2xl font-bold text-destructive">{overdue.length}</p>
            </div>
          </div>
        </Card>

        <Card className="stat-card">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="p-2 md:p-3 rounded-lg bg-warning/10 flex-shrink-0">
              <Clock className="h-4 w-4 md:h-5 md:w-5 text-warning" />
            </div>
            <div className="min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground">Due Soon</p>
              <p className="text-xl md:text-2xl font-bold text-warning">{dueSoon.length}</p>
            </div>
          </div>
        </Card>

        <Card className="stat-card">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="p-2 md:p-3 rounded-lg bg-accent/10 flex-shrink-0">
              <Gauge className="h-4 w-4 md:h-5 md:w-5 text-accent" />
            </div>
            <div className="min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground">Total Services</p>
              <p className="text-xl md:text-2xl font-bold">{criticalServices?.length || 0}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Critical Queue Preview */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2">
          <CardTitle className="text-base md:text-lg flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 text-destructive flex-shrink-0" />
            <span>Critical Queue</span>
          </CardTitle>
          <Button variant="ghost" size="sm" asChild className="w-full sm:w-auto">
            <Link to="/critical">
              View all <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {criticalLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : criticalServices && criticalServices.length > 0 ? (
            <div className="space-y-2">
              {criticalServices.slice(0, 10).map((item) => (
                <div
                  key={`${item.car_id}-${item.service_name}`}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                    <Badge variant={item.status === 'overdue' ? 'error' : 'warning'} className="flex-shrink-0">
                      {item.status === 'overdue' ? 'Overdue' : 'Due Soon'}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{item.vehicle_number}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.service_name}</p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right flex-shrink-0">
                    <p className="text-xs sm:text-sm font-medium">
                      {item.status === 'overdue'
                        ? `Overdue by ${Math.abs(item.remaining_km).toLocaleString()} km`
                        : `Due in ${item.remaining_km.toLocaleString()} km`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Current: {item.current_km.toLocaleString()} km
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Wrench className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm md:text-base">No critical services pending</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Utilization Overview */}
      {(overUsedCars.length > 0 || underUsedCars.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {overUsedCars.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base md:text-lg flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-warning flex-shrink-0" />
                  <span className="truncate">High Usage (30 days)</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {overUsedCars.map((car) => (
                    <Link
                      key={car.car_id}
                      to={`/fleet/${car.car_id}`}
                      className="flex items-center justify-between gap-2 p-3 rounded-lg bg-warning/5 hover:bg-warning/10 transition-colors"
                    >
                      <span className="font-medium text-sm truncate">{car.vehicle_number}</span>
                      <span className="text-xs md:text-sm text-muted-foreground flex-shrink-0">
                        {car.usage_30d_km?.toLocaleString()} km
                      </span>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {underUsedCars.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base md:text-lg flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 md:h-5 md:w-5 text-accent flex-shrink-0" />
                  <span className="truncate">Low Usage (30 days)</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {underUsedCars.map((car) => (
                    <Link
                      key={car.car_id}
                      to={`/fleet/${car.car_id}`}
                      className="flex items-center justify-between gap-2 p-3 rounded-lg bg-accent/5 hover:bg-accent/10 transition-colors"
                    >
                      <span className="font-medium text-sm truncate">{car.vehicle_number}</span>
                      <span className="text-xs md:text-sm text-muted-foreground flex-shrink-0">
                        {car.usage_30d_km?.toLocaleString()} km
                      </span>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Recent Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base md:text-lg flex items-center gap-2">
              <Car className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0" />
              <span>Fleet Status</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {carsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : activeCars.length > 0 ? (
              <div className="space-y-2">
                {activeCars.slice(0, 5).map((car) => (
                  <Link
                    key={car.id}
                    to={`/fleet/${car.id}`}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{car.vehicle_number}</p>
                      <p className="text-xs text-muted-foreground truncate">{car.model}</p>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                      <span className="text-xs sm:text-sm text-muted-foreground">
                        {car.current_km.toLocaleString()} km
                      </span>
                      <Badge
                        variant={
                          car.next_critical_status === 'overdue'
                            ? 'error'
                            : car.next_critical_status === 'due-soon'
                            ? 'warning'
                            : 'success'
                        }
                        className="text-[10px] sm:text-xs"
                      >
                        {car.next_critical_status === 'overdue'
                          ? 'Overdue'
                          : car.next_critical_status === 'due-soon'
                          ? 'Due Soon'
                          : 'OK'}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Car className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm md:text-base">No vehicles in fleet</p>
                <Button asChild className="mt-4" variant="outline" size="sm">
                  <Link to="/fleet/new">Add First Vehicle</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base md:text-lg flex items-center gap-2">
              <Wrench className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0" />
              <span>Quick Actions</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 md:space-y-3">
            <Button asChild className="w-full justify-start" variant="outline" size="sm">
              <Link to="/fleet/new">
                <Car className="h-4 w-4 mr-2 flex-shrink-0" />
                Add New Vehicle
              </Link>
            </Button>
            <Button asChild className="w-full justify-start" variant="outline" size="sm">
              <Link to="/odometer">
                <Gauge className="h-4 w-4 mr-2 flex-shrink-0" />
                Update Odometer
              </Link>
            </Button>
            <Button asChild className="w-full justify-start" variant="outline" size="sm">
              <Link to="/services/new">
                <Wrench className="h-4 w-4 mr-2 flex-shrink-0" />
                Add Service Record
              </Link>
            </Button>
            <Button asChild className="w-full justify-start" variant="outline" size="sm">
              <Link to="/incidents">
                <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                Log Incident
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Critical Popup Modal */}
      <Dialog open={showCriticalPopup} onOpenChange={setShowCriticalPopup}>
        <DialogContent className="max-w-lg mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive text-base md:text-lg">
              <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0" />
              <span>Critical Service Alerts</span>
            </DialogTitle>
            <DialogDescription className="text-sm">
              The following vehicles require immediate attention.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2 md:gap-4 mb-4">
            <Badge variant="error" className="px-2 md:px-3 py-1 text-xs">
              Overdue Critical: {overdue.length}
            </Badge>
            <Badge variant="warning" className="px-2 md:px-3 py-1 text-xs">
              Due Soon Critical: {dueSoon.length}
            </Badge>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {criticalServices?.slice(0, 5).map((item) => (
              <div
                key={`${item.car_id}-${item.service_name}`}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{item.vehicle_number}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.service_name}</p>
                </div>
                <span className={`text-xs sm:text-sm font-medium flex-shrink-0 ${item.status === 'overdue' ? 'text-destructive' : 'text-warning'}`}>
                  {item.status === 'overdue'
                    ? `Overdue by ${Math.abs(item.remaining_km).toLocaleString()} km`
                    : `Due in ${item.remaining_km.toLocaleString()} km`}
                </span>
              </div>
            ))}
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleDismiss} className="w-full sm:w-auto" size="sm">
              <X className="h-4 w-4 mr-2" />
              Dismiss for today
            </Button>
            <Button asChild className="w-full sm:w-auto" size="sm">
              <Link to="/critical" onClick={() => setShowCriticalPopup(false)}>
                Open Critical Queue
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
