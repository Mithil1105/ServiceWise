import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDowntimeLogs, useCarsInDowntime, useStartDowntime } from '@/hooks/use-downtime';
import { useCars } from '@/hooks/use-cars';
import { useIncidents } from '@/hooks/use-incidents';
import { useOrganizationSettings } from '@/hooks/use-organization-settings';
import {
  type DowntimeFormBuiltInFieldKey,
  DOWNTIME_FORM_FIELD_LABELS,
  DEFAULT_DOWNTIME_REASON_OPTIONS,
  type FleetNewCarCustomField,
} from '@/types/form-config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  PauseCircle,
  PlayCircle,
  Clock,
  TrendingUp,
  Car,
  Loader2,
  Download,
  Filter,
  Calendar,
  User,
  AlertTriangle,
  Plus,
} from 'lucide-react';
import type { DowntimeLog } from '@/types';
import { formatDateDMY, formatDateTimeDMY } from '@/lib/date';
import { formatCarLabel } from '@/lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

const REASON_COLORS: Record<string, string> = {
  service: 'hsl(var(--primary))',
  breakdown: 'hsl(var(--warning))',
  accident: 'hsl(var(--destructive))',
  other: 'hsl(var(--muted-foreground))',
};

const REASON_LABELS: Record<string, string> = {
  service: 'Service',
  breakdown: 'Breakdown',
  accident: 'Accident',
  other: 'Other',
};

