import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useServiceRecords } from '@/hooks/use-services';
import { useCars } from '@/hooks/use-cars';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Wrench, Plus, Search, Loader2, Download } from 'lucide-react';
import { formatDateDMY } from '@/lib/date';

export default function Services() {
  const [search, setSearch] = useState('');
  const [carFilter, setCarFilter] = useState<string>('all');

  const { data: serviceRecords, isLoading } = useServiceRecords();
  const { data: cars } = useCars();

  const filteredRecords = serviceRecords?.filter((record) => {
    const car = cars?.find((c) => c.id === record.car_id);
    const matchesSearch =
      record.service_name.toLowerCase().includes(search.toLowerCase()) ||
      record.vendor_name?.toLowerCase().includes(search.toLowerCase()) ||
      car?.vehicle_number.toLowerCase().includes(search.toLowerCase());

    const matchesCar = carFilter === 'all' || record.car_id === carFilter;

    return matchesSearch && matchesCar;
  }) || [];

  const carOptions = [
    { value: 'all', label: 'All Vehicles' },
    ...(cars?.map((car) => ({
      value: car.id,
      label: car.vehicle_number,
    })) || []),
  ];

  const handleExportAll = () => {
    const headers = ['Date', 'Vehicle', 'Service', 'Vendor', 'Location', 'Cost (INR)', 'Odometer (km)'];
    const rows = filteredRecords.map((record) => {
      const car = cars?.find((c) => c.id === record.car_id);
      return [
        formatDateDMY(record.serviced_at),
        car?.vehicle_number || '',
        record.service_name,
        record.vendor_name || '',
        record.vendor_location || '',
        record.cost?.toString() || '',
        record.odometer_km.toString(),
      ];
    });

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `service-records-${formatDateDMY(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Services</h1>
          <p className="text-muted-foreground">Service records across all vehicles</p>
        </div>
        <Button asChild>
          <Link to="/app/services/new">
            <Plus className="h-4 w-4 mr-2" />
            Add Service Record
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by service, vendor, or vehicle..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <SearchableSelect
              options={carOptions}
              value={carFilter}
              onValueChange={setCarFilter}
              placeholder="Filter by vehicle"
              searchPlaceholder="Search vehicles..."
              triggerClassName="w-[200px]"
            />
            <Button variant="outline" onClick={handleExportAll}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Records Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Service Records ({filteredRecords.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRecords.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Odometer</TableHead>
                    <TableHead>Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record) => {
                    const car = cars?.find((c) => c.id === record.car_id);
                    return (
                      <TableRow key={record.id}>
                        <TableCell>
                          {formatDateDMY(record.serviced_at)}
                        </TableCell>
                        <TableCell>
                          <Link
                            to={`/app/fleet/${record.car_id}`}
                            className="font-medium text-accent hover:underline"
                          >
                            {car?.vehicle_number || 'Unknown'}
                          </Link>
                        </TableCell>
                        <TableCell className="font-medium">
                          {record.service_name}
                        </TableCell>
                        <TableCell>
                          {record.vendor_name || '-'}
                          {record.vendor_location && (
                            <span className="text-xs text-muted-foreground block">
                              {record.vendor_location}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{record.odometer_km.toLocaleString()} km</TableCell>
                        <TableCell>
                          {record.cost ? (
                            <span className="font-medium">₹{record.cost.toLocaleString()}</span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Wrench className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">No service records found</h3>
              <p className="text-muted-foreground mb-4">
                {search || carFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Add your first service record'}
              </p>
              {!search && carFilter === 'all' && (
                <Button asChild>
                  <Link to="/app/services/new">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Service Record
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
