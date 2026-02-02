import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Car, Users } from 'lucide-react';
import { AppWindowFrame } from '@/components/mock-ui/AppWindowFrame';
import { cn } from '@/lib/utils';

const sampleCars = [
  { vehicle_number: 'MH-01-AB-1234', model: 'Innova Crysta', year: '2022', fuel_type: 'Diesel', current_km: 45230, service_status: 'OK' as const },
  { vehicle_number: 'MH-02-CD-5678', model: 'Ertiga', year: '2023', fuel_type: 'Petrol', current_km: 18200, service_status: 'Due Soon' as const },
  { vehicle_number: 'MH-12-XY-9012', model: 'Swift Dzire', year: '2021', fuel_type: 'Petrol', current_km: 67800, service_status: 'Overdue' as const },
];

const sampleDrivers = [
  { name: 'Rajesh Kumar', phone: '+91 98765 43210', location: 'Mumbai', region: 'West', license_status: 'Valid' as const },
  { name: 'Amit Singh', phone: '+91 91234 56789', location: 'Pune', region: 'West', license_status: 'Valid' as const },
  { name: 'Suresh Patel', phone: '+91 99887 76655', location: 'Nashik', region: 'West', license_status: 'Expires soon' as const },
];

export function MockFleetAndDriversPanel({ className }: { className?: string }) {
  return (
    <AppWindowFrame title="ServiceWise Fleet & Drivers" className={className}>
      <div className="space-y-4 p-4">
        {/* Vehicles */}
        <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <Car className="h-4 w-4 text-slate-500" aria-hidden />
            <span className="text-sm font-semibold text-slate-900">Vehicles ({sampleCars.length})</span>
          </div>
          <div className="p-0">
            <div className="hidden sm:block overflow-x-auto min-w-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200 hover:bg-transparent">
                    <TableHead className="text-xs text-slate-500 bg-slate-50/80">Vehicle</TableHead>
                    <TableHead className="text-xs text-slate-500 bg-slate-50/80">Model</TableHead>
                    <TableHead className="text-xs text-slate-500 bg-slate-50/80">Fuel</TableHead>
                    <TableHead className="text-xs text-slate-500 bg-slate-50/80">KM</TableHead>
                    <TableHead className="text-xs text-slate-500 bg-slate-50/80">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sampleCars.map((car, i) => (
                    <TableRow key={i} className="border-slate-100">
                      <TableCell className="text-xs py-2 font-medium text-slate-900">{car.vehicle_number}</TableCell>
                      <TableCell className="text-xs py-2 text-slate-600">{car.model}</TableCell>
                      <TableCell className="py-2">
                        <Badge variant="secondary" className="text-[10px] border-slate-200">{car.fuel_type}</Badge>
                      </TableCell>
                      <TableCell className="text-xs py-2 text-slate-600">{car.current_km.toLocaleString()}</TableCell>
                      <TableCell className="py-2">
                        <Badge
                          variant={car.service_status === 'Overdue' ? 'destructive' : car.service_status === 'Due Soon' ? 'warning' : 'secondary'}
                          className="text-[10px]"
                        >
                          {car.service_status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="sm:hidden p-3 space-y-2">
              {sampleCars.map((car, i) => (
                <div key={i} className="rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 text-xs">
                  <p className="font-medium text-slate-900">{car.vehicle_number}</p>
                  <p className="text-slate-500">{car.model} · {car.fuel_type} · {car.current_km.toLocaleString()} km</p>
                  <Badge variant={car.service_status === 'Overdue' ? 'destructive' : car.service_status === 'Due Soon' ? 'warning' : 'secondary'} className="text-[10px] mt-1">
                    {car.service_status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Drivers */}
        <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-500" aria-hidden />
            <span className="text-sm font-semibold text-slate-900">Drivers ({sampleDrivers.length})</span>
          </div>
          <div className="p-0">
            <div className="hidden sm:block overflow-x-auto min-w-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200 hover:bg-transparent">
                    <TableHead className="text-xs text-slate-500 bg-slate-50/80">Name</TableHead>
                    <TableHead className="text-xs text-slate-500 bg-slate-50/80">Phone</TableHead>
                    <TableHead className="text-xs text-slate-500 bg-slate-50/80">Location</TableHead>
                    <TableHead className="text-xs text-slate-500 bg-slate-50/80">License</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sampleDrivers.map((driver, i) => (
                    <TableRow key={i} className="border-slate-100">
                      <TableCell className="text-xs py-2 font-medium text-slate-900">{driver.name}</TableCell>
                      <TableCell className="text-xs py-2 text-slate-600">{driver.phone}</TableCell>
                      <TableCell className="text-xs py-2 text-slate-600">{driver.location}</TableCell>
                      <TableCell className="py-2">
                        <Badge variant={driver.license_status === 'Expires soon' ? 'default' : 'secondary'} className="text-[10px] border-slate-200">
                          {driver.license_status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="sm:hidden p-3 space-y-2">
              {sampleDrivers.map((driver, i) => (
                <div key={i} className="rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 text-xs">
                  <p className="font-medium text-slate-900">{driver.name}</p>
                  <p className="text-slate-500">{driver.phone} · {driver.location}</p>
                  <Badge variant={driver.license_status === 'Expires soon' ? 'default' : 'secondary'} className="text-[10px] mt-1 border-slate-200">
                    {driver.license_status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppWindowFrame>
  );
}