export default function DowntimeReport() {
  const [dateRange, setDateRange] = useState<'30' | '90' | '180' | 'all'>('90');
  const [vehicleFilter, setVehicleFilter] = useState<string>('');
  const [reasonFilter, setReasonFilter] = useState<string>('all');

  const [addDowntimeOpen, setAddDowntimeOpen] = useState(false);
  const [addDowntimeCarId, setAddDowntimeCarId] = useState('');
  const [addDowntimeReason, setAddDowntimeReason] = useState<string>('service');
  const [addDowntimeNotes, setAddDowntimeNotes] = useState('');
  const [addDowntimeEstimated, setAddDowntimeEstimated] = useState('');
  const [addDowntimeCustomValues, setAddDowntimeCustomValues] = useState<Record<string, string | number | boolean | null>>({});
  const [addDowntimeErrors, setAddDowntimeErrors] = useState<Record<string, string>>({});

  const { data: allDowntimeLogs, isLoading: downtimeLoading } = useDowntimeLogs();
  const { data: carsInDowntime } = useCarsInDowntime();
  const { data: cars } = useCars();
  const { data: incidents, isLoading: incidentsLoading } = useIncidents();
  const { data: orgSettings } = useOrganizationSettings();
  const startDowntime = useStartDowntime();

  const downtimeFormConfig = orgSettings?.downtime_form_config ?? {};
  const downtimeFieldOverrides = downtimeFormConfig.fieldOverrides ?? {};
  const downtimeReasonOptions = (downtimeFormConfig.reasonOptions?.length ? downtimeFormConfig.reasonOptions : DEFAULT_DOWNTIME_REASON_OPTIONS).filter((o) => o.value && o.label);
  const defaultReasonValue = downtimeReasonOptions[0]?.value ?? 'service';
  const getReasonLabel = (value: string) => downtimeReasonOptions.find((o) => o.value === value)?.label ?? REASON_LABELS[value] ?? value;
  const downtimeCustomFields = (downtimeFormConfig.customFields ?? []).sort((a, b) => a.order - b.order);
  useEffect(() => {
    if (addDowntimeOpen && downtimeReasonOptions.length > 0 && !downtimeReasonOptions.some((o) => o.value === addDowntimeReason)) {
      setAddDowntimeReason(defaultReasonValue);
    }
  }, [addDowntimeOpen, defaultReasonValue, downtimeReasonOptions, addDowntimeReason]);
  const getDowntimeFieldLabel = (key: DowntimeFormBuiltInFieldKey) => downtimeFieldOverrides[key]?.label ?? DOWNTIME_FORM_FIELD_LABELS[key];
  const isDowntimeFieldHidden = (key: DowntimeFormBuiltInFieldKey) => downtimeFieldOverrides[key]?.hidden === true;
  const isDowntimeFieldRequired = (key: DowntimeFormBuiltInFieldKey) => {
    const def = key === 'car_id' || key === 'reason';
    return downtimeFieldOverrides[key]?.required ?? def;
  };

  const isLoading = downtimeLoading || incidentsLoading;

  // Filter logs by date range
  const filteredLogs = useMemo(() => {
    if (!allDowntimeLogs) return [];
    
    let logs = allDowntimeLogs;
    
    // Date filter
    if (dateRange !== 'all') {
      const days = parseInt(dateRange);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      logs = logs.filter(log => new Date(log.started_at) >= cutoff);
    }
    
    // Vehicle filter
    if (vehicleFilter) {
      logs = logs.filter(log => log.car_id === vehicleFilter);
    }
    
    // Reason filter
    if (reasonFilter !== 'all') {
      logs = logs.filter(log => log.reason === reasonFilter);
    }
    
    return logs;
  }, [allDowntimeLogs, dateRange, vehicleFilter, reasonFilter]);

  // Calculate stats
  const stats = useMemo(() => {
    if (!filteredLogs.length) return null;

    const now = new Date();
    let totalDowntimeHours = 0;
    const reasonCounts: Record<string, number> = {};
    const vehicleDowntime: Record<string, { hours: number; count: number }> = {};
    const driverIncidents: Record<string, number> = {};

    for (const log of filteredLogs) {
      const start = new Date(log.started_at);
      const end = log.ended_at ? new Date(log.ended_at) : now;
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      
      totalDowntimeHours += hours;
      
      // Count by reason
      reasonCounts[log.reason] = (reasonCounts[log.reason] || 0) + 1;
      
      // Track per vehicle
      if (!vehicleDowntime[log.car_id]) {
        vehicleDowntime[log.car_id] = { hours: 0, count: 0 };
      }
      vehicleDowntime[log.car_id].hours += hours;
      vehicleDowntime[log.car_id].count += 1;
    }

    // Track driver incidents
    for (const incident of incidents || []) {
      if (incident.driver_name) {
        driverIncidents[incident.driver_name] = (driverIncidents[incident.driver_name] || 0) + 1;
      }
    }

    // Prepare pie chart data
    const reasonData = Object.entries(reasonCounts).map(([reason, count]) => ({
      name: getReasonLabel(reason),
      value: count,
      color: REASON_COLORS[reason] || REASON_COLORS.other,
    }));

    // Prepare vehicle ranking
    const vehicleRanking = Object.entries(vehicleDowntime)
      .map(([carId, data]) => {
        const car = cars?.find(c => c.id === carId);
        return {
          carId,
          vehicleNumber: car ? formatCarLabel(car) : 'Unknown',
          model: car?.model || '',
          hours: data.hours,
          days: Math.round(data.hours / 24 * 10) / 10,
          count: data.count,
        };
      })
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 10);

    // Prepare driver ranking (troublesome drivers)
    const driverRanking = Object.entries(driverIncidents)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalDowntimeHours,
      totalDowntimeDays: Math.round(totalDowntimeHours / 24 * 10) / 10,
      totalIncidents: filteredLogs.length,
      activeDowntime: carsInDowntime?.length || 0,
      reasonData,
      vehicleRanking,
      driverRanking,
      avgDowntimePerIncident: Math.round(totalDowntimeHours / filteredLogs.length * 10) / 10,
    };
  }, [filteredLogs, cars, carsInDowntime, incidents, downtimeReasonOptions]);

  // Monthly trend data
  const trendData = useMemo(() => {
    if (!filteredLogs.length) return [];

    const monthlyData: Record<string, { month: string; hours: number; count: number }> = {};
    const now = new Date();

    for (const log of filteredLogs) {
      const start = new Date(log.started_at);
      const end = log.ended_at ? new Date(log.ended_at) : now;
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      
      const monthKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = `${String(start.getMonth() + 1).padStart(2, '0')}/${start.getFullYear()}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { month: monthLabel, hours: 0, count: 0 };
      }
      monthlyData[monthKey].hours += hours;
      monthlyData[monthKey].count += 1;
    }

    return Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, data]) => ({
        ...data,
        days: Math.round(data.hours / 24 * 10) / 10,
      }));
  }, [filteredLogs]);

  const handleExportCSV = () => {
    if (!filteredLogs.length) return;

    const headers = ['Vehicle', 'Start Date', 'End Date', 'Duration (Hours)', 'Reason', 'Notes'];
    const now = new Date();
    
    const rows = filteredLogs.map(log => {
      const car = cars?.find(c => c.id === log.car_id);
      const start = new Date(log.started_at);
      const end = log.ended_at ? new Date(log.ended_at) : now;
      const hours = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60) * 10) / 10;
      
      return [
        car ? formatCarLabel(car) : 'Unknown',
        formatDateTimeDMY(log.started_at),
        log.ended_at ? formatDateTimeDMY(log.ended_at) : 'Active',
        hours.toString(),
        getReasonLabel(log.reason),
        log.notes || '',
      ];
    });

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `downtime-report-${formatDateDMY(new Date().toISOString())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const carOptions = (cars || []).filter(c => c.status === 'active').map(car => ({
    value: car.id,
    label: `${car.vehicle_number} - ${car.model}`,
  }));

  const handleAddDowntimeSubmit = async () => {
    setAddDowntimeErrors({});
    const err: Record<string, string> = {};
    if (isDowntimeFieldRequired('car_id') && !addDowntimeCarId) err.car_id = 'Please select a vehicle';
    if (isDowntimeFieldRequired('reason') && !addDowntimeReason) err.reason = 'Reason is required';
    if (isDowntimeFieldRequired('notes') && !addDowntimeNotes?.trim()) err.notes = 'Notes are required';
    if (isDowntimeFieldRequired('estimated_uptime_at') && !addDowntimeEstimated?.trim()) err.estimated_uptime_at = 'Estimated return is required';
    for (const f of downtimeCustomFields) {
      if (!f.required) continue;
      const v = addDowntimeCustomValues[f.key];
      if (v === undefined || v === null || v === '') err[`custom_${f.key}`] = `${f.label} is required`;
    }
    if (Object.keys(err).length > 0) {
      setAddDowntimeErrors(err);
      return;
    }
    const customAttrs: Record<string, string | number | boolean | null> = {};
    for (const f of downtimeCustomFields) {
      const v = addDowntimeCustomValues[f.key];
      if (v !== undefined && v !== null && v !== '') customAttrs[f.key] = v;
    }
    try {
      await startDowntime.mutateAsync({
        car_id: addDowntimeCarId,
        reason: addDowntimeReason,
        notes: addDowntimeNotes?.trim() || undefined,
        estimated_uptime_at: addDowntimeEstimated?.trim() ? new Date(addDowntimeEstimated).toISOString() : undefined,
        custom_attributes: Object.keys(customAttrs).length ? customAttrs : undefined,
      });
      setAddDowntimeOpen(false);
      setAddDowntimeCarId('');
      setAddDowntimeReason(defaultReasonValue);
      setAddDowntimeNotes('');
      setAddDowntimeEstimated('');
      setAddDowntimeCustomValues({});
    } catch {
      // toast from mutation
    }
  };

  const renderDowntimeCustomInput = (f: FleetNewCarCustomField) => {
    const value = addDowntimeCustomValues[f.key];
    const setValue = (v: string | number | boolean | null) => setAddDowntimeCustomValues(prev => ({ ...prev, [f.key]: v }));
    if (f.type === 'number') {
      return (
        <Input
          id={`downtime_custom_${f.key}`}
          type="number"
          value={value != null ? String(value) : ''}
          onChange={(e) => setValue(e.target.value === '' ? null : parseFloat(e.target.value))}
          placeholder={`${f.label}...`}
        />
      );
    }
    if (f.type === 'date') {
      return (
        <Input
          id={`downtime_custom_${f.key}`}
          type="date"
          value={value != null ? String(value) : ''}
          onChange={(e) => setValue(e.target.value || null)}
        />
      );
    }
    if (f.type === 'select') {
      return (
        <Select value={value != null ? String(value) : ''} onValueChange={(v) => setValue(v)}>
          <SelectTrigger id={`downtime_custom_${f.key}`}>
            <SelectValue placeholder={`Select ${f.label}`} />
          </SelectTrigger>
          <SelectContent>
            {(f.options ?? []).map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    return (
      <Input
        id={`downtime_custom_${f.key}`}
        type="text"
        value={value != null ? String(value) : ''}
        onChange={(e) => setValue(e.target.value || null)}
        placeholder={`${f.label}...`}
      />
    );
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
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Downtime Report</h1>
          <p className="text-muted-foreground">Analyze vehicle downtime patterns and trends</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={addDowntimeOpen} onOpenChange={setAddDowntimeOpen}>
            <Button onClick={() => setAddDowntimeOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add downtime
            </Button>
            <DialogContent className="max-w-md max-h-[90vh] flex flex-col overflow-hidden">
              <DialogHeader className="shrink-0">
                <DialogTitle>Log downtime</DialogTitle>
                <DialogDescription>Mark a vehicle as unavailable. Same form as on Fleet Detail, with vehicle selection.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2 overflow-y-auto min-h-0 flex-1 pr-1">
                {!isDowntimeFieldHidden('car_id') && (
                  <div className="space-y-2">
                    <Label>{getDowntimeFieldLabel('car_id')}{isDowntimeFieldRequired('car_id') ? ' *' : ''}</Label>
                    <SearchableSelect
                      options={carOptions}
                      value={addDowntimeCarId}
                      onValueChange={setAddDowntimeCarId}
                      placeholder="Select vehicle..."
                    />
                    {addDowntimeErrors.car_id && <p className="text-sm text-destructive">{addDowntimeErrors.car_id}</p>}
                  </div>
                )}
                {!isDowntimeFieldHidden('reason') && (
                  <div className="space-y-2">
                    <Label>{getDowntimeFieldLabel('reason')}{isDowntimeFieldRequired('reason') ? ' *' : ''}</Label>
                    <Select value={addDowntimeReason} onValueChange={setAddDowntimeReason}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {downtimeReasonOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {addDowntimeErrors.reason && <p className="text-sm text-destructive">{addDowntimeErrors.reason}</p>}
                  </div>
                )}
                {!isDowntimeFieldHidden('estimated_uptime_at') && (
                  <div className="space-y-2">
                    <Label>{getDowntimeFieldLabel('estimated_uptime_at')}{isDowntimeFieldRequired('estimated_uptime_at') ? ' *' : ''}</Label>
                    <Input
                      type="date"
                      value={addDowntimeEstimated}
                      onChange={(e) => setAddDowntimeEstimated(e.target.value)}
                    />
                    {addDowntimeErrors.estimated_uptime_at && <p className="text-sm text-destructive">{addDowntimeErrors.estimated_uptime_at}</p>}
                  </div>
                )}
                {!isDowntimeFieldHidden('notes') && (
                  <div className="space-y-2">
                    <Label>{getDowntimeFieldLabel('notes')}{isDowntimeFieldRequired('notes') ? ' *' : ''}</Label>
                    <Textarea
                      value={addDowntimeNotes}
                      onChange={(e) => setAddDowntimeNotes(e.target.value)}
                      placeholder="Add notes about the downtime..."
                    />
                    {addDowntimeErrors.notes && <p className="text-sm text-destructive">{addDowntimeErrors.notes}</p>}
                  </div>
                )}
                {downtimeCustomFields.map((f) => (
                  <div key={f.id} className="space-y-2">
                    <Label htmlFor={`downtime_custom_${f.key}`}>{f.label}{f.required ? ' *' : ''}</Label>
                    {renderDowntimeCustomInput(f)}
                    {addDowntimeErrors[`custom_${f.key}`] && <p className="text-sm text-destructive">{addDowntimeErrors[`custom_${f.key}`]}</p>}
                  </div>
                ))}
              </div>
              <DialogFooter className="shrink-0 border-t pt-4 mt-2">
                <Button variant="outline" onClick={() => setAddDowntimeOpen(false)}>Cancel</Button>
                <Button onClick={handleAddDowntimeSubmit} disabled={startDowntime.isPending || !addDowntimeCarId}>
                  {startDowntime.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Start downtime
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="outline" onClick={handleExportCSV} disabled={!filteredLogs.length}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
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
              <Label className="text-sm">Period:</Label>
              <Select value={dateRange} onValueChange={(v) => setDateRange(v as any)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="180">Last 180 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-sm">Reason:</Label>
              <Select value={reasonFilter} onValueChange={setReasonFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reasons</SelectItem>
                  {downtimeReasonOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-sm">Vehicle:</Label>
              <Select value={vehicleFilter || "all"} onValueChange={(v) => setVehicleFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Vehicles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vehicles</SelectItem>
                  {carOptions.map(car => (
                    <SelectItem key={car.value} value={car.value}>
                      {car.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="stat-card">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-warning/10">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Downtime</p>
              <p className="text-2xl font-bold">{stats?.totalDowntimeDays || 0} days</p>
            </div>
          </div>
        </Card>

        <Card className="stat-card">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <PauseCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Incidents</p>
              <p className="text-2xl font-bold">{stats?.totalIncidents || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="stat-card">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-destructive/10">
              <Car className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Currently Down</p>
              <p className="text-2xl font-bold">{stats?.activeDowntime || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="stat-card">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-accent/10">
              <TrendingUp className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg. per Incident</p>
              <p className="text-2xl font-bold">{stats?.avgDowntimePerIncident || 0}h</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reason Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Downtime by Reason</CardTitle>
            <CardDescription>Distribution of downtime causes</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.reasonData && stats.reasonData.length > 0 ? (
              <div className="h-64 flex items-center">
                <ResponsiveContainer width="50%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.reasonData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                    >
                      {stats.reasonData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {stats.reasonData.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="text-sm">{entry.name}</span>
                      <span className="text-sm font-medium ml-auto">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Trend</CardTitle>
            <CardDescription>Downtime days per month</CardDescription>
          </CardHeader>
          <CardContent>
            {trendData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData}>
                    <XAxis dataKey="month" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip 
                      formatter={(value: number) => [`${value} days`, 'Downtime']}
                    />
                    <Bar dataKey="days" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Vehicles by Downtime */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Vehicles with Most Downtime
          </CardTitle>
          <CardDescription>Top 10 vehicles ranked by total downtime</CardDescription>
        </CardHeader>
        <CardContent>
          {stats?.vehicleRanking && stats.vehicleRanking.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Total Downtime</TableHead>
                  <TableHead>Incidents</TableHead>
                  <TableHead>Avg. per Incident</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.vehicleRanking.map((vehicle, index) => (
                  <TableRow key={vehicle.carId}>
                    <TableCell>
                      <Badge variant={index < 3 ? 'warning' : 'muted'}>
                        #{index + 1}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link
                        to={`/app/fleet/${vehicle.carId}`}
                        className="font-medium hover:text-primary"
                      >
                        {vehicle.vehicleNumber}
                      </Link>
                      <span className="text-sm text-muted-foreground ml-2">
                        {vehicle.model}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">
                      {vehicle.days} days
                    </TableCell>
                    <TableCell>{vehicle.count}</TableCell>
                    <TableCell>
                      {Math.round(vehicle.hours / vehicle.count * 10) / 10}h
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/app/fleet/${vehicle.carId}`}>
                          View Details →
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No downtime records found
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drivers with Most Incidents */}
      {stats?.driverRanking && stats.driverRanking.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Drivers with Most Incidents
            </CardTitle>
            <CardDescription>Drivers frequently involved in incidents</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Driver Name</TableHead>
                  <TableHead>Incidents</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.driverRanking.map((driver, index) => (
                  <TableRow key={driver.name}>
                    <TableCell>
                      <Badge variant={index < 3 ? 'error' : 'muted'}>
                        #{index + 1}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-warning" />
                      {driver.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="warning">{driver.count}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Recent Downtime Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Downtime History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredLogs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.slice(0, 50).map(log => {
                  const car = cars?.find(c => c.id === log.car_id);
                  const now = new Date();
                  const start = new Date(log.started_at);
                  const end = log.ended_at ? new Date(log.ended_at) : now;
                  const hours = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60) * 10) / 10;
                  const days = Math.round(hours / 24 * 10) / 10;
                  
                  return (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Link
                          to={`/app/fleet/${log.car_id}`}
                          className="font-medium hover:text-primary"
                        >
                          {car ? formatCarLabel(car) : 'Unknown'}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDateTimeDMY(log.started_at)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {log.ended_at ? formatDateTimeDMY(log.ended_at) : '-'}
                      </TableCell>
                      <TableCell>
                        {days >= 1 ? `${days} days` : `${hours}h`}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            log.reason === 'accident' ? 'error' : 
                            log.reason === 'breakdown' ? 'warning' : 
                            'muted'
                          }
                        >
                          {getReasonLabel(log.reason)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {log.notes || '-'}
                      </TableCell>
                      <TableCell>
                        {log.ended_at ? (
                          <Badge variant="success" className="gap-1">
                            <PlayCircle className="h-3 w-3" />
                            Resolved
                          </Badge>
                        ) : (
                          <Badge variant="warning" className="gap-1">
                            <PauseCircle className="h-3 w-3" />
                            Active
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <PauseCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No downtime records found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}