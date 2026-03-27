import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { DEFAULT_ORG_LOGO_URL } from '@/lib/constants';
import { MAX_DOCUMENT_FILE_SIZE_BYTES } from '@/lib/document-upload';
import { useSettingsLeave } from '@/lib/settings-leave-context';
import { useServiceRules, useCreateServiceRule, useBrandsWithRules, useCopyServiceRules, useApplyRulesToBrands } from '@/hooks/use-services';
import { useBrands, useCreateBrand } from '@/hooks/use-brands';
import { RuleNameAutocomplete } from '@/components/settings/RuleNameAutocomplete';
import { useSystemConfig, useUpdateSystemConfig } from '@/hooks/use-dashboard';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { Settings as SettingsIcon, Plus, Wrench, Loader2, AlertCircle, Shield, Gauge, Copy, Layers, Building2, ImageIcon, Car, Users, Calendar, FileText, PauseCircle, Fuel } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useOrg } from '@/hooks/use-org';
import { useOrganizationSettings, useUpdateOrganizationSettings, type OcrTier } from '@/hooks/use-organization-settings';
import { useUpdateOrganization } from '@/hooks/use-organization';
import { useIsMasterAdmin } from '@/hooks/use-is-master-admin';
import { useLogoDisplayUrl } from '@/hooks/use-logo-display-url';
import { storageUpload } from '@/lib/storage';
import { organizationLogoKey } from '@/lib/storage-keys';
import { compressImageIfWithinLimit } from '@/lib/compress-image';
import { FleetFormConfigCard } from '@/components/settings/FleetFormConfigCard';
import { DriverFormConfigCard } from '@/components/settings/DriverFormConfigCard';
import { BookingFormConfigCard } from '@/components/settings/BookingFormConfigCard';
import { BillingLayoutConfigCard } from '@/components/settings/BillingLayoutConfigCard';
import { ServiceRecordFormConfigCard } from '@/components/settings/ServiceRecordFormConfigCard';
import { DowntimeFormConfigCard } from '@/components/settings/DowntimeFormConfigCard';
import { IncidentFormConfigCard } from '@/components/settings/IncidentFormConfigCard';
import { FuelEntryFormConfigCard } from '@/components/settings/FuelEntryFormConfigCard';
import { ChallanTypesCard } from '@/components/settings/ChallanTypesCard';

type BulkRuleRow = {
  id: string;
  name: string;
  interval_km: string;
  interval_days: string;
  is_critical: boolean;
  due_soon_threshold_km: string;
  due_soon_threshold_days: string;
};

const COMMON_SERVICE_RULE_NAMES = [
  'Engine Oil + Filter',
  'Air Filter',
  'AC Service',
  'Brake Pad Inspection',
  'Coolant Flush',
  'Wheel Alignment',
  'Battery Check',
  'Tyre Rotation',
  'General Service',
];

