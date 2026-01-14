import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format, addHours } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Car, Check, X, Plus, Trash2, Loader2, Search, Users, ArrowUpDown } from 'lucide-react';
import { useCreateBooking, useAvailableCars, useAssignVehicle } from '@/hooks/use-bookings';
import { useUpsertCustomer } from '@/hooks/use-customers';
import { CustomerAutocomplete } from '@/components/bookings/CustomerAutocomplete';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { TRIP_TYPE_LABELS, RATE_TYPE_LABELS, type TripType, type RateType, type BookingStatus } from '@/types/booking';

interface VehicleAssignment {
  car_id: string;
  vehicle_number: string;
  model: string;
  seats: number;
  driver_name: string;
  driver_phone: string;
  rate_type: RateType;
  rate_total: number | string;
  rate_per_day: number | string;
  rate_per_km: number | string;
  estimated_km: number | string;
  advance_amount: number | string;
}

type SortOption = 'vehicle_number' | 'model' | 'seats';

export default function BookingNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultDate = searchParams.get('date');

  const createBooking = useCreateBooking();
  const assignVehicle = useAssignVehicle();
  const upsertCustomer = useUpsertCustomer();

  // Form state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [tripType, setTripType] = useState<TripType>('local');
  const [startAt, setStartAt] = useState(defaultDate ? `${defaultDate}T09:00` : format(addHours(new Date(), 1), "yyyy-MM-dd'T'HH:00"));
  const [endAt, setEndAt] = useState(defaultDate ? `${defaultDate}T18:00` : format(addHours(new Date(), 10), "yyyy-MM-dd'T'HH:00"));
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<BookingStatus>('inquiry');
  const [selectedVehicles, setSelectedVehicles] = useState<VehicleAssignment[]>([]);
  const [showVehicleSelect, setShowVehicleSelect] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [selectedCarIds, setSelectedCarIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortOption>('vehicle_number');
  const [sortAsc, setSortAsc] = useState(true);
  const [minSeats, setMinSeats] = useState<number | ''>('');

  // Parse dates
  const startDate = startAt ? new Date(startAt) : null;
  const endDate = endAt ? new Date(endAt) : null;

  // Check availability
  const { data: availableCars, isLoading: loadingCars } = useAvailableCars(startDate, endDate);

  const availableForSelection = useMemo(() => {
    if (!availableCars) return [];
    const selectedIds = new Set(selectedVehicles.map(v => v.car_id));
    let cars = availableCars.filter(c => c.is_available && !selectedIds.has(c.car_id));
    
    // Apply search filter
    if (vehicleSearch.trim()) {
      const search = vehicleSearch.toLowerCase();
      cars = cars.filter(c => 
        c.vehicle_number.toLowerCase().includes(search) || 
        c.model.toLowerCase().includes(search)
      );
    }
    
    // Apply minimum seats filter
    if (minSeats) {
      cars = cars.filter(c => ((c as any).seats || 5) >= minSeats);
    }
    
    // Apply sorting
    cars.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'vehicle_number': comparison = a.vehicle_number.localeCompare(b.vehicle_number); break;
        case 'model': comparison = a.model.localeCompare(b.model); break;
        case 'seats': comparison = ((a as any).seats || 5) - ((b as any).seats || 5); break;
      }
      return sortAsc ? comparison : -comparison;
    });
    
    return cars;
  }, [availableCars, selectedVehicles, vehicleSearch, sortBy, sortAsc, minSeats]);

  const unavailableCars = useMemo(() => {
    if (!availableCars) return [];
    return availableCars.filter(c => !c.is_available);
  }, [availableCars]);
  
  const toggleCarSelection = (carId: string) => {
    setSelectedCarIds(prev => {
      const next = new Set(prev);
      if (next.has(carId)) next.delete(carId);
      else next.add(carId);
      return next;
    });
  };
  
  const handleAddSelectedVehicles = () => {
    if (!availableCars) return;
    const carsToAdd = availableCars.filter(c => selectedCarIds.has(c.car_id));
    const newVehicles: VehicleAssignment[] = carsToAdd.map(car => ({
      car_id: car.car_id,
      vehicle_number: car.vehicle_number,
      model: car.model,
      seats: (car as any).seats || 5,
      driver_name: '',
      driver_phone: '',
      rate_type: 'total' as RateType,
      rate_total: '',
      rate_per_day: '',
      rate_per_km: '',
      estimated_km: '',
      advance_amount: '',
    }));
    setSelectedVehicles(prev => [...prev, ...newVehicles]);
    setSelectedCarIds(new Set());
    setVehicleSearch('');
    setMinSeats('');
    setShowVehicleSelect(false);
  };
  
  const toggleSortBy = (field: SortOption) => {
    if (sortBy === field) setSortAsc(!sortAsc);
    else { setSortBy(field); setSortAsc(true); }
  };

  // Calculate totals
  const calculateVehicleTotal = (v: VehicleAssignment): number => {
    if (!startDate || !endDate) return 0;
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) || 1;
    
    switch (v.rate_type) {
      case 'total': return Number(v.rate_total) || 0;
      case 'per_day': return days * (Number(v.rate_per_day) || 0);
      case 'per_km': return (Number(v.rate_per_km) || 0) * (Number(v.estimated_km) || 0);
      case 'hybrid': return (days * (Number(v.rate_per_day) || 0)) + ((Number(v.rate_per_km) || 0) * (Number(v.estimated_km) || 0));
      default: return 0;
    }
  };

  const grandTotal = selectedVehicles.reduce((sum, v) => sum + calculateVehicleTotal(v), 0);
  const totalAdvance = selectedVehicles.reduce((sum, v) => sum + (Number(v.advance_amount) || 0), 0);

  const handleAddVehicle = (car: typeof availableForSelection[0]) => {
    setSelectedVehicles(prev => [...prev, {
      car_id: car.car_id,
      vehicle_number: car.vehicle_number,
      model: car.model,
      seats: (car as any).seats || 5,
      driver_name: '',
      driver_phone: '',
      rate_type: 'total' as RateType,
      rate_total: '',
      rate_per_day: '',
      rate_per_km: '',
      estimated_km: '',
      advance_amount: '',
    }]);
    setSelectedCarIds(prev => { const n = new Set(prev); n.delete(car.car_id); return n; });
  };

  const handleRemoveVehicle = (carId: string) => {
    setSelectedVehicles(prev => prev.filter(v => v.car_id !== carId));
  };

  const updateVehicle = (carId: string, field: keyof VehicleAssignment, value: string) => {
    setSelectedVehicles(prev => prev.map(v => 
      v.car_id === carId ? { ...v, [field]: value } : v
    ));
  };

  const validateForm = (): boolean => {
    if (!customerName.trim()) { toast.error('Customer name is required'); return false; }
    if (!customerPhone.trim()) { toast.error('Customer phone is required'); return false; }
    if (!startAt || !endAt) { toast.error('Start and end dates are required'); return false; }
    if (new Date(startAt) >= new Date(endAt)) { toast.error('End date must be after start date'); return false; }
    
    for (const v of selectedVehicles) {
      if (v.rate_type === 'per_km' || v.rate_type === 'hybrid') {
        if (!v.estimated_km || Number(v.estimated_km) <= 0) {
          toast.error(`Estimated KM is required for ${v.vehicle_number}`);
          return false;
        }
      }
      const total = calculateVehicleTotal(v);
      if (Number(v.advance_amount) > total) {
        toast.error(`Advance cannot exceed total for ${v.vehicle_number}`);
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    try {
      // Save customer to phonebook
      await upsertCustomer.mutateAsync({
        name: customerName.trim(),
        phone: customerPhone.trim(),
      });

      const booking = await createBooking.mutateAsync({
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        trip_type: tripType,
        start_at: new Date(startAt).toISOString(),
        end_at: new Date(endAt).toISOString(),
        pickup: pickup.trim() || undefined,
        dropoff: dropoff.trim() || undefined,
        notes: notes.trim() || undefined,
        status,
      });

      // Assign vehicles
      for (const v of selectedVehicles) {
        await assignVehicle.mutateAsync({
          booking_id: booking.id,
          car_id: v.car_id,
          driver_name: v.driver_name || undefined,
          driver_phone: v.driver_phone || undefined,
          rate_type: v.rate_type,
          rate_total: v.rate_type === 'total' ? Number(v.rate_total) : undefined,
          rate_per_day: ['per_day', 'hybrid'].includes(v.rate_type) ? Number(v.rate_per_day) : undefined,
          rate_per_km: ['per_km', 'hybrid'].includes(v.rate_type) ? Number(v.rate_per_km) : undefined,
          estimated_km: ['per_km', 'hybrid'].includes(v.rate_type) ? Number(v.estimated_km) : undefined,
          advance_amount: Number(v.advance_amount) || 0,
        });
      }

      navigate('/bookings/calendar');
    } catch (error) {
      // Error handled in mutation
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="page-title">New Booking</h1>
          <p className="text-sm text-muted-foreground">Create a new booking with vehicle assignment</p>
        </div>
      </div>

      {/* Customer & Trip Details */}
      <Card>
        <CardHeader><CardTitle>Trip Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <CustomerAutocomplete
            customerName={customerName}
            customerPhone={customerPhone}
            onNameChange={setCustomerName}
            onPhoneChange={setCustomerPhone}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Trip Type</Label>
              <Select value={tripType} onValueChange={(v) => setTripType(v as TripType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TRIP_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Start Date & Time *</Label>
              <Input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>End Date & Time *</Label>
              <Input type="datetime-local" value={endAt} onChange={e => setEndAt(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Pickup Location</Label>
              <Input value={pickup} onChange={e => setPickup(e.target.value)} placeholder="Enter pickup location" />
            </div>
            <div className="space-y-2">
              <Label>Drop Location</Label>
              <Input value={dropoff} onChange={e => setDropoff(e.target.value)} placeholder="Enter drop location" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any special requirements..." rows={2} />
          </div>
        </CardContent>
      </Card>

      {/* Vehicle Assignment */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Assign Vehicles</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setShowVehicleSelect(true)} disabled={!startDate || !endDate}>
            <Plus className="h-4 w-4 mr-1" /> Add Vehicle
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Available cars for selection */}
          {showVehicleSelect && (
            <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="font-medium">Select Vehicles</h4>
                <div className="flex items-center gap-2">
                  {selectedCarIds.size > 0 && (
                    <Button size="sm" onClick={handleAddSelectedVehicles}>
                      <Plus className="h-4 w-4 mr-1" /> Add {selectedCarIds.size} Selected
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => { setShowVehicleSelect(false); setSelectedCarIds(new Set()); setVehicleSearch(''); setMinSeats(''); }}>Cancel</Button>
                </div>
              </div>
              
              {/* Search bar and filters */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search by vehicle number or model..." 
                    value={vehicleSearch} 
                    onChange={e => setVehicleSearch(e.target.value)} 
                    className="pl-9"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground whitespace-nowrap">Min Seats:</Label>
                  <Select value={minSeats === '' ? 'any' : minSeats.toString()} onValueChange={v => setMinSeats(v === 'any' ? '' : parseInt(v))}>
                    <SelectTrigger className="w-20 h-9">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="4">4+</SelectItem>
                      <SelectItem value="5">5+</SelectItem>
                      <SelectItem value="6">6+</SelectItem>
                      <SelectItem value="7">7+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Sort options */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Sort by:</span>
                <Button variant={sortBy === 'vehicle_number' ? 'secondary' : 'ghost'} size="sm" className="h-7 text-xs" onClick={() => toggleSortBy('vehicle_number')}>
                  Number {sortBy === 'vehicle_number' && <ArrowUpDown className="h-3 w-3 ml-1" />}
                </Button>
                <Button variant={sortBy === 'model' ? 'secondary' : 'ghost'} size="sm" className="h-7 text-xs" onClick={() => toggleSortBy('model')}>
                  Model {sortBy === 'model' && <ArrowUpDown className="h-3 w-3 ml-1" />}
                </Button>
                <Button variant={sortBy === 'seats' ? 'secondary' : 'ghost'} size="sm" className="h-7 text-xs" onClick={() => toggleSortBy('seats')}>
                  Seats {sortBy === 'seats' && <ArrowUpDown className="h-3 w-3 ml-1" />}
                </Button>
              </div>
              
              {loadingCars ? (
                <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
              ) : availableForSelection.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
                  {availableForSelection.map(car => {
                    const isSelected = selectedCarIds.has(car.car_id);
                    const seats = (car as any).seats || 5;
                    return (
                      <div 
                        key={car.car_id} 
                        className={cn(
                          "flex items-center gap-3 p-2 border rounded bg-background hover:bg-muted/50 cursor-pointer transition-colors",
                          isSelected && "border-primary bg-primary/5"
                        )} 
                        onClick={() => toggleCarSelection(car.car_id)}
                      >
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleCarSelection(car.car_id)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{car.vehicle_number}</span>
                            <span className="inline-flex items-center gap-0.5 text-xs bg-muted px-1.5 py-0.5 rounded">
                              <Users className="h-3 w-3" /> {seats}
                            </span>
                          </div>
                          <span className="text-sm text-muted-foreground truncate block">{car.model}</span>
                        </div>
                        <Check className={cn("h-4 w-4 text-success", !isSelected && "opacity-0")} />
                      </div>
                    );
                  })}
                </div>
              ) : vehicleSearch ? (
                <p className="text-sm text-muted-foreground">No vehicles match "{vehicleSearch}"</p>
              ) : (
                <p className="text-sm text-muted-foreground">No available vehicles for selected dates</p>
              )}
              {unavailableCars.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Unavailable ({unavailableCars.length}):</p>
                  <div className="max-h-[100px] overflow-y-auto space-y-1">
                    {unavailableCars.map(car => (
                      <div key={car.car_id} className="flex items-center gap-2 text-sm text-destructive">
                        <X className="h-3 w-3 flex-shrink-0" />
                        <span>{car.vehicle_number}</span>
                        <span className="text-xs truncate">- {car.conflict_booking_ref} ({car.conflict_booked_by})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Selected vehicles */}
          {selectedVehicles.map(vehicle => (
            <div key={vehicle.car_id} className="p-4 border rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">{vehicle.vehicle_number}</span>
                  <span className="inline-flex items-center gap-0.5 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                    <Users className="h-3 w-3" /> {vehicle.seats}
                  </span>
                  <span className="text-sm text-muted-foreground">• {vehicle.model}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleRemoveVehicle(vehicle.car_id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Driver Name</Label>
                  <Input value={vehicle.driver_name} onChange={e => updateVehicle(vehicle.car_id, 'driver_name', e.target.value)} placeholder="Optional" className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Driver Phone</Label>
                  <Input value={vehicle.driver_phone} onChange={e => updateVehicle(vehicle.car_id, 'driver_phone', e.target.value)} placeholder="Optional" className="h-8 text-sm" />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Rate Type</Label>
                  <Select value={vehicle.rate_type} onValueChange={v => updateVehicle(vehicle.car_id, 'rate_type', v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(RATE_TYPE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {vehicle.rate_type === 'total' && (
                  <div className="space-y-1">
                    <Label className="text-xs">Total Amount (₹)</Label>
                    <Input type="number" value={vehicle.rate_total} onChange={e => updateVehicle(vehicle.car_id, 'rate_total', e.target.value)} placeholder="0" className="h-8 text-sm" />
                  </div>
                )}
                {['per_day', 'hybrid'].includes(vehicle.rate_type) && (
                  <div className="space-y-1">
                    <Label className="text-xs">Rate/Day (₹)</Label>
                    <Input type="number" value={vehicle.rate_per_day} onChange={e => updateVehicle(vehicle.car_id, 'rate_per_day', e.target.value)} placeholder="0" className="h-8 text-sm" />
                  </div>
                )}
                {['per_km', 'hybrid'].includes(vehicle.rate_type) && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs">Rate/KM (₹)</Label>
                      <Input type="number" value={vehicle.rate_per_km} onChange={e => updateVehicle(vehicle.car_id, 'rate_per_km', e.target.value)} placeholder="0" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Est. KM *</Label>
                      <Input type="number" value={vehicle.estimated_km} onChange={e => updateVehicle(vehicle.car_id, 'estimated_km', e.target.value)} placeholder="0" className="h-8 text-sm" />
                    </div>
                  </>
                )}
                <div className="space-y-1">
                  <Label className="text-xs">Advance (₹)</Label>
                  <Input type="number" value={vehicle.advance_amount} onChange={e => updateVehicle(vehicle.car_id, 'advance_amount', e.target.value)} placeholder="0" className="h-8 text-sm" />
                </div>
              </div>

              <div className="flex justify-end text-sm">
                <span className="text-muted-foreground mr-2">Computed Total:</span>
                <span className="font-semibold">{formatCurrency(calculateVehicleTotal(vehicle))}</span>
              </div>
            </div>
          ))}

          {selectedVehicles.length === 0 && !showVehicleSelect && (
            <p className="text-center text-muted-foreground py-8">No vehicles assigned. Click "Add Vehicle" to assign.</p>
          )}
        </CardContent>
      </Card>

      {/* Quote Summary */}
      {selectedVehicles.length > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">Quote Summary</p>
                <p className="text-2xl font-bold">{formatCurrency(grandTotal)}</p>
                <p className="text-sm text-success">Advance: {formatCurrency(totalAdvance)} | Due: {formatCurrency(grandTotal - totalAdvance)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Select value={status} onValueChange={v => setStatus(v as BookingStatus)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Save as..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inquiry">Save as Inquiry</SelectItem>
                <SelectItem value="tentative">Hold (Tentative - 2hr)</SelectItem>
                <SelectItem value="confirmed">Confirm Booking</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => navigate('/bookings/calendar')}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Booking
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
