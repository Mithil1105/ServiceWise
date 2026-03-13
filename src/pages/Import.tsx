import { useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { useOrg } from '@/hooks/use-org';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Upload, Download, Loader2, Shield, UserCheck, Users, Car, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { parseCSV, getCell } from '@/lib/csv-parse';

// Drivers CSV: license expiry captured as separate day/month/year columns
// so users can work in DD/MM/YY style while we store YYYY-MM-DD.
const DRIVERS_HEADERS =
  'name,phone,location,region,license_type,license_expiry_dd,license_expiry_mm,license_expiry_yyyy,notes,status,driver_type';
const DRIVERS_TEMPLATE = `${DRIVERS_HEADERS}\n"John Doe","9876543210","Mumbai","West",lmv,31,12,2025,Notes here,active,permanent`;

const CUSTOMERS_HEADERS = 'name,phone';
const CUSTOMERS_TEMPLATE = `${CUSTOMERS_HEADERS}\n"Acme Corp","9123456789"`;

const FLEET_HEADERS = 'vehicle_number,brand,model,year,fuel_type,seats,vehicle_type,vehicle_class,owner_name,vin_chassis,notes,initial_odometer';
const FLEET_TEMPLATE = `${FLEET_HEADERS}\n"MH01AB1234","Toyota","Innova",2022,petrol,7,private,lmv,"Owner Name",,Notes,0`;

function downloadCSV(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type RowError = { row: number; message: string };

// --- Drivers ---
function validateDriverRow(row: string[], headers: string[], rowIndex: number): RowError | null {
  const name = getCell(row, headers, 'name');
  const phone = getCell(row, headers, 'phone');
  if (!name) return { row: rowIndex, message: 'name is required' };
  if (!phone) return { row: rowIndex, message: 'phone is required' };
  const licenseType = getCell(row, headers, 'license_type');
  if (licenseType && !['lmv', 'hmv'].includes(licenseType.toLowerCase())) return { row: rowIndex, message: 'license_type must be lmv or hmv' };
  const driverType = getCell(row, headers, 'driver_type');
  if (driverType && !['permanent', 'temporary'].includes(driverType.toLowerCase())) return { row: rowIndex, message: 'driver_type must be permanent or temporary' };
  const status = getCell(row, headers, 'status');
  if (status && !['active', 'inactive'].includes(status.toLowerCase())) return { row: rowIndex, message: 'status must be active or inactive' };

  // New format: separate DD / MM / YYYY columns for license expiry.
  const dd = getCell(row, headers, 'license_expiry_dd');
  const mm = getCell(row, headers, 'license_expiry_mm');
  const yyyy = getCell(row, headers, 'license_expiry_yyyy');

  if (dd || mm || yyyy) {
    // If any part is present, require all three and validate ranges.
    if (!dd || !mm || !yyyy) {
      return {
        row: rowIndex,
        message: 'license_expiry_dd, license_expiry_mm, and license_expiry_yyyy must all be provided',
      };
    }
    const dayNum = Number(dd);
    const monthNum = Number(mm);
    const yearNum = Number(yyyy.length === 2 ? `20${yyyy}` : yyyy);
    if (
      !Number.isInteger(dayNum) ||
      !Number.isInteger(monthNum) ||
      !Number.isInteger(yearNum) ||
      dayNum < 1 ||
      dayNum > 31 ||
      monthNum < 1 ||
      monthNum > 12 ||
      yearNum < 1900 ||
      yearNum > 2100
    ) {
      return {
        row: rowIndex,
        message: 'license_expiry_dd/mm/yyyy must be a valid date (day 1-31, month 1-12, year 1900-2100)',
      };
    }
  } else {
    // Backwards compatibility: allow legacy single license_expiry column (YYYY-MM-DD)
    const legacyExpiry = getCell(row, headers, 'license_expiry');
    if (legacyExpiry && !/^\d{4}-\d{2}-\d{2}$/.test(legacyExpiry)) {
      return { row: rowIndex, message: 'license_expiry must be YYYY-MM-DD' };
    }
  }
  return null;
}

// --- Customers ---
function validateCustomerRow(row: string[], headers: string[], rowIndex: number): RowError | null {
  const name = getCell(row, headers, 'name');
  const phone = getCell(row, headers, 'phone');
  if (!name) return { row: rowIndex, message: 'name is required' };
  if (!phone) return { row: rowIndex, message: 'phone is required' };
  return null;
}

// --- Fleet ---
function validateFleetRow(row: string[], headers: string[], rowIndex: number): RowError | null {
  const vehicleNumber = getCell(row, headers, 'vehicle_number');
  if (!vehicleNumber) return { row: rowIndex, message: 'vehicle_number is required' };
  const vehicleType = getCell(row, headers, 'vehicle_type');
  if (vehicleType && !['private', 'commercial'].includes(vehicleType.toLowerCase())) return { row: rowIndex, message: 'vehicle_type must be private or commercial' };
  const vehicleClass = getCell(row, headers, 'vehicle_class');
  if (vehicleClass && !['lmv', 'hmv'].includes(vehicleClass.toLowerCase())) return { row: rowIndex, message: 'vehicle_class must be lmv or hmv' };
  const year = getCell(row, headers, 'year');
  if (year && (isNaN(Number(year)) || Number(year) < 1900 || Number(year) > 2100)) return { row: rowIndex, message: 'year must be a valid year' };
  const seats = getCell(row, headers, 'seats');
  if (seats && (isNaN(Number(seats)) || Number(seats) < 1)) return { row: rowIndex, message: 'seats must be a positive number' };
  const initialOdo = getCell(row, headers, 'initial_odometer');
  if (initialOdo && isNaN(Number(initialOdo))) return { row: rowIndex, message: 'initial_odometer must be a number' };
  return null;
}

const PREVIEW_ROWS = 10;
const BATCH_SIZE = 50;

export default function Import() {
  const { profile, isAdmin, isManager } = useAuth();
  const { orgId } = useOrg();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'drivers' | 'customers' | 'fleet'>('drivers');
  const [driversContent, setDriversContent] = useState<string | null>(null);
  const [customersContent, setCustomersContent] = useState<string | null>(null);
  const [fleetContent, setFleetContent] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const canAccess = isAdmin || isManager;
  const orgIdVal = orgId ?? profile?.organization_id ?? null;

  const fileContent = activeTab === 'drivers' ? driversContent : activeTab === 'customers' ? customersContent : fleetContent;

  const setContentForTab = useCallback((tab: 'drivers' | 'customers' | 'fleet', text: string) => {
    if (tab === 'drivers') setDriversContent(text);
    else if (tab === 'customers') setCustomersContent(text);
    else setFleetContent(text);
  }, []);

  const { rows, headers, dataRows, errors, validRows } = useMemo(() => {
    const content = fileContent;
    const rows = content ? parseCSV(content) : [];
    const headers = rows.length > 0 ? rows[0].map((h) => h.trim()) : [];
    const dataRows = rows.slice(1);
    if (rows.length < 2 && content) {
      return { rows, headers, dataRows, errors: [{ row: 0, message: 'CSV must have a header row and at least one data row' }] as RowError[], validRows: [] };
    }
    const errs: RowError[] = [];
    for (let i = 1; i < rows.length; i++) {
      const err =
        activeTab === 'drivers'
          ? validateDriverRow(rows[i], headers, i + 1)
          : activeTab === 'customers'
            ? validateCustomerRow(rows[i], headers, i + 1)
            : validateFleetRow(rows[i], headers, i + 1);
      if (err) errs.push(err);
    }
    const validRows = dataRows.filter((_, i) => !errs.some((e) => e.row === i + 2));
    return { rows, headers, dataRows, errors: errs, validRows };
  }, [fileContent, activeTab]);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>, tab: 'drivers' | 'customers' | 'fleet') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = (reader.result as string) || '';
      setContentForTab(tab, text);
      setActiveTab(tab);
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  }, [setContentForTab]);

  const handleImportDrivers = async () => {
    if (!orgIdVal || validRows.length === 0) return;
    setImporting(true);
    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user?.id ?? null;
    let ok = 0;
    const failed: { row: number; msg: string }[] = [];
    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      const batch = validRows.slice(i, i + BATCH_SIZE);
      const inserts = batch.map((row) => {
        const name = getCell(row, headers, 'name');
        const phone = getCell(row, headers, 'phone');
        const location = getCell(row, headers, 'location') || null;
        const region = getCell(row, headers, 'region') || null;
        const licenseType = (getCell(row, headers, 'license_type') || 'lmv').toLowerCase() as 'lmv' | 'hmv';
      // Build license_expiry from separate DD/MM/YYYY columns (preferred),
      // falling back to legacy single license_expiry (YYYY-MM-DD) if needed.
      const dd = getCell(row, headers, 'license_expiry_dd');
      const mm = getCell(row, headers, 'license_expiry_mm');
      const yyyy = getCell(row, headers, 'license_expiry_yyyy');
      let licenseExpiry: string | null = null;
      if (dd || mm || yyyy) {
        const day = (dd || '').padStart(2, '0');
        const month = (mm || '').padStart(2, '0');
        const yearRaw = yyyy || '';
        const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
        licenseExpiry = year && month && day ? `${year}-${month}-${day}` : null;
      } else {
        licenseExpiry = getCell(row, headers, 'license_expiry') || null;
      }
        const notes = getCell(row, headers, 'notes') || null;
        const status = (getCell(row, headers, 'status') || 'active').toLowerCase();
        const driverType = (getCell(row, headers, 'driver_type') || 'temporary').toLowerCase() as 'permanent' | 'temporary';
        return {
          organization_id: orgIdVal,
          name: name.trim(),
          phone: phone.trim(),
          location,
          region,
          license_type: licenseType === 'hmv' ? 'hmv' : 'lmv',
          license_expiry: licenseExpiry || null,
          notes,
          status,
          driver_type: driverType === 'permanent' ? 'permanent' : 'temporary',
          created_by: userId,
        };
      });
      const { data, error } = await supabase.from('drivers').insert(inserts).select('id');
      if (error) {
        batch.forEach((_, j) => failed.push({ row: i + j + 2, msg: error.message }));
      } else {
        ok += data?.length ?? batch.length;
      }
    }
    setImporting(false);
    if (failed.length > 0) {
      toast({ title: `Imported ${ok} drivers; ${failed.length} failed`, description: failed[0]?.msg, variant: 'destructive' });
    } else {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast({ title: `Imported ${ok} drivers successfully` });
      setDriversContent(null);
    }
  };

  const handleImportCustomers = async () => {
    if (!orgIdVal || validRows.length === 0) return;
    setImporting(true);
    let ok = 0;
    const failed: { row: number; msg: string }[] = [];
    for (let idx = 0; idx < validRows.length; idx++) {
      const row = validRows[idx];
      const name = getCell(row, headers, 'name');
      const phone = getCell(row, headers, 'phone');
      const rowNum = idx + 2;
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('organization_id', orgIdVal)
        .eq('phone', phone.trim())
        .maybeSingle();
      if (existing) {
        const { error } = await supabase.from('customers').update({ name: name.trim(), updated_at: new Date().toISOString() }).eq('id', existing.id);
        if (error) failed.push({ row: rowNum, msg: error.message });
        else ok++;
      } else {
        const { error } = await supabase.from('customers').insert({ organization_id: orgIdVal, name: name.trim(), phone: phone.trim() });
        if (error) failed.push({ row: rowNum, msg: error.message });
        else ok++;
      }
    }
    setImporting(false);
    if (failed.length > 0) {
      toast({ title: `Imported/updated ${ok} customers; ${failed.length} failed`, description: failed[0]?.msg, variant: 'destructive' });
    } else {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: `Imported/updated ${ok} customers successfully` });
      setCustomersContent(null);
    }
  };

  const handleImportFleet = async () => {
    if (!orgIdVal || validRows.length === 0) return;
    setImporting(true);
    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user?.id ?? null;
    let ok = 0;
    const failed: { row: number; msg: string }[] = [];
    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      const vehicleNumber = getCell(row, headers, 'vehicle_number');
      const brand = getCell(row, headers, 'brand') || undefined;
      const model = getCell(row, headers, 'model') || '';
      const yearRaw = getCell(row, headers, 'year');
      const year = yearRaw ? Number(yearRaw) : undefined;
      const fuelType = getCell(row, headers, 'fuel_type') || undefined;
      const seatsRaw = getCell(row, headers, 'seats');
      const seats = seatsRaw ? Number(seatsRaw) : 5;
      const vehicleType = (getCell(row, headers, 'vehicle_type') || '').toLowerCase();
      const vehicleClass = (getCell(row, headers, 'vehicle_class') || 'lmv').toLowerCase() as 'lmv' | 'hmv';
      const ownerName = getCell(row, headers, 'owner_name') || undefined;
      const vinChassis = getCell(row, headers, 'vin_chassis') || undefined;
      const notes = getCell(row, headers, 'notes') || undefined;
      const initialOdo = Number(getCell(row, headers, 'initial_odometer') || '0') || 0;

      const { data: car, error: carError } = await supabase
        .from('cars')
        .insert({
          organization_id: orgIdVal,
          vehicle_number: vehicleNumber.trim(),
          brand: brand || null,
          model: model.trim() || '—',
          year: year ?? null,
          fuel_type: fuelType || null,
          seats,
          vehicle_type: vehicleType === 'commercial' ? 'commercial' : vehicleType === 'private' ? 'private' : null,
          vehicle_class: vehicleClass === 'hmv' ? 'hmv' : 'lmv',
          owner_name: ownerName || null,
          vin_chassis: vinChassis || null,
          notes: notes || null,
          status: 'active',
          created_by: userId,
        })
        .select('id')
        .single();

      if (carError) {
        failed.push({ row: i + 2, msg: carError.message });
      } else if (car?.id) {
        await supabase.from('odometer_entries').insert({
          organization_id: orgIdVal,
          car_id: car.id,
          odometer_km: initialOdo,
          entered_by: userId,
        });
        ok++;
      }
    }
    setImporting(false);
    if (failed.length > 0) {
      toast({ title: `Imported ${ok} vehicles; ${failed.length} failed`, description: failed[0]?.msg, variant: 'destructive' });
    } else {
      queryClient.invalidateQueries({ queryKey: ['cars'] });
      toast({ title: `Imported ${ok} vehicles successfully` });
      setFleetContent(null);
    }
  };

  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Shield className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold mb-2">Access restricted</h2>
        <p className="text-muted-foreground mb-4">Only org administrators and managers can use Import.</p>
        <Button asChild>
          <Link to="/app">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Upload className="h-7 w-7" />
          Import data
        </h1>
        <p className="text-muted-foreground mt-1">Import drivers, customers, or fleet from CSV. Use the templates to match the expected columns.</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="drivers" className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Drivers
          </TabsTrigger>
          <TabsTrigger value="customers" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Customers
          </TabsTrigger>
          <TabsTrigger value="fleet" className="flex items-center gap-2">
            <Car className="h-4 w-4" />
            Fleet
          </TabsTrigger>
        </TabsList>

        <TabsContent value="drivers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Import drivers</CardTitle>
              <CardDescription>
                CSV columns: name (required), phone (required), location, region, license_type (lmv/hmv),
                license_expiry_dd (day, 1-31), license_expiry_mm (month, 1-12), license_expiry_yyyy (year, e.g. 2027),
                notes, status (active/inactive), driver_type (permanent/temporary).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => downloadCSV('drivers-import-template.csv', DRIVERS_TEMPLATE)}>
                  <Download className="h-4 w-4 mr-2" />
                  Download template
                </Button>
                <label className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 cursor-pointer">
                  <input type="file" accept=".csv" className="sr-only" onChange={(e) => handleFile(e, 'drivers')} />
                  <Upload className="h-4 w-4 mr-2" />
                  Choose CSV
                </label>
              </div>
              {fileContent && (
                <>
                  <p className="text-sm text-muted-foreground">
                    {dataRows.length} row(s), {errors.length} error(s). {validRows.length} row(s) ready to import.
                  </p>
                  {errors.length > 0 && (
                    <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
                      {errors.slice(0, 5).map((e) => (
                        <div key={e.row}>
                          Row {e.row}: {e.message}
                        </div>
                      ))}
                      {errors.length > 5 && <div>… and {errors.length - 5} more</div>}
                    </div>
                  )}
                  {validRows.length > 0 && (
                    <>
                      <div className="rounded border overflow-x-auto max-h-64 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {headers.map((h) => (
                                <TableHead key={h}>{h}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {validRows.slice(0, PREVIEW_ROWS).map((row, idx) => (
                              <TableRow key={idx}>
                                {headers.map((h, i) => (
                                  <TableCell key={i}>{row[i] ?? ''}</TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      {validRows.length > PREVIEW_ROWS && <p className="text-xs text-muted-foreground">Showing first {PREVIEW_ROWS} of {validRows.length} rows.</p>}
                      <Button disabled={importing} onClick={handleImportDrivers}>
                        {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Import {validRows.length} drivers
                      </Button>
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Import customers</CardTitle>
              <CardDescription>CSV columns: name (required), phone (required). Existing customers (same phone in your org) will be updated.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => downloadCSV('customers-import-template.csv', CUSTOMERS_TEMPLATE)}>
                  <Download className="h-4 w-4 mr-2" />
                  Download template
                </Button>
                <label className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 cursor-pointer">
                  <input type="file" accept=".csv" className="sr-only" onChange={(e) => handleFile(e, 'customers')} />
                  <Upload className="h-4 w-4 mr-2" />
                  Choose CSV
                </label>
              </div>
              {fileContent && (
                <>
                  <p className="text-sm text-muted-foreground">
                    {dataRows.length} row(s), {errors.length} error(s). {validRows.length} row(s) ready to import.
                  </p>
                  {errors.length > 0 && (
                    <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
                      {errors.slice(0, 5).map((e) => (
                        <div key={e.row}>
                          Row {e.row}: {e.message}
                        </div>
                      ))}
                      {errors.length > 5 && <div>… and {errors.length - 5} more</div>}
                    </div>
                  )}
                  {validRows.length > 0 && (
                    <>
                      <div className="rounded border overflow-x-auto max-h-64 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {headers.map((h) => (
                                <TableHead key={h}>{h}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {validRows.slice(0, PREVIEW_ROWS).map((row, idx) => (
                              <TableRow key={idx}>
                                {headers.map((h, i) => (
                                  <TableCell key={i}>{row[i] ?? ''}</TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      {validRows.length > PREVIEW_ROWS && <p className="text-xs text-muted-foreground">Showing first {PREVIEW_ROWS} of {validRows.length} rows.</p>}
                      <Button disabled={importing} onClick={handleImportCustomers}>
                        {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Import / update {validRows.length} customers
                      </Button>
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fleet" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Import fleet</CardTitle>
              <CardDescription>CSV columns: vehicle_number (required), brand, model, year, fuel_type, seats, vehicle_type (private/commercial), vehicle_class (lmv/hmv), owner_name, vin_chassis, notes, initial_odometer.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => downloadCSV('fleet-import-template.csv', FLEET_TEMPLATE)}>
                  <Download className="h-4 w-4 mr-2" />
                  Download template
                </Button>
                <label className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 cursor-pointer">
                  <input type="file" accept=".csv" className="sr-only" onChange={(e) => handleFile(e, 'fleet')} />
                  <Upload className="h-4 w-4 mr-2" />
                  Choose CSV
                </label>
              </div>
              {fileContent && (
                <>
                  <p className="text-sm text-muted-foreground">
                    {dataRows.length} row(s), {errors.length} error(s). {validRows.length} row(s) ready to import.
                  </p>
                  {errors.length > 0 && (
                    <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
                      {errors.slice(0, 5).map((e) => (
                        <div key={e.row}>
                          Row {e.row}: {e.message}
                        </div>
                      ))}
                      {errors.length > 5 && <div>… and {errors.length - 5} more</div>}
                    </div>
                  )}
                  {validRows.length > 0 && (
                    <>
                      <div className="rounded border overflow-x-auto max-h-64 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {headers.map((h) => (
                                <TableHead key={h}>{h}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {validRows.slice(0, PREVIEW_ROWS).map((row, idx) => (
                              <TableRow key={idx}>
                                {headers.map((h, i) => (
                                  <TableCell key={i}>{row[i] ?? ''}</TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      {validRows.length > PREVIEW_ROWS && <p className="text-xs text-muted-foreground">Showing first {PREVIEW_ROWS} of {validRows.length} rows.</p>}
                      <Button disabled={importing} onClick={handleImportFleet}>
                        {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Import {validRows.length} vehicles
                      </Button>
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
