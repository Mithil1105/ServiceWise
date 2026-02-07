import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { useServiceRules, useCreateServiceRule, useBrandsWithRules, useCopyServiceRules, useApplyRulesToBrands } from '@/hooks/use-services';
import { useBrands, useCreateBrand } from '@/hooks/use-brands';
import { RuleNameAutocomplete } from '@/components/settings/RuleNameAutocomplete';
import { useSystemConfig, useUpdateSystemConfig } from '@/hooks/use-dashboard';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Settings as SettingsIcon, Plus, Wrench, Loader2, AlertCircle, Shield, Gauge, Copy, Layers } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useOrg } from '@/hooks/use-org';
import { Building2 } from 'lucide-react';

export default function Settings() {
  const { isAdmin } = useAuth();
  const { orgId } = useOrg();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: org } = useQuery({
    queryKey: ['organization', orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data } = await supabase.from('organizations').select('join_code, name').eq('id', orgId).single();
      return data;
    },
    enabled: !!orgId,
  });
  
  // Brand management
  const { data: brandsWithRules = [] } = useBrandsWithRules();
  const { data: allBrands = [] } = useBrands();
  const createBrand = useCreateBrand();
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [isAddBrandDialogOpen, setIsAddBrandDialogOpen] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  
  // Service rules for selected brand
  const { data: serviceRules = [], isLoading } = useServiceRules(selectedBrand || undefined);
  const createRule = useCreateServiceRule();
  const copyRules = useCopyServiceRules();
  const applyRulesToBrands = useApplyRulesToBrands();
  
  // Minimum KM thresholds
  const { data: minKmPerKm } = useSystemConfig('minimum_km_per_km');
  const { data: minKmHybridPerDay } = useSystemConfig('minimum_km_hybrid_per_day');
  const updateSystemConfig = useUpdateSystemConfig();
  
  const [minKmSettings, setMinKmSettings] = useState({
    per_km: '100',
    hybrid_per_day: '100',
  });
  
  // Update local state when config loads
  useEffect(() => {
    if (minKmPerKm !== undefined && minKmPerKm !== null) {
      const value = typeof minKmPerKm === 'string' ? minKmPerKm : String(minKmPerKm);
      setMinKmSettings(prev => ({ ...prev, per_km: value }));
    }
    if (minKmHybridPerDay !== undefined && minKmHybridPerDay !== null) {
      const value = typeof minKmHybridPerDay === 'string' ? minKmHybridPerDay : String(minKmHybridPerDay);
      setMinKmSettings(prev => ({ ...prev, hybrid_per_day: value }));
    }
  }, [minKmPerKm, minKmHybridPerDay]);

  // Set first brand as selected by default
  useEffect(() => {
    if (brandsWithRules.length > 0 && !selectedBrand) {
      setSelectedBrand(brandsWithRules[0]);
    }
  }, [brandsWithRules, selectedBrand]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
  const [isApplyDialogOpen, setIsApplyDialogOpen] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    brand: '',
    interval_km: '',
    interval_days: '',
    is_critical: false,
    due_soon_threshold_km: '500',
    due_soon_threshold_days: '7',
  });
  const [copyFromBrand, setCopyFromBrand] = useState('');
  const [copyToBrand, setCopyToBrand] = useState('');
  const [applyFromBrand, setApplyFromBrand] = useState('');
  const [applyToBrands, setApplyToBrands] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Shield className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold mb-2">Admin Access Required</h2>
        <p className="text-muted-foreground mb-4">
          Only administrators can access settings.
        </p>
        <Button asChild>
          <Link to="/app">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!newRule.name.trim()) {
      setErrors({ name: 'Name is required' });
      return;
    }

    if (!newRule.brand.trim()) {
      setErrors({ brand: 'Brand is required' });
      return;
    }

    if (!newRule.interval_km && !newRule.interval_days) {
      setErrors({ interval: 'At least one interval (km or days) is required' });
      return;
    }

    try {
      await createRule.mutateAsync({
        name: newRule.name.trim(),
        brand: newRule.brand.trim(),
        interval_km: newRule.interval_km ? parseInt(newRule.interval_km) : undefined,
        interval_days: newRule.interval_days ? parseInt(newRule.interval_days) : undefined,
        is_critical: newRule.is_critical,
        due_soon_threshold_km: parseInt(newRule.due_soon_threshold_km) || 500,
        due_soon_threshold_days: parseInt(newRule.due_soon_threshold_days) || 7,
      });
      setIsDialogOpen(false);
      setNewRule({
        name: '',
        brand: selectedBrand || '',
        interval_km: '',
        interval_days: '',
        is_critical: false,
        due_soon_threshold_km: '500',
        due_soon_threshold_days: '7',
      });
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleCopyRules = async () => {
    if (!copyFromBrand || !copyToBrand) {
      toast({
        title: 'Error',
        description: 'Please select both source and target brands',
        variant: 'destructive',
      });
      return;
    }

    if (copyFromBrand === copyToBrand) {
      toast({
        title: 'Error',
        description: 'Source and target brands must be different',
        variant: 'destructive',
      });
      return;
    }

    try {
      await copyRules.mutateAsync({ fromBrand: copyFromBrand, toBrand: copyToBrand });
      setIsCopyDialogOpen(false);
      setCopyFromBrand('');
      setCopyToBrand('');
      if (copyToBrand === selectedBrand) {
        // Refresh rules if we copied to current brand
        queryClient.invalidateQueries({ queryKey: ['service-rules'] });
      }
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleApplyRulesToBrands = async () => {
    if (!applyFromBrand || applyToBrands.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select source brand and at least one target brand',
        variant: 'destructive',
      });
      return;
    }

    try {
      await applyRulesToBrands.mutateAsync({ fromBrand: applyFromBrand, toBrands: applyToBrands });
      setIsApplyDialogOpen(false);
      setApplyFromBrand('');
      setApplyToBrands([]);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleAddBrand = async () => {
    if (!newBrandName.trim()) {
      toast({
        title: 'Error',
        description: 'Brand name is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      const brandName = await createBrand.mutateAsync(newBrandName.trim());
      setNewRule({ ...newRule, brand: brandName });
      setIsAddBrandDialogOpen(false);
      setNewBrandName('');
      // Refresh brands list
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      queryClient.invalidateQueries({ queryKey: ['brands-with-rules'] });
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleToggleActive = async (ruleId: string, currentActive: boolean) => {
    const { error } = await supabase
      .from('service_rules')
      .update({ active: !currentActive })
      .eq('id', ruleId);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      queryClient.invalidateQueries({ queryKey: ['service-rules'] });
      toast({
        title: currentActive ? 'Rule disabled' : 'Rule enabled',
        description: `Service rule has been ${currentActive ? 'disabled' : 'enabled'}.`,
      });
    }
  };

  const handleSaveMinKmSettings = async () => {
    try {
      await updateSystemConfig.mutateAsync({
        key: 'minimum_km_per_km',
        value: minKmSettings.per_km,
      });
      await updateSystemConfig.mutateAsync({
        key: 'minimum_km_hybrid_per_day',
        value: minKmSettings.hybrid_per_day,
      });
      toast({
        title: 'Success',
        description: 'Minimum KM thresholds updated successfully',
      });
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <SettingsIcon className="h-6 w-6" />
            Settings
          </h1>
          <p className="text-muted-foreground">Manage service rules and system configuration</p>
        </div>
      </div>

      {/* Organization code (share with users who want to join) */}
      {org?.join_code && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Organization code
            </CardTitle>
            <CardDescription>
              Share this code with users so they can request to join your organization (e.g. SW-ABCD-1234).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <code className="rounded bg-muted px-3 py-2 font-mono text-lg">{org.join_code}</code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(org.join_code);
                toast({ title: 'Code copied to clipboard' });
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Service Rules */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Service Rules
            </CardTitle>
            <CardDescription>
              Define brand-specific service intervals and critical thresholds
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Dialog open={isCopyDialogOpen} onOpenChange={setIsCopyDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Rules
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Copy Service Rules</DialogTitle>
                  <DialogDescription>
                    Copy all service rules from one brand to another
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Copy From Brand</Label>
                    <Select value={copyFromBrand} onValueChange={setCopyFromBrand}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select source brand" />
                      </SelectTrigger>
                      <SelectContent>
                        {brandsWithRules.map(brand => (
                          <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Copy To Brand</Label>
                    <Select value={copyToBrand} onValueChange={setCopyToBrand}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select target brand" />
                      </SelectTrigger>
                      <SelectContent>
                        {allBrands.filter(b => b !== copyFromBrand).map(brand => (
                          <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCopyDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleCopyRules} disabled={copyRules.isPending}>
                    {copyRules.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Copy Rules
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={isApplyDialogOpen} onOpenChange={setIsApplyDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Layers className="h-4 w-4 mr-2" />
                  Apply to Multiple
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Apply Rules to Multiple Brands</DialogTitle>
                  <DialogDescription>
                    Copy service rules from one brand to multiple brands at once
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Copy From Brand</Label>
                    <Select value={applyFromBrand} onValueChange={setApplyFromBrand}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select source brand" />
                      </SelectTrigger>
                      <SelectContent>
                        {brandsWithRules.map(brand => (
                          <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Apply To Brands (select multiple)</Label>
                    <div className="border rounded-md p-2 max-h-48 overflow-y-auto">
                      {allBrands.filter(b => b !== applyFromBrand).map(brand => (
                        <label key={brand} className="flex items-center space-x-2 p-2 hover:bg-accent rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={applyToBrands.includes(brand)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setApplyToBrands([...applyToBrands, brand]);
                              } else {
                                setApplyToBrands(applyToBrands.filter(b => b !== brand));
                              }
                            }}
                            className="rounded"
                          />
                          <span>{brand}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsApplyDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleApplyRulesToBrands} disabled={applyRulesToBrands.isPending}>
                    {applyRulesToBrands.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Apply Rules
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Rule
                </Button>
              </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreateRule}>
                <DialogHeader>
                  <DialogTitle>Create Service Rule</DialogTitle>
                  <DialogDescription>
                    Add a new service rule that will be applied to vehicles
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="rule-brand">Brand *</Label>
                    <Select 
                      value={newRule.brand === '__add_new__' ? '' : newRule.brand} 
                      onValueChange={(value) => {
                        if (value === '__add_new__') {
                          setIsAddBrandDialogOpen(true);
                          // Don't update the brand value, keep it empty
                        } else {
                          setNewRule({ ...newRule, brand: value });
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select brand" />
                      </SelectTrigger>
                      <SelectContent>
                        {allBrands.map(brand => (
                          <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                        ))}
                        <SelectItem value="__add_new__" className="text-primary font-medium">
                          + Add New Brand
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.brand && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.brand}
                      </p>
                    )}
                  </div>
                  <RuleNameAutocomplete
                    ruleName={newRule.name}
                    onRuleNameChange={(name) => setNewRule({ ...newRule, name })}
                    required
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.name}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="interval-km">Interval (km)</Label>
                      <Input
                        id="interval-km"
                        type="number"
                        placeholder="e.g., 10000"
                        value={newRule.interval_km}
                        onChange={(e) => setNewRule({ ...newRule, interval_km: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="interval-days">Interval (days)</Label>
                      <Input
                        id="interval-days"
                        type="number"
                        placeholder="e.g., 180"
                        value={newRule.interval_days}
                        onChange={(e) => setNewRule({ ...newRule, interval_days: e.target.value })}
                      />
                    </div>
                  </div>
                  {errors.interval && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.interval}
                    </p>
                  )}

                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div>
                      <Label htmlFor="is-critical" className="font-medium">
                        Critical Service
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Shows popup alerts when due
                      </p>
                    </div>
                    <Switch
                      id="is-critical"
                      checked={newRule.is_critical}
                      onCheckedChange={(checked) =>
                        setNewRule({ ...newRule, is_critical: checked })
                      }
                    />
                  </div>

                  {newRule.is_critical && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="threshold-km">Due Soon Threshold (km)</Label>
                        <Input
                          id="threshold-km"
                          type="number"
                          value={newRule.due_soon_threshold_km}
                          onChange={(e) =>
                            setNewRule({ ...newRule, due_soon_threshold_km: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="threshold-days">Due Soon Threshold (days)</Label>
                        <Input
                          id="threshold-days"
                          type="number"
                          value={newRule.due_soon_threshold_days}
                          onChange={(e) =>
                            setNewRule({ ...newRule, due_soon_threshold_days: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createRule.isPending}>
                    {createRule.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Rule'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          
          {/* Add New Brand Dialog */}
          <Dialog open={isAddBrandDialogOpen} onOpenChange={setIsAddBrandDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Brand</DialogTitle>
                <DialogDescription>
                  Create a new brand that can be used for service rules
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="new-brand-name">Brand Name *</Label>
                  <Input
                    id="new-brand-name"
                    placeholder="e.g., BMW, Audi, Mercedes-Benz"
                    value={newBrandName}
                    onChange={(e) => setNewBrandName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddBrand();
                      }
                    }}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setIsAddBrandDialogOpen(false);
                  setNewBrandName('');
                }}>
                  Cancel
                </Button>
                <Button onClick={handleAddBrand} disabled={createBrand.isPending || !newBrandName.trim()}>
                  {createBrand.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Creating...
                    </>
                  ) : (
                    'Create Brand'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {brandsWithRules.length === 0 ? (
            <div className="text-center py-12">
              <Wrench className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">No brands with rules</h3>
              <p className="text-muted-foreground mb-4">
                Create service rules for a brand to get started
              </p>
            </div>
          ) : (
            <Tabs value={selectedBrand || ''} onValueChange={setSelectedBrand}>
              <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${brandsWithRules.length}, minmax(0, 1fr))` }}>
                {brandsWithRules.map(brand => (
                  <TabsTrigger key={brand} value={brand}>{brand}</TabsTrigger>
                ))}
              </TabsList>
              {brandsWithRules.map(brand => (
                <TabsContent key={brand} value={brand}>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : serviceRules && serviceRules.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Interval (km)</TableHead>
                          <TableHead>Interval (days)</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Threshold</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {serviceRules.map((rule) => (
                          <TableRow key={rule.id}>
                            <TableCell className="font-medium">{rule.name}</TableCell>
                            <TableCell>
                              {rule.interval_km ? `${rule.interval_km.toLocaleString()} km` : '-'}
                            </TableCell>
                            <TableCell>
                              {rule.interval_days ? `${rule.interval_days} days` : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={rule.is_critical ? 'error' : 'muted'}>
                                {rule.is_critical ? 'Critical' : 'Normal'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {rule.is_critical ? (
                                <span className="text-sm text-muted-foreground">
                                  {rule.due_soon_threshold_km} km / {rule.due_soon_threshold_days} days
                                </span>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={rule.active ? 'success' : 'muted'}>
                                {rule.active ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleActive(rule.id, rule.active)}
                              >
                                {rule.active ? 'Disable' : 'Enable'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-12">
                      <Wrench className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <h3 className="text-lg font-medium mb-2">No service rules for {brand}</h3>
                      <p className="text-muted-foreground mb-4">
                        Create service rules for this brand to get started
                      </p>
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Minimum KM Thresholds */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            Minimum KM Thresholds
          </CardTitle>
          <CardDescription>
            Set default minimum KM charges for booking rates (applies to all bookings)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="min-km-per-km">Minimum KM for Per KM Rate</Label>
              <Input
                id="min-km-per-km"
                type="number"
                value={minKmSettings.per_km}
                onChange={(e) => setMinKmSettings({ ...minKmSettings, per_km: e.target.value })}
                placeholder="100"
                min="0"
              />
              <p className="text-sm text-muted-foreground">
                Minimum KM to charge when rate type is "Per KM". If estimated KM is less than this, this value will be charged.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="min-km-hybrid">Minimum KM per Day for Hybrid Rate</Label>
              <Input
                id="min-km-hybrid"
                type="number"
                value={minKmSettings.hybrid_per_day}
                onChange={(e) => setMinKmSettings({ ...minKmSettings, hybrid_per_day: e.target.value })}
                placeholder="100"
                min="0"
              />
              <p className="text-sm text-muted-foreground">
                Minimum KM per day for "Hybrid" rate type. Total minimum = (this value × number of days). If estimated KM is less, this minimum will be charged.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <Button 
              onClick={handleSaveMinKmSettings}
              disabled={updateSystemConfig.isPending}
            >
              {updateSystemConfig.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Thresholds'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
