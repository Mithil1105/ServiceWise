import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Droplet, Fuel as FuelIcon, Loader2, ShieldCheck } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useAuth } from '@/lib/auth-context';
import { useOrganizationSettings } from '@/hooks/use-organization-settings';
import { useCars } from '@/hooks/use-cars';
import { useLatestOdometer } from '@/hooks/use-odometer';
import { useLatestFuelEntry, useCreateFuelEntry, useFuelEntries } from '@/hooks/use-fuel';
import { useAssignedCarIdsForCurrentUser } from '@/hooks/use-car-assignments';
import { Navigate } from 'react-router-dom';
import { toLocalDateTimeInputValue } from '@/lib/date';
import { formatCarLabel } from '@/lib/utils';
import type { FuelEntry } from '@/types';
import { DocumentFileInput } from '@/components/ui/document-file-input';
import { MAX_DOCUMENT_FILE_SIZE_BYTES } from '@/lib/document-upload';
import { FUEL_ENTRY_FORM_FIELD_LABELS } from '@/types/form-config';

export default function Fuel() {
  const { isAdmin, isFuelFiller } = useAuth();
  const { data: cars, isLoading: carsLoading } = useCars();
  const { assignedCarIds, isRestricted } = useAssignedCarIdsForCurrentUser();

  // Enforce access: only fuel_filler + admin can log fuel fills + upload bills.
  const canLogFuel = isFuelFiller || isAdmin;
  if (!canLogFuel) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center max-w-xl mx-auto space-y-4">
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold">Access restricted</h1>
        <p className="text-muted-foreground">
          You don’t have permission to log fuel fills. Ask your admin for access.
        </p>
      </div>
    );
  }

  const { data: orgSettings } = useOrganizationSettings();
  const fuelEntryConfig = orgSettings?.fuel_entry_form_config ?? {};
  const fuelFieldOverrides = fuelEntryConfig.fieldOverrides ?? {};

  const isFieldHidden = (key: keyof typeof FUEL_ENTRY_FORM_FIELD_LABELS) => fuelFieldOverrides[key]?.hidden === true;
  const getFieldLabel = (key: keyof typeof FUEL_ENTRY_FORM_FIELD_LABELS, fallback: string) =>
    fuelFieldOverrides[key]?.label ?? fallback;

  const scopedCars = useMemo(() => {
    if (!cars) return [];
    if (assignedCarIds) return cars.filter((c) => assignedCarIds.includes(c.id));
    return cars;
  }, [cars, assignedCarIds]);

  const [selectedCarId, setSelectedCarId] = useState('');
  const selectedCar = useMemo(() => scopedCars.find((c) => c.id === selectedCarId), [scopedCars, selectedCarId]);

  const { data: latestOdo, isLoading: odoLoading } = useLatestOdometer(selectedCarId);
  const { data: latestFuelEntry } = useLatestFuelEntry(selectedCarId);
  const { data: fuelEntries = [], isLoading: fuelHistoryLoading } = useFuelEntries({ carId: selectedCarId });

  useEffect(() => {
    if (!selectedCarId && scopedCars.length > 0) setSelectedCarId(scopedCars[0].id);
  }, [selectedCarId, scopedCars]);

  if (isRestricted && selectedCarId && assignedCarIds && !assignedCarIds.includes(selectedCarId)) {
    return <Navigate to="/app" replace />;
  }

  const [filledAtValue, setFilledAtValue] = useState(() => toLocalDateTimeInputValue());
  const [odometerValue, setOdometerValue] = useState('');
  const [odometerTouched, setOdometerTouched] = useState(false);
  const [litersValue, setLitersValue] = useState('');
  const [amountValue, setAmountValue] = useState('');
  const [fuelTypeValue, setFuelTypeValue] = useState<string>('');
  const [isFullTank, setIsFullTank] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const [fuelBillFile, setFuelBillFile] = useState<File | null>(null);

  const allowedFuelTypes = useMemo(() => {
    const raw = (selectedCar as any)?.allowed_fuel_types as string[] | null | undefined;
    const fromAllowed = (raw ?? []).map((x) => (x || '').trim().toLowerCase()).filter(Boolean);
    const fallback = (selectedCar?.fuel_type || '').trim().toLowerCase();
    const merged = Array.from(new Set([...(fromAllowed.length ? fromAllowed : []), ...(fallback ? [fallback] : [])]));

    // Real-world rule: CNG vehicles can still fill petrol in India.
    // If CNG is present, expose petrol as an allowed option by default.
    if (merged.includes('cng') && !merged.includes('petrol')) {
      merged.push('petrol');
    }

    const canonical = merged.filter((x) => ['petrol', 'diesel', 'cng', 'electric'].includes(x));
    return canonical.length ? canonical : ['diesel'];
  }, [selectedCar]);

  const fuelTypeHidden = isFieldHidden('fuel_type');
  const fullTankHidden = isFieldHidden('is_full_tank');
  const notesHidden = isFieldHidden('notes');
  const billUploadHidden = isFieldHidden('bill_upload');

  useEffect(() => {
    // If the field is hidden, we never want to keep a stale file selected.
    if (billUploadHidden) setFuelBillFile(null);
  }, [billUploadHidden]);

  useEffect(() => {
    if (fullTankHidden) setIsFullTank(false);
  }, [fullTankHidden]);

  useEffect(() => {
    if (!selectedCarId) return;
    // If current selection is invalid for this car, reset to first allowed.
    if (!fuelTypeValue || !allowedFuelTypes.includes(fuelTypeValue)) {
      setFuelTypeValue(allowedFuelTypes[0]);
    }
  }, [selectedCarId, allowedFuelTypes, fuelTypeValue]);

  useEffect(() => {
    if (!latestOdo) return;
    if (!odometerTouched) setOdometerValue(String(latestOdo.odometer_km ?? ''));
  }, [latestOdo, odometerTouched]);

  const carOptions = useMemo(() => {
    return (scopedCars ?? []).map((car) => ({
      value: car.id,
      label: formatCarLabel(car),
    }));
  }, [scopedCars]);

  const lastKnownOdoKm = Math.max(latestOdo?.odometer_km ?? 0, latestFuelEntry?.odometer_km ?? 0);
  const lastKnownTimeMs = Math.max(
    latestOdo?.reading_at ? new Date(latestOdo.reading_at).getTime() : 0,
    latestFuelEntry?.filled_at ? new Date(latestFuelEntry.filled_at).getTime() : 0
  );

  const createFuel = useCreateFuelEntry();
  const MAX_FUEL_BILL_PICK_BYTES = MAX_DOCUMENT_FILE_SIZE_BYTES * 5;

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showConfirmBackdated, setShowConfirmBackdated] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<{
    car_id: string;
    filled_at: string;
    odometer_km: number;
    fuel_liters: number;
    amount_inr: number;
    fuel_type: string;
    is_full_tank: boolean;
    notes?: string;
    billFile?: File | null;
  } | null>(null);

  const resetForm = () => {
    setLitersValue('');
    setAmountValue('');
    setIsFullTank(false);
    setNotesValue('');
    setFuelBillFile(null);
    setErrors({});
    setPendingPayload(null);
    setShowConfirmBackdated(false);
    setOdometerTouched(false);
    if (latestOdo) setOdometerValue(String(latestOdo.odometer_km));
    setFilledAtValue(toLocalDateTimeInputValue());
  };

  const validateAndMaybeConfirm = (): ReturnType<typeof createFuel.mutateAsync> | null => {
    setErrors({});

    if (!selectedCarId) {
      setErrors({ car: 'Please select a vehicle' });
      return null;
    }

    const odometer_km = Number(odometerValue);
    const fuel_liters = Number(litersValue);
    const amount_inr = Number(amountValue);
    const filled_at = new Date(filledAtValue).toISOString();

    if (!Number.isFinite(odometer_km) || odometer_km < 0) {
      setErrors({ odometer: 'Please enter a valid odometer reading (>= 0)' });
      return null;
    }
    if (!Number.isFinite(fuel_liters) || fuel_liters <= 0) {
      setErrors({ liters: 'Fuel liters must be > 0' });
      return null;
    }
    if (!Number.isFinite(amount_inr) || amount_inr < 0) {
      setErrors({ amount: 'Amount must be >= 0' });
      return null;
    }
    if (!fuelTypeValue) {
      setErrors({ fuel_type: 'Please select a fuel type' });
      return null;
    }

    if (odometer_km < lastKnownOdoKm) {
      // Only allow "odometer going backwards" for older back-dated entries
      if (new Date(filled_at).getTime() < lastKnownTimeMs) {
        setPendingPayload({
          car_id: selectedCarId,
          filled_at,
          odometer_km,
          fuel_liters,
          amount_inr,
          fuel_type: fuelTypeValue,
          is_full_tank: isFullTank,
          notes: notesHidden ? undefined : notesValue.trim() || undefined,
          billFile: fuelBillFile,
        });
        setShowConfirmBackdated(true);
        return null;
      }

      setErrors({
        odometer: `Odometer cannot be less than the last known reading (${lastKnownOdoKm.toLocaleString()} km)`,
      });
      return null;
    }

    return createFuel.mutateAsync({
      car_id: selectedCarId,
      filled_at,
      odometer_km,
      fuel_liters,
      amount_inr,
      fuel_type: fuelTypeValue,
      is_full_tank: isFullTank,
      notes: notesHidden ? undefined : notesValue.trim() || undefined,
      billFile: fuelBillFile,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const maybePromise = validateAndMaybeConfirm();
    if (maybePromise) {
      try {
        await maybePromise;
        resetForm();
      } catch {
        // toast handled in hook
      }
    }
  };

  const confirmBackdated = async () => {
    if (!pendingPayload) return;
    try {
      await createFuel.mutateAsync(pendingPayload);
      resetForm();
    } catch {
      // toast handled in hook
    }
  };

  const recentFills: FuelEntry[] = fuelEntries.slice(0, 5);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <FuelIcon className="h-6 w-6" />
            Fuel Filling
          </h1>
          <p className="text-muted-foreground">Log fuel fills and odometer at the time of refueling.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Droplet className="h-5 w-5" />
              New Fuel Entry
            </CardTitle>
            <CardDescription>All fields required unless noted</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label>Vehicle *</Label>
                <SearchableSelect
                  id="fuel-car"
                  options={carOptions}
                  value={selectedCarId}
                  onValueChange={setSelectedCarId}
                  placeholder={carsLoading ? 'Loading...' : 'Select a vehicle'}
                  searchPlaceholder="Search vehicles..."
                  disabled={carsLoading || carOptions.length === 0}
                />
                {errors.car && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.car}</p>}
              </div>

              {selectedCar && (
                <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Last known odometer</span>
                    <span className="font-medium">{odoLoading ? '...' : `${lastKnownOdoKm.toLocaleString()} km`}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Fuel type</span>
                    <span className="font-medium">{fuelTypeValue || selectedCar.fuel_type || 'N/A'}</span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="filled_at">Filled Date & Time *</Label>
                <Input
                  id="filled_at"
                  type="datetime-local"
                  value={filledAtValue}
                  onChange={(e) => setFilledAtValue(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="odometer_km">{getFieldLabel('odometer_km', 'Odometer at fill (km)')} *</Label>
                <Input
                  id="odometer_km"
                  type="number"
                  step={1}
                  value={odometerValue}
                  onChange={(e) => {
                    setOdometerValue(e.target.value);
                    setOdometerTouched(true);
                  }}
                  min={0}
                />
                {errors.odometer && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.odometer}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="liters">{getFieldLabel('fuel_liters', 'Liters')} *</Label>
                <Input
                  id="liters"
                  type="number"
                  step={0.001}
                  value={litersValue}
                  onChange={(e) => setLitersValue(e.target.value)}
                  min={0}
                />
                {errors.liters && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.liters}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount_inr">{getFieldLabel('amount_inr', 'Amount (INR)')} *</Label>
                <Input
                  id="amount_inr"
                  type="number"
                  step={0.01}
                  value={amountValue}
                  onChange={(e) => setAmountValue(e.target.value)}
                  min={0}
                  className="[-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                />
                {errors.amount && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.amount}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>{getFieldLabel('fuel_type', 'Fuel Type')} *</Label>
                {fuelTypeHidden ? (
                  <Badge variant="secondary" className="capitalize">
                    {fuelTypeValue || allowedFuelTypes[0]}
                  </Badge>
                ) : allowedFuelTypes.length <= 1 ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="capitalize">
                      {allowedFuelTypes[0]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">This vehicle supports only one fuel type.</span>
                  </div>
                ) : (
                  <SearchableSelect
                    value={fuelTypeValue}
                    onValueChange={setFuelTypeValue}
                    placeholder="Select fuel type"
                    options={allowedFuelTypes.map((t) => ({
                      value: t,
                      label: t.toUpperCase(),
                    }))}
                  />
                )}
                {errors.fuel_type && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.fuel_type}
                  </p>
                )}
              </div>

              {!fullTankHidden && (
                <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/30">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">
                      {getFieldLabel('is_full_tank', 'Is this a full-tank fill?')}
                    </p>
                    <p className="text-xs text-muted-foreground">Used to compute accurate full-tank mileage.</p>
                  </div>
                  <Switch checked={isFullTank} onCheckedChange={setIsFullTank} />
                </div>
              )}

              {!notesHidden && (
                <div className="space-y-2">
                  <Label htmlFor="notes">{getFieldLabel('notes', 'Notes (optional)')}</Label>
                  <Input id="notes" value={notesValue} onChange={(e) => setNotesValue(e.target.value)} placeholder="e.g. Station name, bill ref" />
                </div>
              )}

              {!billUploadHidden && (
                <div className="space-y-2">
                  <Label>{getFieldLabel('bill_upload', 'Fuel Bill (optional)')}</Label>
                  <DocumentFileInput
                    id="fuel-bill"
                    value={fuelBillFile}
                    onChange={setFuelBillFile}
                    maxSizeBytes={MAX_FUEL_BILL_PICK_BYTES}
                    disabled={createFuel.isPending}
                  />
                </div>
              )}

              <Button className="w-full" type="submit" disabled={createFuel.isPending || !selectedCarId}>
                {createFuel.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  'Save Fuel Entry'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FuelIcon className="h-5 w-5" />
              Recent Fuel Fills
            </CardTitle>
            <CardDescription>Latest 5 fills for the selected vehicle</CardDescription>
          </CardHeader>
          <CardContent>
            {fuelHistoryLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : recentFills.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                No fuel fills recorded yet
              </div>
            ) : (
              <div className="space-y-3">
                {recentFills.map((f) => (
                  <div key={f.id} className="border rounded-lg p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{new Date(f.filled_at).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">
                        Odo: {f.odometer_km.toLocaleString()} km • {f.is_full_tank ? 'Full-tank' : 'Partial'}
                      </p>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <p className="font-semibold">₹{f.amount_inr.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{f.fuel_liters.toLocaleString()} L</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={showConfirmBackdated} onOpenChange={setShowConfirmBackdated}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              Odometer going backwards
            </AlertDialogTitle>
            <AlertDialogDescription>
              You’re saving an entry with an odometer lower than the last known reading. This is allowed only for older back-dated entries.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBackdated} disabled={createFuel.isPending}>
              {createFuel.isPending ? 'Saving...' : 'Confirm & Save'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

