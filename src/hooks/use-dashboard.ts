import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AttentionItem, MonthlySnapshot, CarUtilization, HighMaintenanceData } from '@/types';
import { startOfMonth, endOfMonth, subDays, subMonths, differenceInDays } from 'date-fns';

export function useSystemConfig(key: string) {
  return useQuery({
    queryKey: ['system-config', key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', key)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data?.value;
    },
  });
}

export function useAttentionItems() {
  return useQuery({
    queryKey: ['attention-items'],
    queryFn: async () => {
      const items: AttentionItem[] = [];
      const staleOdometerDays = 10;
      const documentExpiryDays = 30;

      // Fetch critical services
      const { data: cars } = await supabase
        .from('cars')
        .select('id, vehicle_number')
        .eq('status', 'active');
      
      const { data: odometers } = await supabase
        .from('odometer_entries')
        .select('*')
        .order('reading_at', { ascending: false });

      const { data: carServiceRules } = await supabase
        .from('car_service_rules')
        .select('*, service_rules(*)')
        .eq('enabled', true);

      // Find overdue and due-soon critical services
      for (const car of cars || []) {
        const carOdometers = (odometers || []).filter((o: any) => o.car_id === car.id);
        const latestOdo = carOdometers[0];
        const currentKm = latestOdo?.odometer_km || 0;

        // Check stale odometer
        if (latestOdo) {
          const daysSinceUpdate = differenceInDays(new Date(), new Date(latestOdo.reading_at));
          if (daysSinceUpdate >= staleOdometerDays) {
            items.push({
              id: `stale-odo-${car.id}`,
              type: 'stale-odometer',
              title: `${car.vehicle_number}: Update odometer`,
              description: `Last updated ${daysSinceUpdate} days ago`,
              car_id: car.id,
              vehicle_number: car.vehicle_number,
              actionLabel: 'Update Odometer',
              actionLink: `/odometer?car=${car.id}`,
              priority: 3,
            });
          }
        }

        const carRules = (carServiceRules || []).filter(
          (csr: any) => csr.car_id === car.id && csr.service_rules?.is_critical
        );

        for (const csr of carRules) {
          const rule = csr.service_rules;
          if (!rule?.interval_km) continue;

          const lastServicedKm = csr.last_serviced_km || 0;
          const dueKm = lastServicedKm + rule.interval_km;
          const remainingKm = dueKm - currentKm;
          const threshold = rule.due_soon_threshold_km || 500;

          if (remainingKm < 0) {
            items.push({
              id: `overdue-${car.id}-${rule.id}`,
              type: 'overdue',
              title: `${car.vehicle_number}: ${rule.name} OVERDUE`,
              description: `Overdue by ${Math.abs(remainingKm).toLocaleString()} km`,
              car_id: car.id,
              vehicle_number: car.vehicle_number,
              actionLabel: 'Schedule Service',
              actionLink: `/services/new?car=${car.id}&rule=${rule.id}`,
              priority: 1,
            });
          } else if (remainingKm <= threshold) {
            items.push({
              id: `due-soon-${car.id}-${rule.id}`,
              type: 'due-soon',
              title: `${car.vehicle_number}: ${rule.name} due soon`,
              description: `Due in ${remainingKm.toLocaleString()} km`,
              car_id: car.id,
              vehicle_number: car.vehicle_number,
              actionLabel: 'Schedule Service',
              actionLink: `/services/new?car=${car.id}&rule=${rule.id}`,
              priority: 2,
            });
          }
        }
      }

      // Fetch active downtimes
      const { data: downtimes } = await supabase
        .from('downtime_logs')
        .select('*, cars(vehicle_number)')
        .is('ended_at', null);

      const now = new Date();
      for (const dt of downtimes || []) {
        const estimatedUptime = dt.estimated_uptime_at ? new Date(dt.estimated_uptime_at) : null;
        const isOverdue = estimatedUptime && estimatedUptime < now;
        
        items.push({
          id: `downtime-${dt.id}`,
          type: isOverdue ? 'overdue' : 'downtime',
          title: isOverdue 
            ? `${(dt as any).cars?.vehicle_number}: Should be back up!`
            : `${(dt as any).cars?.vehicle_number}: In downtime`,
          description: isOverdue 
            ? `Expected back on ${estimatedUptime!.toLocaleDateString('en-IN')}`
            : `Reason: ${dt.reason}${estimatedUptime ? ` • Expected: ${estimatedUptime.toLocaleDateString('en-IN')}` : ''}`,
          car_id: dt.car_id,
          vehicle_number: (dt as any).cars?.vehicle_number,
          actionLabel: 'View Fleet',
          actionLink: `/fleet/${dt.car_id}`,
          priority: isOverdue ? 1 : 2,
        });
      }

      // Fetch unresolved incidents
      const { data: incidents } = await supabase
        .from('incidents')
        .select('*, cars(vehicle_number)')
        .eq('resolved', false);

      for (const inc of incidents || []) {
        items.push({
          id: `incident-${inc.id}`,
          type: 'incident',
          title: `${(inc as any).cars?.vehicle_number}: Unresolved ${inc.type}`,
          description: inc.description || `Severity: ${inc.severity}`,
          car_id: inc.car_id,
          vehicle_number: (inc as any).cars?.vehicle_number,
          actionLabel: 'Resolve',
          actionLink: `/incidents?resolve=${inc.id}`,
          priority: inc.severity === 'high' ? 1 : 2,
        });
      }

      // Fetch expiring documents (RC, PUC, Insurance, Warranty)
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + documentExpiryDays);
      
      const { data: expiringDocs } = await supabase
        .from('car_documents')
        .select('*, cars:car_id (id, vehicle_number)')
        .not('expiry_date', 'is', null)
        .lte('expiry_date', futureDate.toISOString().split('T')[0])
        .order('expiry_date');

      for (const doc of expiringDocs || []) {
        const expiryDate = new Date(doc.expiry_date!);
        const now = new Date();
        const isExpired = expiryDate < now;
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        const docTypeLabels: Record<string, string> = {
          rc: 'RC Book',
          puc: 'PUC',
          insurance: 'Insurance',
          warranty: 'Warranty',
        };
        
        items.push({
          id: `doc-${doc.id}`,
          type: isExpired ? 'overdue' : 'due-soon',
          title: `${(doc as any).cars?.vehicle_number}: ${docTypeLabels[doc.document_type] || doc.document_type} ${isExpired ? 'EXPIRED' : 'expiring'}`,
          description: isExpired 
            ? `Expired ${Math.abs(daysUntilExpiry)} days ago`
            : `Expires in ${daysUntilExpiry} days`,
          car_id: doc.car_id,
          vehicle_number: (doc as any).cars?.vehicle_number,
          actionLabel: 'View Fleet',
          actionLink: `/fleet/${doc.car_id}`,
          priority: isExpired ? 1 : 2,
        });
      }

      // Fetch expiring driver licenses
      const { data: expiringLicenses } = await supabase
        .from('drivers')
        .select('*')
        .not('license_expiry', 'is', null)
        .lte('license_expiry', futureDate.toISOString().split('T')[0])
        .eq('status', 'active')
        .order('license_expiry');

      for (const driver of expiringLicenses || []) {
        const expiryDate = new Date(driver.license_expiry!);
        const now = new Date();
        const isExpired = expiryDate < now;
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        items.push({
          id: `license-${driver.id}`,
          type: isExpired ? 'overdue' : 'due-soon',
          title: `Driver ${driver.name}: License ${isExpired ? 'EXPIRED' : 'expiring'}`,
          description: isExpired 
            ? `Expired ${Math.abs(daysUntilExpiry)} days ago`
            : `Expires in ${daysUntilExpiry} days`,
          actionLabel: 'View Drivers',
          actionLink: `/drivers`,
          priority: isExpired ? 1 : 2,
        });
      }

      // Sort by priority
      items.sort((a, b) => a.priority - b.priority);

      return items.slice(0, 8);
    },
  });
}

