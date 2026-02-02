import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useCars } from '@/hooks/use-cars';
import { useLatestOdometer, useOdometerEntries } from '@/hooks/use-odometer';
import { useCreateOdometerEntry } from '@/hooks/use-odometer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Gauge, AlertCircle, Loader2, CheckCircle, History } from 'lucide-react';
import { toLocalDateTimeInputValue, formatDateTimeDMY } from '@/lib/date';

export default function Odometer() {
  const [searchParams] = useSearchParams();
  const preselectedCarId = searchParams.get('car');

  const { data: cars, isLoading: carsLoading } = useCars();
  const [selectedCarId, setSelectedCarId] = useState<string>(preselectedCarId || '');
  const { data: latestOdo, isLoading: latestLoading } = useLatestOdometer(selectedCarId);
  const { data: allEntries, isLoading: entriesLoading } = useOdometerEntries();
  const createEntry = useCreateOdometerEntry();

  const [odometerValue, setOdometerValue] = useState('');
  const [readingDate, setReadingDate] = useState(() => toLocalDateTimeInputValue());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState<{ car_id: string; km: number; date: string } | null>(null);
  const [historySearch, setHistorySearch] = useState('');

  useEffect(() => {
    if (preselectedCarId) {
      setSelectedCarId(preselectedCarId);
    }
  }, [preselectedCarId]);

  const selectedCar = cars?.find((c) => c.id === selectedCarId);
  const lastKm = latestOdo?.odometer_km || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const km = parseInt(odometerValue);

    if (!selectedCarId) {
      setErrors({ car: 'Please select a vehicle' });
      return;
    }

    if (isNaN(km) || km < 0) {
      setErrors({ odometer: 'Please enter a valid odometer reading' });
      return;
    }

    if (km < lastKm) {
      setErrors({ odometer: `Reading cannot be less than the last reading (${lastKm.toLocaleString()} km)` });
      return;
    }

    // Check for unusually high jump (more than 5000 km)
    if (km - lastKm > 5000) {
      setPendingSubmit({ car_id: selectedCarId, km, date: readingDate });
      setShowConfirm(true);
      return;
    }

    await submitReading(selectedCarId, km, readingDate);
  };

  const submitReading = async (carId: string, km: number, date: string) => {
    try {
      await createEntry.mutateAsync({
        car_id: carId,
        odometer_km: km,
        reading_at: new Date(date).toISOString(),
      });
      setOdometerValue('');
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleConfirm = async () => {
    if (pendingSubmit) {
      await submitReading(pendingSubmit.car_id, pendingSubmit.km, pendingSubmit.date);
    }
    setShowConfirm(false);
    setPendingSubmit(null);
  };

  const carOptions = (cars?.filter((c) => c.status === 'active') || []).map((car) => ({
    value: car.id,
    label: `${car.vehicle_number} - ${car.model}`,
  }));

  // Group entries by vehicle and get only the latest for each
  const latestEntriesPerVehicle = (() => {
    if (!allEntries || !cars) return [];
    
    const latestByCarId = new Map<string, typeof allEntries[0]>();
    
    // Since entries are ordered by reading_at desc, the first entry for each car is the latest
    for (const entry of allEntries) {
      if (!latestByCarId.has(entry.car_id)) {
        latestByCarId.set(entry.car_id, entry);
      }
    }
    
    // Filter by search
    return Array.from(latestByCarId.values()).filter((entry) => {
      const car = cars.find((c) => c.id === entry.car_id);
      if (!car) return false;
      return car.vehicle_number.toLowerCase().includes(historySearch.toLowerCase()) ||
             car.model.toLowerCase().includes(historySearch.toLowerCase());
    });
  })();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">Odometer</h1>
        <p className="text-muted-foreground">Record and view odometer readings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Entry Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="h-5 w-5" />
              New Entry
            </CardTitle>
            <CardDescription>
              Select a vehicle and enter the current odometer reading
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="car">Vehicle *</Label>
                <SearchableSelect
                  id="car"
                  options={carOptions}
                  value={selectedCarId}
                  onValueChange={setSelectedCarId}
                  placeholder={carsLoading ? 'Loading...' : 'Select a vehicle'}
                  searchPlaceholder="Search vehicles..."
                  disabled={carsLoading}
                />
                {errors.car && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.car}
                  </p>
                )}
              </div>

              {selectedCarId && (
                <>
                  <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Selected Vehicle</span>
                      <span className="font-medium">{selectedCar?.vehicle_number}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Last Reading</span>
                      <span className="font-medium">
                        {latestLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          `${lastKm.toLocaleString()} km`
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="odometer">New Odometer Reading (km) *</Label>
                    <Input
                      id="odometer"
                      type="number"
                      placeholder={`Must be >= ${lastKm.toLocaleString()}`}
                      value={odometerValue}
                      onChange={(e) => setOdometerValue(e.target.value)}
                      min={lastKm}
                    />
                    {errors.odometer && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.odometer}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reading_date">Reading Date & Time</Label>
                    <Input
                      id="reading_date"
                      type="datetime-local"
                      value={readingDate}
                      onChange={(e) => setReadingDate(e.target.value)}
                    />
                  </div>
                </>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={!selectedCarId || createEntry.isPending}
              >
                {createEntry.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Record Reading
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Recent History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Vehicle Readings
            </CardTitle>
            <CardDescription>
              Latest odometer reading for each vehicle
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Input
                placeholder="Search by vehicle..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
              />
            </div>

            {entriesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : latestEntriesPerVehicle.length > 0 ? (
              <div className="max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Latest Reading</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {latestEntriesPerVehicle.map((entry) => {
                      const car = cars?.find((c) => c.id === entry.car_id);
                      return (
                        <TableRow key={entry.id}>
                          <TableCell>
                            <Link
                              to={`/app/fleet/${entry.car_id}`}
                              className="font-medium text-accent hover:underline"
                            >
                              {car?.vehicle_number || 'Unknown'}
                            </Link>
                          </TableCell>
                          <TableCell className="font-medium">
                            {entry.odometer_km.toLocaleString()} km
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDateTimeDMY(entry.reading_at)}
                          </TableCell>
                          <TableCell>
                            <Link
                              to={`/app/vehicle-report/${entry.car_id}`}
                              className="text-sm text-accent hover:underline"
                            >
                              View Full History →
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {historySearch ? 'No vehicles match your search' : 'No readings yet'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              Confirm High Jump
            </AlertDialogTitle>
            <AlertDialogDescription>
              The new reading is{' '}
              <strong>
                {pendingSubmit ? (pendingSubmit.km - lastKm).toLocaleString() : 0} km
              </strong>{' '}
              higher than the last reading. This is unusually high.
              <br />
              <br />
              Are you sure you want to save this reading?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Yes, Save Reading</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
