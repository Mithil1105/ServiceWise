import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCars } from '@/hooks/use-cars';
import { useServiceRecords } from '@/hooks/use-services';
import { useDowntimeLogs } from '@/hooks/use-downtime';
import { useIncidents } from '@/hooks/use-incidents';
import { useOdometerEntries } from '@/hooks/use-odometer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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
  Heart,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Wrench,
  PauseCircle,
  Activity,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  HelpCircle,
} from 'lucide-react';

interface VehicleHealthData {
  carId: string;
  vehicleNumber: string;
  model: string;
  healthScore: number;
  serviceScore: number;
  incidentScore: number;
  downtimeScore: number;
  odoScore: number;
  recentServices: number;
  recentIncidents: number;
  downtimeDays: number;
  lastOdoReadingDays: number;
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
}

export default function VehicleHealthScore() {
  const { data: cars, isLoading: carsLoading } = useCars();
  const { data: serviceRecords, isLoading: servicesLoading } = useServiceRecords();
  const { data: downtimeLogs, isLoading: downtimeLoading } = useDowntimeLogs();
  const { data: incidents, isLoading: incidentsLoading } = useIncidents();
  const { data: odometerEntries, isLoading: odoLoading } = useOdometerEntries();

  const isLoading = carsLoading || servicesLoading || downtimeLoading || incidentsLoading || odoLoading;

  const healthData = useMemo(() => {
    if (!cars) return [];

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    return cars
      .filter(car => car.status === 'active')
      .map(car => {
        // Service score (based on services in last 90 days)
        const carServices = (serviceRecords || []).filter(
          s => s.car_id === car.id && new Date(s.serviced_at) >= ninetyDaysAgo
        );
        const recentServices = carServices.length;
        // More services = better (up to 3 services in 90 days is ideal)
        const serviceScore = Math.min(100, (recentServices / 3) * 100);

        // Incident score (fewer incidents = better)
        const carIncidents = (incidents || []).filter(
          i => i.car_id === car.id && new Date(i.incident_at) >= ninetyDaysAgo
        );
        const recentIncidents = carIncidents.length;
        const highSeverityIncidents = carIncidents.filter(i => i.severity === 'high').length;
        // 0 incidents = 100, each incident deducts 20, high severity deducts extra 15
        const incidentScore = Math.max(0, 100 - (recentIncidents * 20) - (highSeverityIncidents * 15));

        // Downtime score (less downtime = better)
        const carDowntime = (downtimeLogs || []).filter(d => d.car_id === car.id);
        let downtimeDays = 0;
        for (const log of carDowntime) {
          const start = new Date(log.started_at);
          const end = log.ended_at ? new Date(log.ended_at) : now;
          // Only count downtime in last 90 days
          if (start >= ninetyDaysAgo) {
            downtimeDays += (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
          }
        }
        downtimeDays = Math.round(downtimeDays * 10) / 10;
        // 0-2 days = 100, 3-5 days = 80, 6-10 days = 60, etc.
        const downtimeScore = Math.max(0, 100 - (downtimeDays * 5));

        // Odometer reading freshness
        const carOdo = (odometerEntries || [])
          .filter(o => o.car_id === car.id)
          .sort((a, b) => new Date(b.reading_at).getTime() - new Date(a.reading_at).getTime());
        const lastOdoDate = carOdo[0]?.reading_at;
        const lastOdoReadingDays = lastOdoDate 
          ? Math.round((now.getTime() - new Date(lastOdoDate).getTime()) / (1000 * 60 * 60 * 24))
          : 999;
        // Fresh readings (< 7 days) = 100, older = lower score
        const odoScore = lastOdoReadingDays <= 7 ? 100 : 
                        lastOdoReadingDays <= 14 ? 80 :
                        lastOdoReadingDays <= 30 ? 60 :
                        lastOdoReadingDays <= 60 ? 40 : 20;

        // Calculate overall health score (weighted average)
        const healthScore = Math.round(
          (serviceScore * 0.25) + 
          (incidentScore * 0.35) + 
          (downtimeScore * 0.30) +
          (odoScore * 0.10)
        );

        // Determine status
        let status: VehicleHealthData['status'];
        if (healthScore >= 90) status = 'excellent';
        else if (healthScore >= 75) status = 'good';
        else if (healthScore >= 60) status = 'fair';
        else if (healthScore >= 40) status = 'poor';
        else status = 'critical';

        return {
          carId: car.id,
          vehicleNumber: car.vehicle_number,
          model: car.model,
          healthScore,
          serviceScore: Math.round(serviceScore),
          incidentScore: Math.round(incidentScore),
          downtimeScore: Math.round(downtimeScore),
          odoScore,
          recentServices,
          recentIncidents,
          downtimeDays,
          lastOdoReadingDays,
          status,
        } as VehicleHealthData;
      })
      .sort((a, b) => a.healthScore - b.healthScore); // Worst first
  }, [cars, serviceRecords, downtimeLogs, incidents, odometerEntries]);

  const stats = useMemo(() => {
    if (!healthData.length) return null;

    const avgHealth = Math.round(healthData.reduce((sum, h) => sum + h.healthScore, 0) / healthData.length);
    const excellent = healthData.filter(h => h.status === 'excellent').length;
    const good = healthData.filter(h => h.status === 'good').length;
    const fair = healthData.filter(h => h.status === 'fair').length;
    const poor = healthData.filter(h => h.status === 'poor').length;
    const critical = healthData.filter(h => h.status === 'critical').length;

    return { avgHealth, excellent, good, fair, poor, critical };
  }, [healthData]);

  const getStatusColor = (status: VehicleHealthData['status']) => {
    switch (status) {
      case 'excellent': return 'text-green-500';
      case 'good': return 'text-blue-500';
      case 'fair': return 'text-yellow-500';
      case 'poor': return 'text-orange-500';
      case 'critical': return 'text-red-500';
    }
  };

  const getStatusBadgeVariant = (status: VehicleHealthData['status']) => {
    switch (status) {
      case 'excellent': return 'success';
      case 'good': return 'default';
      case 'fair': return 'warning';
      case 'poor': return 'warning';
      case 'critical': return 'error';
    }
  };

  const getScoreIcon = (score: number) => {
    if (score >= 80) return <TrendingUp className="h-3 w-3 text-green-500" />;
    if (score >= 50) return <Minus className="h-3 w-3 text-yellow-500" />;
    return <TrendingDown className="h-3 w-3 text-red-500" />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex items-center gap-2">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Heart className="h-6 w-6 text-primary" />
            Vehicle Health Score
          </h1>
          <p className="text-muted-foreground">
            Combined health metrics based on service history, incidents, and downtime
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
          </TooltipTrigger>
          <TooltipContent className="max-w-sm">
            <p className="font-medium mb-1">How Health Score is Calculated:</p>
            <ul className="text-xs space-y-1">
              <li>• <strong>Services (25%)</strong>: Recent maintenance activity</li>
              <li>• <strong>Incidents (35%)</strong>: Fewer incidents = higher score</li>
              <li>• <strong>Downtime (30%)</strong>: Less downtime = higher score</li>
              <li>• <strong>Odometer (10%)</strong>: Fresh readings = higher score</li>
            </ul>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="stat-card col-span-2">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Fleet Avg. Health</p>
              <p className="text-2xl font-bold">{stats?.avgHealth || 0}%</p>
            </div>
          </div>
        </Card>

        <Card className="stat-card">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-lg bg-green-500/10">
              <CheckCircle className="h-4 w-4 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Excellent</p>
              <p className="text-xl font-bold">{stats?.excellent || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="stat-card">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <CheckCircle className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Good</p>
              <p className="text-xl font-bold">{stats?.good || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="stat-card">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-lg bg-yellow-500/10">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Fair/Poor</p>
              <p className="text-xl font-bold">{(stats?.fair || 0) + (stats?.poor || 0)}</p>
            </div>
          </div>
        </Card>

        <Card className="stat-card border-destructive/30">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-lg bg-red-500/10">
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Critical</p>
              <p className="text-xl font-bold text-destructive">{stats?.critical || 0}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Health Score Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Vehicles Health</CardTitle>
          <CardDescription>Sorted by health score (worst first for attention)</CardDescription>
        </CardHeader>
        <CardContent>
          {healthData.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Health Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      <Wrench className="h-3 w-3" />
                      Services
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Incidents
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      <PauseCircle className="h-3 w-3" />
                      Downtime
                    </div>
                  </TableHead>
                  <TableHead>Last Odo</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {healthData.map((vehicle) => (
                  <TableRow key={vehicle.carId}>
                    <TableCell>
                      <Link
                        to={`/fleet/${vehicle.carId}`}
                        className="font-medium hover:text-primary"
                      >
                        {vehicle.vehicleNumber}
                      </Link>
                      <span className="text-sm text-muted-foreground ml-2">
                        {vehicle.model}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3 min-w-[120px]">
                        <Progress 
                          value={vehicle.healthScore} 
                          className="h-2 flex-1"
                        />
                        <span className={`font-bold ${getStatusColor(vehicle.status)}`}>
                          {vehicle.healthScore}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(vehicle.status) as any}>
                        {vehicle.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {getScoreIcon(vehicle.serviceScore)}
                        <span>{vehicle.recentServices} (90d)</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {getScoreIcon(vehicle.incidentScore)}
                        <span className={vehicle.recentIncidents > 0 ? 'text-destructive' : ''}>
                          {vehicle.recentIncidents} (90d)
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {getScoreIcon(vehicle.downtimeScore)}
                        <span className={vehicle.downtimeDays > 5 ? 'text-warning' : ''}>
                          {vehicle.downtimeDays}d
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={vehicle.lastOdoReadingDays > 30 ? 'text-warning' : 'text-muted-foreground'}>
                        {vehicle.lastOdoReadingDays < 999 ? `${vehicle.lastOdoReadingDays}d ago` : 'Never'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/fleet/${vehicle.carId}`}>
                          View →
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Heart className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No active vehicles found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
