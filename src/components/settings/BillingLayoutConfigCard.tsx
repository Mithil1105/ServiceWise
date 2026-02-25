import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, FileText, Plus, Trash2, GripVertical } from 'lucide-react';
import { useOrganizationSettings, useUpdateOrganizationSettings } from '@/hooks/use-organization-settings';
import {
  type BillingLayoutConfig,
  type BillingBuiltInSectionKey,
  type BillingCustomBlock,
  type BillingSectionOverride,
  type BillingCustomBlockType,
  type BillingCustomBlockPosition,
  type BillingCustomBlockValueSource,
  type BillingExtraChargeConfig,
  BILLING_SECTION_LABELS,
  BILLING_POSITION_LABELS,
  BILLING_CUSTOM_BLOCK_TYPES,
  DEFAULT_EXTRA_CHARGE_LABELS,
} from '@/types/billing-config';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const BUILT_IN_SECTIONS: BillingBuiltInSectionKey[] = [
  'header',
  'trip_km_details',
  'billed_to',
  'company_details',
  'vehicle_table',
  'totals',
  'qr_code',
  'terms',
  'footer',
];

function defaultSectionOverride(): BillingSectionOverride {
  return { show: true, label: undefined };
}

export function BillingLayoutConfigCard() {
  const { data: orgSettings } = useOrganizationSettings();
  const updateSettings = useUpdateOrganizationSettings();
  const config: BillingLayoutConfig = orgSettings?.billing_layout_config ?? {};

  const [useSameLayoutForCompanyBills, setUseSameLayoutForCompanyBills] = useState(true);
  const [sections, setSections] = useState<Record<string, BillingSectionOverride>>({});
  const [customBlocks, setCustomBlocks] = useState<BillingCustomBlock[]>([]);
  const [extraCharges, setExtraCharges] = useState<BillingLayoutConfig['extraCharges']>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setUseSameLayoutForCompanyBills(config.useSameLayoutForCompanyBills !== false);
    setSections(config.sections ?? {});
    setCustomBlocks(config.customBlocks ?? []);
    setExtraCharges(config.extraCharges ?? {});
  }, [config.useSameLayoutForCompanyBills, config.sections, config.customBlocks, config.extraCharges]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings.mutateAsync({
        billing_layout_config: {
          useSameLayoutForCompanyBills,
          sections: Object.keys(sections).length ? sections : undefined,
          customBlocks: customBlocks.length ? customBlocks : undefined,
          extraCharges: Object.keys(extraCharges).length ? extraCharges : undefined,
        },
      });
    } finally {
      setSaving(false);
    }
  };

  const setSectionOverride = (key: BillingBuiltInSectionKey, override: BillingSectionOverride) => {
    setSections((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? defaultSectionOverride()), ...override },
    }));
  };

  const addCustomBlock = () => {
    const id = `block-${Date.now()}`;
    setCustomBlocks((prev) => [
      ...prev,
      {
        id,
        key: `custom_${prev.length + 1}`,
        label: 'New field',
        type: 'short_text',
        position: 'after_customer_details',
        valueSource: 'per_bill',
        order: prev.length,
      },
    ]);
  };

  const updateCustomBlock = (id: string, updates: Partial<BillingCustomBlock>) => {
    setCustomBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)));
  };

  const removeCustomBlock = (id: string) => {
    setCustomBlocks((prev) => prev.filter((b) => b.id !== id).map((b, i) => ({ ...b, order: i })));
  };

  const moveCustomBlock = (index: number, direction: 1 | -1) => {
    const next = index + direction;
    if (next < 0 || next >= customBlocks.length) return;
    const reordered = [...customBlocks];
    const [removed] = reordered.splice(index, 1);
    reordered.splice(next, 0, removed);
    setCustomBlocks(reordered.map((b, i) => ({ ...b, order: i })));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Bill layout
        </CardTitle>
        <CardDescription>
          Show or hide sections, set labels, and add custom blocks (e.g. PO Number, GSTIN). Use one config for both customer and company bills, or configure separately.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="flex items-center gap-4">
          <Switch
            id="same-layout"
            checked={useSameLayoutForCompanyBills}
            onCheckedChange={setUseSameLayoutForCompanyBills}
          />
          <Label htmlFor="same-layout" className="cursor-pointer">
            Use same layout for company bills (one config for both; no need to set twice)
          </Label>
        </div>

        <div className="space-y-4">
          <Label className="text-base font-medium">Built-in sections</Label>
          <p className="text-sm text-muted-foreground">Show or hide each section and optionally override its label on the bill.</p>
          <div className="rounded-md border divide-y">
            {BUILT_IN_SECTIONS.map((key) => {
              const override = sections[key] ?? defaultSectionOverride();
              const defaultLabel = BILLING_SECTION_LABELS[key];
              return (
                <div key={key} className="flex flex-wrap items-center gap-4 p-3">
                  <span className="font-mono text-sm w-44 shrink-0">{defaultLabel}</span>
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <label className="flex items-center gap-2 whitespace-nowrap">
                      <Switch
                        checked={override.show !== false}
                        onCheckedChange={(checked) => setSectionOverride(key, { ...override, show: checked })}
                      />
                      <span className="text-sm">Show</span>
                    </label>
                    <Input
                      placeholder={`Label (default: ${defaultLabel})`}
                      value={override.label ?? ''}
                      onChange={(e) => setSectionOverride(key, { ...override, label: e.target.value || undefined })}
                      className="max-w-[220px]"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <Label className="text-base font-medium">Extra charges (Toll & Parking)</Label>
          <p className="text-sm text-muted-foreground">These fields appear when generating a bill and are added to the total. You can rename them or hide them.</p>
          <div className="rounded-md border divide-y">
            {(['toll_tax', 'parking_charges'] as const).map((key) => {
              const cfg: BillingExtraChargeConfig = extraCharges[key] ?? {};
              const defaultLabel = DEFAULT_EXTRA_CHARGE_LABELS[key];
              return (
                <div key={key} className="flex flex-wrap items-center gap-4 p-3">
                  <span className="font-mono text-sm w-44 shrink-0">{defaultLabel}</span>
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <label className="flex items-center gap-2 whitespace-nowrap">
                      <Switch
                        checked={cfg.show !== false}
                        onCheckedChange={(checked) => setExtraCharges((prev) => ({ ...prev, [key]: { ...prev?.[key], show: checked } }))}
                      />
                      <span className="text-sm">Show on bill form</span>
                    </label>
                    <Input
                      placeholder={`Label (default: ${defaultLabel})`}
                      value={cfg.label ?? ''}
                      onChange={(e) => setExtraCharges((prev) => ({ ...prev, [key]: { ...prev?.[key], label: e.target.value || undefined } }))}
                      className="max-w-[220px]"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-medium">Custom blocks</Label>
              <p className="text-sm text-muted-foreground">
                Add fields like PO Number, GSTIN, payment instructions. Org-wide: same value on all bills. Per-bill: value entered when generating each bill.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addCustomBlock}>
              <Plus className="h-4 w-4 mr-2" />
              Add block
            </Button>
          </div>
          {customBlocks.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No custom blocks. Click &quot;Add block&quot; to add one.</p>
          ) : (
            <div className="space-y-3">
              {customBlocks.map((b, index) => (
                <div key={b.id} className="flex flex-wrap items-start gap-2 p-3 border rounded-md bg-muted/20">
                  <div className="flex items-center gap-1 shrink-0">
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveCustomBlock(index, -1)} disabled={index === 0}>
                      <GripVertical className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input
                    placeholder="Key (e.g. po_number)"
                    value={b.key}
                    onChange={(e) => updateCustomBlock(b.id, { key: e.target.value.replace(/\s/g, '_') })}
                    className="w-36 font-mono"
                  />
                  <Input
                    placeholder="Label (e.g. PO Number)"
                    value={b.label}
                    onChange={(e) => updateCustomBlock(b.id, { label: e.target.value })}
                    className="w-40"
                  />
                  <Select
                    value={b.type}
                    onValueChange={(v) => updateCustomBlock(b.id, { type: v as BillingCustomBlockType })}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BILLING_CUSTOM_BLOCK_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={b.position}
                    onValueChange={(v) => updateCustomBlock(b.id, { position: v as BillingCustomBlockPosition })}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(BILLING_POSITION_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={b.valueSource}
                    onValueChange={(v) => updateCustomBlock(b.id, { valueSource: v as BillingCustomBlockValueSource })}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="per_bill">Per bill</SelectItem>
                      <SelectItem value="org">Org-wide</SelectItem>
                    </SelectContent>
                  </Select>
                  {b.valueSource === 'org' && (
                    <>
                      {b.type === 'long_text' ? (
                        <Textarea
                          placeholder="Org-wide value"
                          value={typeof b.orgValue === 'string' ? b.orgValue : ''}
                          onChange={(e) => updateCustomBlock(b.id, { orgValue: e.target.value || undefined })}
                          className="min-w-[200px] flex-1"
                          rows={2}
                        />
                      ) : b.type === 'checkbox' ? (
                        <label className="flex items-center gap-2 whitespace-nowrap">
                          <Switch
                            checked={b.orgValue === true}
                            onCheckedChange={(checked) => updateCustomBlock(b.id, { orgValue: checked })}
                          />
                          <span className="text-sm">Default</span>
                        </label>
                      ) : (
                        <Input
                          placeholder="Org-wide value"
                          value={b.orgValue != null ? String(b.orgValue) : ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (b.type === 'number') updateCustomBlock(b.id, { orgValue: val === '' ? undefined : Number(val) });
                            else if (b.type === 'date') updateCustomBlock(b.id, { orgValue: val || undefined });
                            else updateCustomBlock(b.id, { orgValue: val || undefined });
                          }}
                          className="min-w-[140px]"
                          type={b.type === 'number' ? 'number' : b.type === 'date' ? 'date' : 'text'}
                        />
                      )}
                    </>
                  )}
                  <Button type="button" variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => removeCustomBlock(b.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Save bill layout
        </Button>
      </CardContent>
    </Card>
  );
}
