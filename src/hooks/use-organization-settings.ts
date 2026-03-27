import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useOrg } from '@/hooks/use-org';
import type { FleetNewCarFormConfig, DriverFormConfig, BookingFormConfig, ServiceRecordFormConfig, DowntimeFormConfig, IncidentFormConfig, FuelEntryFormConfig } from '@/types/form-config';
import type { BillingLayoutConfig } from '@/types/billing-config';

export type OcrTier = 'basic' | 'plus' | 'pro';

export interface OrganizationSettingsRow {
  organization_id: string;
  buffer_minutes: number;
  minimum_km_per_km: number;
  minimum_km_hybrid_per_day: number;
  support_notes: string | null;
  terms_and_conditions: string | null;
  bill_number_prefix: string;
  billing_layout_config: BillingLayoutConfig | null;
  fleet_new_car_form_config: FleetNewCarFormConfig | null;
  drivers_form_config: DriverFormConfig | null;
  booking_form_config: BookingFormConfig | null;
  service_record_form_config: ServiceRecordFormConfig | null;
  downtime_form_config: DowntimeFormConfig | null;
  incident_form_config: IncidentFormConfig | null;
  fuel_entry_form_config: FuelEntryFormConfig | null;
  supervisor_assignment_mode: 'project' | 'legacy' | null;
  ocr_tier: OcrTier | null;
  updated_at: string;
}

export function useOrganizationSettings() {
  const { orgId } = useOrg();
  return useQuery({
    queryKey: ['organization-settings', orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from('organization_settings')
        .select('*')
        .eq('organization_id', orgId)
        .maybeSingle();
      if (error) throw error;
      return data as OrganizationSettingsRow | null;
    },
    enabled: !!orgId,
  });
}

export function useUpdateOrganizationSettings() {
  const queryClient = useQueryClient();
  const { orgId } = useOrg();

  return useMutation({
    mutationFn: async (updates: {
      terms_and_conditions?: string | null;
      bill_number_prefix?: string;
      billing_layout_config?: BillingLayoutConfig | null;
      fleet_new_car_form_config?: FleetNewCarFormConfig | null;
      drivers_form_config?: DriverFormConfig | null;
      booking_form_config?: BookingFormConfig | null;
      service_record_form_config?: ServiceRecordFormConfig | null;
      downtime_form_config?: DowntimeFormConfig | null;
      incident_form_config?: IncidentFormConfig | null;
      fuel_entry_form_config?: FuelEntryFormConfig | null;
      supervisor_assignment_mode?: 'project' | 'legacy';
      ocr_tier?: OcrTier | null;
    }) => {
      if (!orgId) throw new Error('Organization not found');
      const { data: existing } = await supabase
        .from('organization_settings')
        .select('organization_id')
        .eq('organization_id', orgId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('organization_settings')
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq('organization_id', orgId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('organization_settings').insert({
          organization_id: orgId,
          terms_and_conditions: updates.terms_and_conditions ?? null,
          bill_number_prefix: updates.bill_number_prefix ?? 'PT',
          billing_layout_config: updates.billing_layout_config ?? null,
          fleet_new_car_form_config: updates.fleet_new_car_form_config ?? null,
          drivers_form_config: updates.drivers_form_config ?? null,
          booking_form_config: updates.booking_form_config ?? null,
          service_record_form_config: updates.service_record_form_config ?? null,
          downtime_form_config: updates.downtime_form_config ?? null,
          incident_form_config: updates.incident_form_config ?? null,
          fuel_entry_form_config: updates.fuel_entry_form_config ?? null,
          supervisor_assignment_mode: updates.supervisor_assignment_mode ?? 'project',
          ocr_tier: updates.ocr_tier ?? 'basic',
          updated_at: new Date().toISOString(),
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-settings', orgId] });
      toast.success('Settings saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