export function useMonthlySnapshot() {
  return useQuery({
    queryKey: ['monthly-snapshot'],
    queryFn: async () => {
      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      const prevMonthEnd = subDays(monthStart, 1);

      // Get all cars
      const { data: cars } = await supabase
        .from('cars')
        .select('id')
        .eq('status', 'active');

      // Get all odometer entries
      const { data: odometers } = await supabase
        .from('odometer_entries')
        .select('*')
        .order('reading_at', { ascending: false });

      // Calculate KM driven this month
      let kmDriven = 0;
      let carsWithMissingBaseline = 0;

      for (const car of cars || []) {
        const carOdos = (odometers || [])
          .filter((o: any) => o.car_id === car.id)
          .sort((a: any, b: any) => new Date(a.reading_at).getTime() - new Date(b.reading_at).getTime());

        // Find last reading before this month
        const baselineOdo = carOdos
          .filter((o: any) => new Date(o.reading_at) < monthStart)
          .pop();

        // Find latest reading in this month
        const currentOdo = carOdos
          .filter((o: any) => new Date(o.reading_at) >= monthStart && new Date(o.reading_at) <= monthEnd)
          .pop();

        if (baselineOdo && currentOdo) {
          kmDriven += currentOdo.odometer_km - baselineOdo.odometer_km;
        } else if (currentOdo && !baselineOdo) {
          carsWithMissingBaseline++;
        }
      }

      // Count services this month
      const { count: servicesCount } = await supabase
        .from('service_records')
        .select('*', { count: 'exact', head: true })
        .gte('serviced_at', monthStart.toISOString().split('T')[0])
        .lte('serviced_at', monthEnd.toISOString().split('T')[0]);

      // Count critical alerts
      const { data: criticalRules } = await supabase
        .from('car_service_rules')
        .select('*, service_rules(*)')
        .eq('enabled', true);

      let criticalAlerts = 0;
      for (const car of cars || []) {
        const carOdos = (odometers || []).filter((o: any) => o.car_id === car.id);
        const latestOdo = carOdos[0];
        const currentKm = latestOdo?.odometer_km || 0;

        const carRules = (criticalRules || []).filter(
          (csr: any) => csr.car_id === car.id && csr.service_rules?.is_critical
        );

        for (const csr of carRules) {
          const rule = csr.service_rules;
          if (!rule?.interval_km) continue;

          const lastServicedKm = csr.last_serviced_km || 0;
          const dueKm = lastServicedKm + rule.interval_km;
          const remainingKm = dueKm - currentKm;
          const threshold = rule.due_soon_threshold_km || 500;

          if (remainingKm <= threshold) {
            criticalAlerts++;
          }
        }
      }

      const snapshot: MonthlySnapshot = {
        kmDriven,
        kmWarning: carsWithMissingBaseline > 0 
          ? `${carsWithMissingBaseline} car(s) missing last-month baseline; KM may be undercounted.`
          : undefined,
        servicesCompleted: servicesCount || 0,
        criticalAlerts,
        expenses: 0, // Petty cash integration would go here
      };

      return snapshot;
    },
  });
}

