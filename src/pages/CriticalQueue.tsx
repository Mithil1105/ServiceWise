import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCriticalServices } from '@/hooks/use-services';
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
import { AlertTriangle, Wrench, Loader2, Calendar, Filter } from 'lucide-react';
import { format, addDays, isBefore, isAfter, parseISO } from 'date-fns';

// Estimated daily km for projecting service dates
const ESTIMATED_DAILY_KM = 150;

export default function CriticalQueue() {
  const { data: criticalServices, isLoading } = useCriticalServices();
  
  // Date range filter
  const [dateFilter, setDateFilter] = useState<'all' | '7' | '14' | '30' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Calculate estimated due date for each service
  const servicesWithDates = useMemo(() => {
    if (!criticalServices) return [];

    return criticalServices.map(service => {
      // Estimate when the service will be due based on remaining km
      const daysUntilDue = service.remaining_km / ESTIMATED_DAILY_KM;
      const estimatedDueDate = addDays(new Date(), daysUntilDue);
      
      return {
        ...service,
        estimatedDueDate,
        daysUntilDue: Math.round(daysUntilDue),
      };
    });
  }, [criticalServices]);

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
      
      const dueDate = service.estimatedDueDate;
      if (startDate && isBefore(dueDate, startDate)) return false;
      if (endDate && isAfter(dueDate, endDate)) return false;
      return true;
    });
  }, [servicesWithDates, dateFilter, customStartDate, customEndDate]);

  const overdue = filteredServices.filter((s) => s.status === 'overdue');
  const dueSoon = filteredServices.filter((s) => s.status === 'due-soon');

  const renderTable = (items: typeof filteredServices) => {
    if (!items || items.length === 0) {
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
            <TableHead>Status</TableHead>
            <TableHead>Vehicle</TableHead>
            <TableHead>Service</TableHead>
            <TableHead>Current KM</TableHead>
            <TableHead>Due / Overdue</TableHead>
            <TableHead>Est. Due Date</TableHead>
            <TableHead>Last Serviced</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={`${item.car_id}-${item.service_name}`}>
              <TableCell>
                <Badge variant={item.status === 'overdue' ? 'error' : 'warning'}>
                  {item.status === 'overdue' ? 'Overdue' : 'Due Soon'}
                </Badge>
              </TableCell>
              <TableCell>
                <Link
                  to={`/fleet/${item.car_id}`}
                  className="font-medium text-accent hover:underline"
                >
                  {item.vehicle_number}
                </Link>
              </TableCell>
              <TableCell className="font-medium">{item.service_name}</TableCell>
              <TableCell>{item.current_km.toLocaleString()} km</TableCell>
              <TableCell>
                {item.status === 'overdue' ? (
                  <span className="text-destructive font-medium">
                    Overdue by {Math.abs(item.remaining_km).toLocaleString()} km
                  </span>
                ) : (
                  <span className="text-warning font-medium">
                    Due in {item.remaining_km.toLocaleString()} km
                  </span>
                )}
              </TableCell>
              <TableCell>
                {item.status === 'overdue' ? (
                  <span className="text-destructive">Now!</span>
                ) : (
                  <span className="text-muted-foreground">
                    ~{format(item.estimatedDueDate, 'MMM d, yyyy')}
                    <span className="text-xs ml-1">({item.daysUntilDue}d)</span>
                  </span>
                )}
              </TableCell>
              <TableCell>
                {item.last_serviced_km ? (
                  <div>
                    <span>{item.last_serviced_km.toLocaleString()} km</span>
                    {item.last_serviced_at && (
                      <span className="text-xs text-muted-foreground block">
                        {format(new Date(item.last_serviced_at), 'MMM d, yyyy')}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground">Never</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/services/new?car=${item.car_id}`}>
                      <Wrench className="h-3 w-3 mr-1" />
                      Add Service
                    </Link>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
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
          <p className="text-muted-foreground">
            Vehicles requiring critical service attention
          </p>
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
              <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as any)}>
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

            <p className="text-xs text-muted-foreground">
              * Dates estimated based on ~{ESTIMATED_DAILY_KM} km/day average
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="stat-card border-destructive/30">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Overdue</p>
              <p className="text-2xl font-bold text-destructive">{overdue.length}</p>
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
              <p className="text-2xl font-bold text-warning">{dueSoon.length}</p>
            </div>
          </div>
        </Card>

        <Card className="stat-card">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-muted">
              <Wrench className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Critical</p>
              <p className="text-2xl font-bold">{filteredServices.length}</p>
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
                Overdue ({overdue.length})
              </TabsTrigger>
              <TabsTrigger value="due-soon" className="text-warning">
                Due Soon ({dueSoon.length})
              </TabsTrigger>
            </TabsList>

            <CardContent className="pt-6 px-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <TabsContent value="all">{renderTable(filteredServices)}</TabsContent>
                  <TabsContent value="overdue">{renderTable(overdue)}</TabsContent>
                  <TabsContent value="due-soon">{renderTable(dueSoon)}</TabsContent>
                </>
              )}
            </CardContent>
          </Tabs>
        </CardHeader>
      </Card>
    </div>
  );
}
