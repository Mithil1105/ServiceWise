import { Fragment, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useServicePlannerItems } from '@/hooks/use-services';
import { useAssignedCarIdsForCurrentUser } from '@/hooks/use-car-assignments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertTriangle, Wrench, Loader2, Calendar, Filter, ChevronDown, ChevronRight } from 'lucide-react';
import { addDays, isBefore, isAfter, parseISO } from 'date-fns';
import { formatDateDMY } from '@/lib/date';
import { formatCarLabel } from '@/lib/utils';

type DateFilterValue = 'all' | '7' | '14' | '30' | 'custom';

export default function CriticalQueue() {
  const { data: plannerItems, isLoading } = useServicePlannerItems();
  const { assignedCarIds } = useAssignedCarIdsForCurrentUser();

  const scopedCriticalServices = useMemo(() => {
    if (!plannerItems) return [];
    if (!assignedCarIds) return plannerItems;
    return plannerItems.filter((s) => assignedCarIds.includes(s.car_id));
  }, [plannerItems, assignedCarIds]);

  // Date range filter
  const [dateFilter, setDateFilter] = useState<DateFilterValue>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCars, setExpandedCars] = useState<Record<string, boolean>>({});

  const servicesWithDates = scopedCriticalServices;

  // Filter by date range
  const filteredServices = useMemo(() => {
    if (!servicesWithDates.length) return [];
    if (dateFilter === 'all') return servicesWithDates;

    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (dateFilter === 'custom') {
      startDate = customStartDate ? parseISO(customStartDate) : null;
      endDate = customEndDate ? parseISO(customEndDate) : null;
    } else {
      const days = parseInt(dateFilter);
      startDate = now;
      endDate = addDays(now, days);
    }

    return servicesWithDates.filter(service => {
      if (service.status === 'overdue') return true; // Always show overdue
      if (!service.estimated_due_date) return false;
      const dueDate = new Date(service.estimated_due_date);
      if (startDate && isBefore(dueDate, startDate)) return false;
      if (endDate && isAfter(dueDate, endDate)) return false;
      return true;
    });
  }, [servicesWithDates, dateFilter, customStartDate, customEndDate]);

  const groupedCars = useMemo(() => {
    const statusRank = { overdue: 0, 'due-soon': 1, upcoming: 2 } as const;
    const map = new Map<string, { car_id: string; vehicle_number: string; model?: string | null; brand?: string | null; services: typeof filteredServices; nearest: (typeof filteredServices)[number] }>();

    for (const item of filteredServices) {
      const existing = map.get(item.car_id);
      if (!existing) {
        map.set(item.car_id, {
          car_id: item.car_id,
          vehicle_number: item.vehicle_number,
          model: item.model,
          brand: item.brand,
          services: [item],
          nearest: item,
        });
        continue;
      }

      existing.services.push(item);
      const a = existing.nearest;
      const b = item;
      const aRank = statusRank[a.status];
      const bRank = statusRank[b.status];
      if (bRank < aRank) {
        existing.nearest = b;
      } else if (bRank === aRank) {
        const aDays = a.remaining_days ?? Number.MAX_SAFE_INTEGER;
        const bDays = b.remaining_days ?? Number.MAX_SAFE_INTEGER;
        if (bDays < aDays) existing.nearest = b;
      }
    }

    return Array.from(map.values())
      .map((group) => ({
        ...group,
        services: [...group.services].sort((a, b) => {
          const aRank = statusRank[a.status];
          const bRank = statusRank[b.status];
          if (aRank !== bRank) return aRank - bRank;
          const aDays = a.remaining_days ?? Number.MAX_SAFE_INTEGER;
          const bDays = b.remaining_days ?? Number.MAX_SAFE_INTEGER;
          return aDays - bDays;
        }),
      }))
      .sort((a, b) => {
        const aRank = statusRank[a.nearest.status];
        const bRank = statusRank[b.nearest.status];
        if (aRank !== bRank) return aRank - bRank;
        const aDays = a.nearest.remaining_days ?? Number.MAX_SAFE_INTEGER;
        const bDays = b.nearest.remaining_days ?? Number.MAX_SAFE_INTEGER;
        return aDays - bDays;
      });
  }, [filteredServices]);

  const searchedGroupedCars = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return groupedCars;
    return groupedCars.filter((group) => {
      const vehicleText = `${group.vehicle_number} ${group.brand ?? ''} ${group.model ?? ''}`.toLowerCase();
      if (vehicleText.includes(q)) return true;
      return group.services.some((svc) => svc.service_name.toLowerCase().includes(q));
    });
  }, [groupedCars, searchQuery]);

  const overdueCars = searchedGroupedCars.filter((g) => g.nearest.status === 'overdue');
  const dueSoonCars = searchedGroupedCars.filter((g) => g.nearest.status === 'due-soon');
  const upcomingCars = searchedGroupedCars.filter((g) => g.nearest.status === 'upcoming');

  const formatEstimationSource = (item: (typeof filteredServices)[number]) => {
    if (item.estimation_source === 'earliest-of-both') {
      return item.avg_daily_km_used
        ? `Earlier of trend (${item.avg_daily_km_used.toFixed(1)} km/day) and interval`
        : 'Earlier of trend and interval';
    }
    if (item.estimation_source === 'km-trend') {
      return item.avg_daily_km_used
        ? `Trend-based (${item.avg_daily_km_used.toFixed(1)} km/day)`
        : 'Trend-based';
    }
    if (item.estimation_source === 'interval-days') return 'Service interval date';
    return 'Insufficient history';
  };

  const renderTable = (groups: typeof groupedCars) => {
    if (!groups || groups.length === 0) {
      return (
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-medium mb-2">No critical services</h3>
          <p className="text-muted-foreground">All vehicles are up to date!</p>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead></TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Vehicle</TableHead>
            <TableHead>Nearest Service</TableHead>
            <TableHead>Current KM</TableHead>
            <TableHead>Due / Overdue</TableHead>
            <TableHead>Est. Due Date</TableHead>
            <TableHead>Method Used</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => {
            const item = group.nearest;
            const isExpanded = !!expandedCars[group.car_id];
            return (
              <Fragment key={group.car_id}>
                <TableRow key={`${group.car_id}-summary`}>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setExpandedCars((prev) => ({ ...prev, [group.car_id]: !prev[group.car_id] }))}
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.status === 'overdue' ? 'error' : item.status === 'due-soon' ? 'warning' : 'secondary'}>
                      {item.status === 'overdue' ? 'Overdue' : item.status === 'due-soon' ? 'Due Soon' : 'Upcoming'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Link
                      to={`/app/fleet/${item.car_id}`}
                      className="font-medium text-accent hover:underline"
                    >
                      {formatCarLabel(item)}
                    </Link>
                    <p className="text-xs text-muted-foreground">{group.services.length} service(s)</p>
                  </TableCell>
                  <TableCell className="font-medium">{item.service_name}</TableCell>
                  <TableCell>{item.current_km.toLocaleString()} km</TableCell>
                  <TableCell>
                    {item.status === 'overdue' ? (
                      <div className="space-y-0.5">
                        <span className="text-destructive font-medium block">
                          Overdue by {Math.abs(item.remaining_km ?? 0).toLocaleString()} km
                        </span>
                        <span className="text-destructive/80 text-xs block">
                          Alert pending for {Math.max(1, Math.abs(item.remaining_days ?? 0))} day(s)
                        </span>
                      </div>
                    ) : item.remaining_km != null ? (
                      <span className="text-warning font-medium">
                        Due in {item.remaining_km.toLocaleString()} km
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Distance-based N/A</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.status === 'overdue' ? (
                      <span className="text-destructive">Now!</span>
                    ) : item.estimated_due_date ? (
                      <span className="text-muted-foreground">
                        ~{formatDateDMY(item.estimated_due_date)}
                        {item.remaining_days != null && (
                          <span className="text-xs ml-1">({item.remaining_days}d)</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">{formatEstimationSource(item)}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/app/services/new?car=${item.car_id}`}>
                          <Wrench className="h-3 w-3 mr-1" />
                          Add Service
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow key={`${group.car_id}-expanded`}>
                    <TableCell colSpan={9} className="bg-muted/20">
                      <div className="space-y-2 py-2">
                        <p className="text-sm font-medium">All upcoming service dates for this car</p>
                        <div className="space-y-1">
                          {group.services.map((svc, idx) => (
                            <div key={`${svc.car_id}-${svc.service_name}-${svc.due_km ?? 'na'}-${idx}`} className="grid grid-cols-1 md:grid-cols-5 gap-2 text-xs border rounded-md p-2 bg-background">
                              <span className="font-medium">{svc.service_name}</span>
                              <span>
                                {svc.status === 'overdue'
                                  ? `Overdue by ${Math.abs(svc.remaining_km ?? 0).toLocaleString()} km · Alert pending ${Math.max(1, Math.abs(svc.remaining_days ?? 0))} day(s)`
                                  : svc.remaining_km != null
                                    ? `Due in ${svc.remaining_km.toLocaleString()} km`
                                    : 'Distance-based N/A'}
                              </span>
                              <span>
                                {svc.estimated_due_date
                                  ? `~${formatDateDMY(svc.estimated_due_date)}${svc.remaining_days != null ? ` (${svc.remaining_days}d)` : ''}`
                                  : 'N/A'}
                              </span>
                              <span>{formatEstimationSource(svc)}</span>
                              <span>
                                {svc.last_serviced_at
                                  ? `Last: ${formatDateDMY(svc.last_serviced_at)} @ ${svc.last_serviced_km?.toLocaleString() ?? '-'} km`
                                  : 'Last: Never'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            Critical Queue
          </h1>
          <p className="text-muted-foreground">Overdue, due-soon, and upcoming service planning for fleet cars</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filter by Due Date:</span>
            </div>

            <div className="flex items-center gap-2">
              <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilterValue)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Services</SelectItem>
                  <SelectItem value="7">Due in 7 days</SelectItem>
                  <SelectItem value="14">Due in 14 days</SelectItem>
                  <SelectItem value="30">Due in 30 days</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {dateFilter === 'custom' && (
              <>
                <div className="flex items-center gap-2">
                  <Label className="text-sm">From:</Label>
                  <Input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-40"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm">To:</Label>
                  <Input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-40"
                  />
                </div>
              </>
            )}

            <div className="flex items-center gap-2">
              <Label className="text-sm">Search:</Label>
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Vehicle, model, brand, service..."
                className="w-64"
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Estimation uses each car&apos;s own odometer trend when available; otherwise interval-days date. If both exist, earlier date is used.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="stat-card border-destructive/30">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Overdue</p>
              <p className="text-2xl font-bold text-destructive">{overdueCars.length}</p>
            </div>
          </div>
        </Card>

        <Card className="stat-card border-warning/30">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-warning/10">
              <Calendar className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Due Soon</p>
              <p className="text-2xl font-bold text-warning">{dueSoonCars.length}</p>
            </div>
          </div>
        </Card>

        <Card className="stat-card">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-muted">
              <Wrench className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Upcoming</p>
              <p className="text-2xl font-bold">{upcomingCars.length}</p>
            </div>
          </div>
        </Card>
        <Card className="stat-card">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-muted">
              <Wrench className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Services</p>
              <p className="text-2xl font-bold">{searchedGroupedCars.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Card>
        <CardHeader className="pb-0">
          <Tabs defaultValue="all" className="w-full">
            <TabsList>
              <TabsTrigger value="all">
                All Critical ({filteredServices.length})
              </TabsTrigger>
              <TabsTrigger value="overdue" className="text-destructive">
                Overdue ({overdueCars.length})
              </TabsTrigger>
              <TabsTrigger value="due-soon" className="text-warning">
                Due Soon ({dueSoonCars.length})
              </TabsTrigger>
              <TabsTrigger value="upcoming">
                Upcoming ({upcomingCars.length})
              </TabsTrigger>
            </TabsList>

            <CardContent className="pt-6 px-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <TabsContent value="all">{renderTable(searchedGroupedCars)}</TabsContent>
                  <TabsContent value="overdue">{renderTable(overdueCars)}</TabsContent>
                  <TabsContent value="due-soon">{renderTable(dueSoonCars)}</TabsContent>
                  <TabsContent value="upcoming">{renderTable(upcomingCars)}</TabsContent>
                </>
              )}
            </CardContent>
          </Tabs>
        </CardHeader>
      </Card>
    </div>
  );
}