export function useCarUtilization() {
  return useQuery({
    queryKey: ['car-utilization'],
    queryFn: async () => {
      const now = new Date();
      const thirtyDaysAgo = subDays(now, 30);

      const { data: cars } = await supabase
        .from('cars')
        .select('id, vehicle_number')
        .eq('status', 'active');

      const { data: odometers } = await supabase
        .from('odometer_entries')
        .select('*')
        .gte('reading_at', thirtyDaysAgo.toISOString())
        .order('reading_at', { ascending: true });

      const utilizations: CarUtilization[] = [];
      const validUsages: number[] = [];

      for (const car of cars || []) {
        const carOdos = (odometers || []).filter((o: any) => o.car_id === car.id);
        
        if (carOdos.length < 2) {
          utilizations.push({
            car_id: car.id,
            vehicle_number: car.vehicle_number,
            usage_30d_km: null,
            label: 'insufficient-data',
          });
          continue;
        }

        const earliest = carOdos[0];
        const latest = carOdos[carOdos.length - 1];
        const usage = latest.odometer_km - earliest.odometer_km;
        
        validUsages.push(usage);
        utilizations.push({
          car_id: car.id,
          vehicle_number: car.vehicle_number,
          usage_30d_km: usage,
          label: 'normal', // Will be updated after calculating average
        });
      }

      // Calculate average and update labels
      if (validUsages.length > 0) {
        const avgUsage = validUsages.reduce((a, b) => a + b, 0) / validUsages.length;
        
        for (const util of utilizations) {
          if (util.usage_30d_km !== null) {
            if (util.usage_30d_km > avgUsage * 1.35) {
              util.label = 'over-used';
            } else if (util.usage_30d_km < avgUsage * 0.65) {
              util.label = 'under-used';
            }
          }
        }
      }

      return utilizations;
    },
  });
}

export function useHighMaintenanceData(carId: string) {
  return useQuery({
    queryKey: ['high-maintenance', carId],
    queryFn: async () => {
      const now = new Date();
      const ninetyDaysAgo = subDays(now, 90);
      const oneEightyDaysAgo = subDays(now, 180);

      // Get service costs in last 180 days
      const { data: services } = await supabase
        .from('service_records')
        .select('cost')
        .eq('car_id', carId)
        .gte('serviced_at', oneEightyDaysAgo.toISOString().split('T')[0]);

      const maintenanceCost = (services || []).reduce((sum, s) => sum + (s.cost || 0), 0);

      // Get downtime days in last 90 days
      const { data: downtimes } = await supabase
        .from('downtime_logs')
        .select('*')
        .eq('car_id', carId)
        .gte('started_at', ninetyDaysAgo.toISOString());

      let downtimeDays = 0;
      for (const dt of downtimes || []) {
        const start = new Date(dt.started_at);
        const end = dt.ended_at ? new Date(dt.ended_at) : now;
        downtimeDays += differenceInDays(end, start);
      }

      // Get incident count in last 180 days
      const { count: incidentCount } = await supabase
        .from('incidents')
        .select('*', { count: 'exact', head: true })
        .eq('car_id', carId)
        .gte('incident_at', oneEightyDaysAgo.toISOString());

      const result: HighMaintenanceData = {
        maintenance_cost_180d: maintenanceCost,
        downtime_days_90d: downtimeDays,
        incidents_180d: incidentCount || 0,
        isHighMaintenance: false,
      };

      // Check if high maintenance (any 2 of 3 conditions)
      const conditions = [
        maintenanceCost > 40000,
        downtimeDays > 7,
        (incidentCount || 0) >= 3,
      ];
      
      result.isHighMaintenance = conditions.filter(Boolean).length >= 2;

      return result;
    },
    enabled: !!carId,
  });
}