export default function Settings() {
  const { isAdmin, organization, refreshUser } = useAuth();
  const { isMasterAdmin } = useIsMasterAdmin();
  const { orgId } = useOrg();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const leaveContext = useSettingsLeave();
  const { data: org } = useQuery({
    queryKey: ['organization', orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data } = await supabase.from('organizations').select('join_code, name, logo_url, company_name').eq('id', orgId).single();
      return data;
    },
    enabled: !!orgId,
  });
  const { data: orgSettings } = useOrganizationSettings();
  const updateOrg = useUpdateOrganization();
  const updateOrgSettings = useUpdateOrganizationSettings();
  const logoDisplayUrl = useLogoDisplayUrl(org?.logo_url ?? organization?.logo_url ?? null);
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [billPrefix, setBillPrefix] = useState('PT');
  const [ocrTier, setOcrTier] = useState<OcrTier>('basic');
  useEffect(() => {
    const name = org?.company_name ?? organization?.company_name ?? '';
    if (name !== '') setCompanyName(name);
  }, [org?.company_name, organization?.company_name]);
  useEffect(() => {
    if (orgSettings?.terms_and_conditions != null) setTermsAndConditions(orgSettings.terms_and_conditions);
  }, [orgSettings?.terms_and_conditions]);
  useEffect(() => {
    if (orgSettings?.bill_number_prefix != null) setBillPrefix(orgSettings.bill_number_prefix);
  }, [orgSettings?.bill_number_prefix]);
  useEffect(() => {
    setOcrTier((orgSettings?.ocr_tier as OcrTier | null) ?? 'basic');
  }, [orgSettings?.ocr_tier]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !orgId) return;
    setLogoUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const key = organizationLogoKey(orgId, `${Date.now()}.${ext}`);
      const uploadFile = await compressImageIfWithinLimit(file, MAX_DOCUMENT_FILE_SIZE_BYTES);
      if (uploadFile.size > MAX_DOCUMENT_FILE_SIZE_BYTES) {
        toast({ title: 'File too large', description: `Logo must be 2 MB or smaller (${(file.size / 1024 / 1024).toFixed(2)} MB).`, variant: 'destructive' });
        return;
      }
      await storageUpload(key, uploadFile);
      const { data: updated, error: updateError } = await supabase
        .from('organizations')
        .update({ logo_url: key })
        .eq('id', orgId)
        .select('id')
        .single();
      if (updateError) throw updateError;
      if (!updated) {
        toast({ title: 'Logo upload failed', description: 'Could not update organization. You may need admin rights.', variant: 'destructive' });
        setLogoUploading(false);
        e.target.value = '';
        return;
      }
      await queryClient.refetchQueries({ queryKey: ['organization', orgId] });
      await refreshUser();
      toast({ title: 'Logo updated' });
    } catch (err: any) {
      toast({ title: 'Logo upload failed', description: err?.message, variant: 'destructive' });
    } finally {
      setLogoUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveLogo = async () => {
    if (!orgId) return;
    setLogoUploading(true);
    try {
      const { error } = await supabase.from('organizations').update({ logo_url: null }).eq('id', orgId).select('id').single();
      if (error) throw error;
      await queryClient.refetchQueries({ queryKey: ['organization', orgId] });
      await refreshUser();
      toast({ title: 'Logo removed' });
    } catch (err: any) {
      toast({ title: 'Failed to remove logo', description: err?.message, variant: 'destructive' });
    } finally {
      setLogoUploading(false);
    }
  };

  const handleSaveBranding = async () => {
    setBrandingSaving(true);
    try {
      await updateOrg.mutateAsync({ company_name: companyName.trim() || null });
      await updateOrgSettings.mutateAsync({
        terms_and_conditions: termsAndConditions.trim() || null,
      });
      await queryClient.refetchQueries({ queryKey: ['organization', orgId] });
      await refreshUser();
      toast({ title: 'Branding saved' });
    } catch (err: any) {
      toast({ title: 'Failed to save branding', description: err?.message, variant: 'destructive' });
    } finally {
      setBrandingSaving(false);
    }
  };

  const handleSaveBillPrefix = async () => {
    setBrandingSaving(true);
    try {
      await updateOrgSettings.mutateAsync({
        bill_number_prefix: (billPrefix || 'PT').trim().toUpperCase().slice(0, 20),
      });
      toast({ title: 'Bill number prefix saved' });
    } catch (err: any) {
      toast({ title: 'Failed to save', description: err?.message, variant: 'destructive' });
    } finally {
      setBrandingSaving(false);
    }
  };

  const handleSaveOcrTier = async () => {
    setBrandingSaving(true);
    try {
      await updateOrgSettings.mutateAsync({
        ocr_tier: ocrTier,
      });
      toast({ title: 'OCR plan tier saved' });
    } catch (err: any) {
      toast({ title: 'Failed to save OCR tier', description: err?.message, variant: 'destructive' });
    } finally {
      setBrandingSaving(false);
    }
  };

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

  // Snapshot of last-saved values so dirty state resets correctly after saving
  const [minKmSavedSnapshot, setMinKmSavedSnapshot] = useState({
    per_km: '100',
    hybrid_per_day: '100',
  });

  // Update local state and snapshot when config loads/refetches
  useEffect(() => {
    const perValue =
      minKmPerKm !== undefined && minKmPerKm !== null
        ? typeof minKmPerKm === 'string'
          ? minKmPerKm
          : String(minKmPerKm)
        : null;
    const hybridValue =
      minKmHybridPerDay !== undefined && minKmHybridPerDay !== null
        ? typeof minKmHybridPerDay === 'string'
          ? minKmHybridPerDay
          : String(minKmHybridPerDay)
        : null;

    if (perValue !== null || hybridValue !== null) {
      setMinKmSettings((prev) => ({
        per_km: perValue ?? prev.per_km,
        hybrid_per_day: hybridValue ?? prev.hybrid_per_day,
      }));
      setMinKmSavedSnapshot((prev) => ({
        per_km: perValue ?? prev.per_km,
        hybrid_per_day: hybridValue ?? prev.hybrid_per_day,
      }));
    }
  }, [minKmPerKm, minKmHybridPerDay]);

  // Track unsaved changes for leave prompt (branding, bill prefix, min km, form config cards)
  const brandingDirty = useMemo(() => {
    const initialName = org?.company_name ?? organization?.company_name ?? '';
    const initialTerms = orgSettings?.terms_and_conditions ?? '';
    return companyName !== initialName || termsAndConditions !== initialTerms;
  }, [companyName, termsAndConditions, org?.company_name, organization?.company_name, orgSettings?.terms_and_conditions]);
  const billPrefixDirty = useMemo(
    () => billPrefix !== (orgSettings?.bill_number_prefix ?? 'PT'),
    [billPrefix, orgSettings?.bill_number_prefix]
  );
  const minKmDirty = useMemo(
    () =>
      minKmSettings.per_km !== minKmSavedSnapshot.per_km ||
      minKmSettings.hybrid_per_day !== minKmSavedSnapshot.hybrid_per_day,
    [minKmSettings.per_km, minKmSettings.hybrid_per_day, minKmSavedSnapshot.per_km, minKmSavedSnapshot.hybrid_per_day]
  );
  const [dirtyCardIds, setDirtyCardIds] = useState<Set<string>>(new Set());
  const registerCardDirty = useCallback((cardId: string, dirty: boolean) => {
    setDirtyCardIds((prev) => {
      const next = new Set(prev);
      if (dirty) next.add(cardId);
      else next.delete(cardId);
      return next;
    });
  }, []);
  const hasUnsavedChanges = brandingDirty || billPrefixDirty || minKmDirty || dirtyCardIds.size > 0;

  useEffect(() => {
    if (!leaveContext) return;
    leaveContext.setHasUnsavedChanges(hasUnsavedChanges);
    return () => leaveContext.setHasUnsavedChanges(false);
  }, [hasUnsavedChanges, leaveContext]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsavedChanges]);

  // Set first brand as selected by default
  useEffect(() => {
    if (brandsWithRules.length > 0 && !selectedBrand) {
      setSelectedBrand(brandsWithRules[0]);
    }
  }, [brandsWithRules, selectedBrand]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
  const [isApplyDialogOpen, setIsApplyDialogOpen] = useState(false);
  const [bulkStep, setBulkStep] = useState<1 | 2>(1);
  const [bulkBrand, setBulkBrand] = useState('');
  const [bulkSelectedStarters, setBulkSelectedStarters] = useState<string[]>([]);
  const [bulkRows, setBulkRows] = useState<BulkRuleRow[]>([]);
  const [bulkError, setBulkError] = useState('');
  const [bulkRowErrors, setBulkRowErrors] = useState<Record<string, string>>({});
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
  const starterRuleNames = useMemo(() => {
    const existing = Array.from(new Set((serviceRules ?? []).map((r) => r.name).filter(Boolean)));
    return Array.from(new Set([...COMMON_SERVICE_RULE_NAMES, ...existing])).sort((a, b) => a.localeCompare(b));
  }, [serviceRules]);

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

  const createEmptyBulkRow = (): BulkRuleRow => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: '',
    interval_km: '',
    interval_days: '',
    is_critical: false,
    due_soon_threshold_km: '500',
    due_soon_threshold_days: '7',
  });

  const openBulkDialog = () => {
    setBulkStep(1);
    setBulkBrand(selectedBrand || allBrands[0] || '');
    setBulkSelectedStarters([]);
    setBulkRows([]);
    setBulkError('');
    setBulkRowErrors({});
    setIsBulkDialogOpen(true);
  };

  const handleStartBulkGrid = () => {
    if (!bulkBrand.trim()) {
      setBulkError('Please select a brand');
      return;
    }
    const rows =
      bulkSelectedStarters.length > 0
        ? bulkSelectedStarters.map((name) => ({
            ...createEmptyBulkRow(),
            name,
          }))
        : [createEmptyBulkRow()];
    setBulkRows(rows);
    setBulkError('');
    setBulkStep(2);
  };

  const updateBulkRow = (id: string, patch: Partial<BulkRuleRow>) => {
    setBulkRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    setBulkRowErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const validateBulkRows = () => {
    const rowErrors: Record<string, string> = {};
    for (const row of bulkRows) {
      if (!row.name.trim()) {
        rowErrors[row.id] = 'Rule name is required';
        continue;
      }
      if (!row.interval_km.trim() && !row.interval_days.trim()) {
        rowErrors[row.id] = 'Add at least one interval (km or days)';
        continue;
      }
      if (
        row.interval_km.trim() &&
        (!Number.isFinite(Number(row.interval_km)) || Number(row.interval_km) <= 0)
      ) {
        rowErrors[row.id] = 'Interval km must be a positive number';
        continue;
      }
      if (
        row.interval_days.trim() &&
        (!Number.isFinite(Number(row.interval_days)) || Number(row.interval_days) <= 0)
      ) {
        rowErrors[row.id] = 'Interval days must be a positive number';
      }
    }
    setBulkRowErrors(rowErrors);
    return Object.keys(rowErrors).length === 0;
  };

  const handleBulkCreateRules = async () => {
    setBulkError('');
    if (!bulkBrand.trim()) {
      setBulkError('Please select a brand');
      return;
    }
    if (bulkRows.length === 0) {
      setBulkError('Add at least one rule row');
      return;
    }
    if (!validateBulkRows()) {
      setBulkError('Please fix row errors before creating rules.');
      return;
    }

    try {
      for (const row of bulkRows) {
        await createRule.mutateAsync({
          name: row.name.trim(),
          brand: bulkBrand.trim(),
          interval_km: row.interval_km ? parseInt(row.interval_km, 10) : undefined,
          interval_days: row.interval_days ? parseInt(row.interval_days, 10) : undefined,
          is_critical: row.is_critical,
          due_soon_threshold_km: parseInt(row.due_soon_threshold_km, 10) || 500,
          due_soon_threshold_days: parseInt(row.due_soon_threshold_days, 10) || 7,
        });
      }

      await queryClient.invalidateQueries({ queryKey: ['service-rules'] });
      await queryClient.invalidateQueries({ queryKey: ['brands-with-rules'] });
      setSelectedBrand(bulkBrand);
      setIsBulkDialogOpen(false);
      setBulkStep(1);
      setBulkRows([]);
      setBulkSelectedStarters([]);
      toast({
        title: 'Rules created',
        description: `Created ${bulkRows.length} rules for ${bulkBrand}.`,
      });
    } catch (error: any) {
      setBulkError(error?.message ?? 'Failed to create one or more rules.');
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
      // Mark current values as the new "saved" baseline so the leave prompt
      // stops showing until the user makes further edits.
      setMinKmSavedSnapshot({
        per_km: minKmSettings.per_km,
        hybrid_per_day: minKmSettings.hybrid_per_day,
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

      <Tabs defaultValue="branding" className="space-y-6">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1">
          <TabsTrigger value="branding" className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            Branding
          </TabsTrigger>
          <TabsTrigger value="fleet" className="flex items-center gap-2">
            <Car className="h-4 w-4" />
            Fleet
          </TabsTrigger>
          <TabsTrigger value="fuel" className="flex items-center gap-2">
            <Fuel className="h-4 w-4" />
            Fuel
          </TabsTrigger>
          <TabsTrigger value="drivers" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Drivers
          </TabsTrigger>
          <TabsTrigger value="bookings" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Bookings
          </TabsTrigger>
          <TabsTrigger value="billings" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Billings
          </TabsTrigger>
          <TabsTrigger value="service" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Service & system
          </TabsTrigger>
          <TabsTrigger value="incidents-downtime" className="flex items-center gap-2">
            <PauseCircle className="h-4 w-4" />
            Incidents & Downtime
          </TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="space-y-6 mt-6">
          {isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  Branding
                </CardTitle>
                <CardDescription>
                  Logo, company name, and terms & conditions used on bills and invoices.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Organization logo</Label>
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-24 border rounded flex items-center justify-center bg-muted/50 overflow-hidden shrink-0">
                      {(org?.logo_url ?? organization?.logo_url) ? (
                        <img
                          src={logoDisplayUrl ?? DEFAULT_ORG_LOGO_URL}
                          alt="Logo"
                          className="h-14 w-20 object-contain"
                          onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_ORG_LOGO_URL; }}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">No logo</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={logoUploading}
                          onClick={() => document.getElementById('settings-logo-input')?.click()}
                        >
                          {logoUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Choose image'}
                        </Button>
                        <Input
                          id="settings-logo-input"
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          disabled={logoUploading}
                          className="hidden"
                        />
                      </div>
                      {(org?.logo_url ?? organization?.logo_url) && (
                        <Button type="button" variant="outline" size="sm" onClick={handleRemoveLogo} disabled={logoUploading}>
                          {logoUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Remove logo'}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company name (legal)</Label>
                  <Input
                    id="company_name"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. PATIDAR TRAVELS PVT. LTD."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="terms">Terms & conditions</Label>
                  <Textarea
                    id="terms"
                    value={termsAndConditions}
                    onChange={(e) => setTermsAndConditions(e.target.value)}
                    placeholder="Paste your terms and conditions (shown on bills and invoices)."
                    rows={6}
                    className="resize-y"
                  />
                </div>
                <Button onClick={handleSaveBranding} disabled={brandingSaving} data-settings-save>
                  {brandingSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save branding
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="fleet" className="space-y-6 mt-6">
          <FleetFormConfigCard onDirtyChange={(dirty) => registerCardDirty('fleet', dirty)} />
        </TabsContent>

        <TabsContent value="fuel" className="space-y-6 mt-6">
          <FuelEntryFormConfigCard onDirtyChange={(dirty) => registerCardDirty('fuel', dirty)} />
        </TabsContent>

        <TabsContent value="drivers" className="space-y-6 mt-6">
          <DriverFormConfigCard onDirtyChange={(dirty) => registerCardDirty('drivers', dirty)} />
        </TabsContent>

        <TabsContent value="bookings" className="space-y-6 mt-6">
          <BookingFormConfigCard onDirtyChange={(dirty) => registerCardDirty('bookings', dirty)} />
        </TabsContent>

        <TabsContent value="billings" className="space-y-6 mt-6">
          {isAdmin && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Bill number
                  </CardTitle>
                  <CardDescription>
                    Prefix for customer and company bill numbers (e.g. PT → PT-BILL-2025-000001, PT-CB-2025-000001).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="bill_prefix_billings">Bill number prefix</Label>
                    <Input
                      id="bill_prefix_billings"
                      value={billPrefix}
                      onChange={(e) => setBillPrefix(e.target.value.toUpperCase())}
                      placeholder="PT"
                      maxLength={20}
                      className="w-24 font-mono"
                    />
                  </div>
                  <Button onClick={handleSaveBillPrefix} disabled={brandingSaving} data-settings-save>
                    {brandingSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Save prefix
                  </Button>
                </CardContent>
              </Card>
              <BillingLayoutConfigCard onDirtyChange={(dirty) => registerCardDirty('billings', dirty)} />
            </>
          )}
        </TabsContent>

        <TabsContent value="service" className="space-y-6 mt-6">
          {isMasterAdmin && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  OCR plan tier
                </CardTitle>
                <CardDescription>
                  Controls service-record OCR capability: Basic (no OCR), Plus (limited OCR), Pro (full OCR).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 max-w-xs">
                  <Label htmlFor="ocr-tier">OCR tier</Label>
                  <Select value={ocrTier} onValueChange={(v) => setOcrTier(v as OcrTier)}>
                    <SelectTrigger id="ocr-tier">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">Basic - No OCR</SelectItem>
                      <SelectItem value="plus">Plus - Limited OCR</SelectItem>
                      <SelectItem value="pro">Pro - Full OCR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSaveOcrTier} disabled={brandingSaving} data-settings-save>
                    {brandingSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Save OCR tier
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

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
                <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
                  <Button variant="outline" onClick={openBulkDialog}>
                    <Layers className="h-4 w-4 mr-2" />
                    Add Rules in Bulk
                  </Button>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                      <DialogTitle>Add Rules in Bulk</DialogTitle>
                      <DialogDescription>
                        {bulkStep === 1
                          ? 'Step 1: choose brand and starter rules'
                          : `Step 2: edit rows and create ${bulkRows.length} rule(s) for ${bulkBrand || 'selected brand'}`}
                      </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto pr-1 space-y-4">
                      {bulkStep === 1 ? (
                        <>
                          <div className="space-y-2">
                            <Label>Brand *</Label>
                            <Select value={bulkBrand} onValueChange={setBulkBrand}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select brand" />
                              </SelectTrigger>
                              <SelectContent>
                                {allBrands.map((brand) => (
                                  <SelectItem key={brand} value={brand}>
                                    {brand}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Starter Rules (optional)</Label>
                            <p className="text-xs text-muted-foreground">
                              Select as many as you want. You can edit everything in next step.
                            </p>
                            <div className="border rounded-md p-2 max-h-64 overflow-y-auto">
                              {starterRuleNames.map((name) => {
                                const checked = bulkSelectedStarters.includes(name);
                                return (
                                  <label
                                    key={name}
                                    className="flex items-center gap-2 p-2 rounded hover:bg-accent cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setBulkSelectedStarters((prev) => [...prev, name]);
                                        } else {
                                          setBulkSelectedStarters((prev) => prev.filter((r) => r !== name));
                                        }
                                      }}
                                    />
                                    <span>{name}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between">
                            <Label>Rules for {bulkBrand}</Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setBulkRows((prev) => [...prev, createEmptyBulkRow()])}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add Row
                            </Button>
                          </div>
                          <div className="space-y-3">
                            {bulkRows.map((row, idx) => (
                              <div key={row.id} className="border rounded-md p-3 space-y-3">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-medium">Rule #{idx + 1}</p>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setBulkRows((prev) => prev.filter((r) => r.id !== row.id))}
                                  >
                                    Remove
                                  </Button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <Label className="text-xs">Rule name *</Label>
                                    <Input
                                      value={row.name}
                                      onChange={(e) => updateBulkRow(row.id, { name: e.target.value })}
                                      placeholder="e.g., Engine Oil + Filter"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Type</Label>
                                    <div className="flex items-center gap-2 pt-2">
                                      <Switch
                                        checked={row.is_critical}
                                        onCheckedChange={(checked) => updateBulkRow(row.id, { is_critical: checked })}
                                      />
                                      <span className="text-sm">{row.is_critical ? 'Critical' : 'Normal'}</span>
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Interval (km)</Label>
                                    <Input
                                      type="number"
                                      value={row.interval_km}
                                      onChange={(e) => updateBulkRow(row.id, { interval_km: e.target.value })}
                                      placeholder="10000"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Interval (days)</Label>
                                    <Input
                                      type="number"
                                      value={row.interval_days}
                                      onChange={(e) => updateBulkRow(row.id, { interval_days: e.target.value })}
                                      placeholder="180"
                                    />
                                  </div>
                                  {row.is_critical && (
                                    <>
                                      <div className="space-y-1">
                                        <Label className="text-xs">Due Soon Threshold (km)</Label>
                                        <Input
                                          type="number"
                                          value={row.due_soon_threshold_km}
                                          onChange={(e) => updateBulkRow(row.id, { due_soon_threshold_km: e.target.value })}
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs">Due Soon Threshold (days)</Label>
                                        <Input
                                          type="number"
                                          value={row.due_soon_threshold_days}
                                          onChange={(e) => updateBulkRow(row.id, { due_soon_threshold_days: e.target.value })}
                                        />
                                      </div>
                                    </>
                                  )}
                                </div>
                                {bulkRowErrors[row.id] ? (
                                  <p className="text-sm text-destructive">{bulkRowErrors[row.id]}</p>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                      {bulkError ? <p className="text-sm text-destructive">{bulkError}</p> : null}
                    </div>

                    <DialogFooter>
                      {bulkStep === 2 ? (
                        <Button type="button" variant="outline" onClick={() => setBulkStep(1)}>
                          Back
                        </Button>
                      ) : null}
                      <Button type="button" variant="outline" onClick={() => setIsBulkDialogOpen(false)}>
                        Cancel
                      </Button>
                      {bulkStep === 1 ? (
                        <Button type="button" onClick={handleStartBulkGrid}>
                          Next
                        </Button>
                      ) : (
                        <Button type="button" onClick={handleBulkCreateRules} disabled={createRule.isPending}>
                          {createRule.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Create {bulkRows.length} Rule{bulkRows.length === 1 ? '' : 's'}
                        </Button>
                      )}
                    </DialogFooter>
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
                  <Button variant="outline" onClick={openBulkDialog}>
                    <Layers className="h-4 w-4 mr-2" />
                    Start with Bulk Setup
                  </Button>
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
                  data-settings-save
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

          {isAdmin && <ServiceRecordFormConfigCard onDirtyChange={(dirty) => registerCardDirty('service', dirty)} />}
        </TabsContent>

        <TabsContent value="incidents-downtime" className="space-y-6 mt-6">
          {isAdmin && (
            <>
              <DowntimeFormConfigCard onDirtyChange={(dirty) => registerCardDirty('downtime', dirty)} />
              <IncidentFormConfigCard onDirtyChange={(dirty) => registerCardDirty('incident', dirty)} />
              <ChallanTypesCard />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
