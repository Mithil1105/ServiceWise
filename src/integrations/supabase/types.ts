export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          status: string
          plan: string
          created_at: string
          created_by: string | null
          org_code: string
          join_code: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          status?: string
          plan?: string
          created_at?: string
          created_by?: string | null
          org_code?: string
          join_code?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          status?: string
          plan?: string
          created_at?: string
          created_by?: string | null
          org_code?: string
          join_code?: string
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          role: string
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          role?: string
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string
          role?: string
          status?: string
          created_at?: string
        }
        Relationships: []
      }
      onboarding_requests: {
        Row: {
          id: string
          user_id: string
          action: string
          payload: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          action: string
          payload?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          action?: string
          payload?: Json
          created_at?: string
        }
        Relationships: []
      }
      platform_admins: {
        Row: { user_id: string; level: string; is_active: boolean; created_at: string }
        Insert: { user_id: string; level?: string; is_active?: boolean; created_at?: string }
        Update: { user_id?: string; level?: string; is_active?: boolean; created_at?: string }
        Relationships: []
      }
      plans: {
        Row: { id: string; name: string; price_monthly_inr: number; max_users: number | null; max_vehicles: number | null; features: Json; is_active: boolean; created_at: string }
        Insert: { id?: string; name: string; price_monthly_inr?: number; max_users?: number | null; max_vehicles?: number | null; features?: Json; is_active?: boolean; created_at?: string }
        Update: { id?: string; name?: string; price_monthly_inr?: number; max_users?: number | null; max_vehicles?: number | null; features?: Json; is_active?: boolean; created_at?: string }
        Relationships: []
      }
      org_subscriptions: {
        Row: { organization_id: string; plan_id: string | null; status: string; trial_ends_at: string | null; current_period_end: string | null; billing_email: string | null; updated_at: string }
        Insert: { organization_id: string; plan_id?: string | null; status?: string; trial_ends_at?: string | null; current_period_end?: string | null; billing_email?: string | null; updated_at?: string }
        Update: { organization_id?: string; plan_id?: string | null; status?: string; trial_ends_at?: string | null; current_period_end?: string | null; billing_email?: string | null; updated_at?: string }
        Relationships: []
      }
      org_plan_overrides: {
        Row: {
          organization_id: string
          override_price_monthly: number | null
          override_max_users: number | null
          override_max_vehicles: number | null
          override_features: Json | null
          override_trial_ends_at: string | null
          notes: string | null
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          organization_id: string
          override_price_monthly?: number | null
          override_max_users?: number | null
          override_max_vehicles?: number | null
          override_features?: Json | null
          override_trial_ends_at?: string | null
          notes?: string | null
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          organization_id?: string
          override_price_monthly?: number | null
          override_max_users?: number | null
          override_max_vehicles?: number | null
          override_features?: Json | null
          override_trial_ends_at?: string | null
          notes?: string | null
          updated_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      platform_announcements: {
        Row: { id: string; title: string; message: string; type: string; target_type: string; target_id: string | null; starts_at: string; ends_at: string | null; is_active: boolean; created_by: string | null; created_at: string }
        Insert: { id?: string; title: string; message: string; type?: string; target_type?: string; target_id?: string | null; starts_at?: string; ends_at?: string | null; is_active?: boolean; created_by?: string | null; created_at?: string }
        Update: { id?: string; title?: string; message?: string; type?: string; target_type?: string; target_id?: string | null; starts_at?: string; ends_at?: string | null; is_active?: boolean; created_by?: string | null; created_at?: string }
        Relationships: []
      }
      organization_settings: {
        Row: { organization_id: string; buffer_minutes: number; minimum_km_per_km: number; minimum_km_hybrid_per_day: number; support_notes: string | null; updated_at: string }
        Insert: { organization_id: string; buffer_minutes?: number; minimum_km_per_km?: number; minimum_km_hybrid_per_day?: number; support_notes?: string | null; updated_at?: string }
        Update: { organization_id?: string; buffer_minutes?: number; minimum_km_per_km?: number; minimum_km_hybrid_per_day?: number; support_notes?: string | null; updated_at?: string }
        Relationships: []
      }
      platform_audit_log: {
        Row: { id: string; actor_user_id: string; action: string; target_type: string; target_id: string | null; before: Json | null; after: Json | null; created_at: string }
        Insert: { id?: string; actor_user_id: string; action: string; target_type: string; target_id?: string | null; before?: Json | null; after?: Json | null; created_at?: string }
        Update: { id?: string; actor_user_id?: string; action?: string; target_type?: string; target_id?: string | null; before?: Json | null; after?: Json | null; created_at?: string }
        Relationships: []
      }
      booking_audit_log: {
        Row: {
          action: Database["public"]["Enums"]["booking_audit_action"]
          actor_id: string | null
          after: Json | null
          before: Json | null
          booking_id: string
          created_at: string
          id: string
          organization_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["booking_audit_action"]
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          booking_id: string
          created_at?: string
          id?: string
          organization_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["booking_audit_action"]
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          booking_id?: string
          created_at?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_audit_log_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_vehicles: {
        Row: {
          advance_amount: number | null
          booking_id: string
          car_id: string
          computed_total: number | null
          created_at: string
          created_by: string | null
          driver_name: string | null
          driver_phone: string | null
          estimated_km: number | null
          final_km: number | null
          id: string
          organization_id: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          rate_per_day: number | null
          rate_per_km: number | null
          rate_total: number | null
          rate_type: Database["public"]["Enums"]["rate_type"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          advance_amount?: number | null
          booking_id: string
          car_id: string
          computed_total?: number | null
          created_at?: string
          created_by?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          estimated_km?: number | null
          final_km?: number | null
          id?: string
          organization_id: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          rate_per_day?: number | null
          rate_per_km?: number | null
          rate_total?: number | null
          rate_type?: Database["public"]["Enums"]["rate_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          advance_amount?: number | null
          booking_id?: string
          car_id?: string
          computed_total?: number | null
          created_at?: string
          created_by?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          estimated_km?: number | null
          final_km?: number | null
          id?: string
          organization_id?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          rate_per_day?: number | null
          rate_per_km?: number | null
          rate_total?: number | null
          rate_type?: Database["public"]["Enums"]["rate_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_vehicles_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_vehicles_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          booking_ref: string
          created_at: string
          created_by: string | null
          customer_name: string
          customer_phone: string
          dropoff: string | null
          end_at: string
          id: string
          notes: string | null
          organization_id: string
          pickup: string | null
          start_at: string
          status: Database["public"]["Enums"]["booking_status"]
          trip_type: Database["public"]["Enums"]["trip_type"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          booking_ref?: string
          created_at?: string
          created_by?: string | null
          customer_name: string
          customer_phone: string
          dropoff?: string | null
          end_at: string
          id?: string
          notes?: string | null
          organization_id: string
          pickup?: string | null
          start_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          trip_type?: Database["public"]["Enums"]["trip_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          booking_ref?: string
          created_at?: string
          created_by?: string | null
          customer_name?: string
          customer_phone?: string
          dropoff?: string | null
          end_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          pickup?: string | null
          start_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          trip_type?: Database["public"]["Enums"]["trip_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      car_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          car_id: string
          id: string
          notes: string | null
          organization_id: string
          supervisor_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          car_id: string
          id?: string
          notes?: string | null
          organization_id: string
          supervisor_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          car_id?: string
          id?: string
          notes?: string | null
          organization_id?: string
          supervisor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "car_assignments_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
        ]
      }
      car_documents: {
        Row: {
          car_id: string
          created_at: string
          created_by: string | null
          document_type: string
          expiry_date: string | null
          file_name: string | null
          file_path: string | null
          id: string
          notes: string | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          car_id: string
          created_at?: string
          created_by?: string | null
          document_type: string
          expiry_date?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          car_id?: string
          created_at?: string
          created_by?: string | null
          document_type?: string
          expiry_date?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "car_documents_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
        ]
      }
      car_notes: {
        Row: {
          car_id: string
          created_at: string
          created_by: string | null
          id: string
          note: string
          organization_id: string
          pinned: boolean
        }
        Insert: {
          car_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          note: string
          organization_id: string
          pinned?: boolean
        }
        Update: {
          car_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string
          organization_id?: string
          pinned?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "car_notes_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
        ]
      }
      car_service_rules: {
        Row: {
          car_id: string
          created_at: string
          enabled: boolean
          id: string
          last_serviced_at: string | null
          last_serviced_km: number | null
          organization_id: string
          rule_id: string
        }
        Insert: {
          car_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          last_serviced_at?: string | null
          last_serviced_km?: number | null
          organization_id: string
          rule_id: string
        }
        Update: {
          car_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          last_serviced_at?: string | null
          last_serviced_km?: number | null
          organization_id?: string
          rule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "car_service_rules_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "car_service_rules_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "service_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      cars: {
        Row: {
          created_at: string
          created_by: string | null
          fuel_type: string | null
          id: string
          model: string
          notes: string | null
          organization_id: string
          seats: number | null
          status: string
          updated_at: string
          vehicle_number: string
          vin_chassis: string | null
          year: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          fuel_type?: string | null
          id?: string
          model: string
          notes?: string | null
          organization_id: string
          seats?: number | null
          status?: string
          updated_at?: string
          vehicle_number: string
          vin_chassis?: string | null
          year?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          fuel_type?: string | null
          id?: string
          model?: string
          notes?: string | null
          organization_id?: string
          seats?: number | null
          status?: string
          updated_at?: string
          vehicle_number?: string
          vin_chassis?: string | null
          year?: number | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          organization_id: string
          phone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          organization_id: string
          phone: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          organization_id?: string
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      downtime_logs: {
        Row: {
          car_id: string
          created_at: string
          created_by: string | null
          ended_at: string | null
          estimated_uptime_at: string | null
          id: string
          notes: string | null
          organization_id: string
          reason: string
          source: string
          started_at: string
        }
        Insert: {
          car_id: string
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          estimated_uptime_at?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          reason: string
          source?: string
          started_at?: string
        }
        Update: {
          car_id?: string
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          estimated_uptime_at?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          reason?: string
          source?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "downtime_logs_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          license_expiry: string | null
          license_file_name: string | null
          license_file_path: string | null
          location: string | null
          name: string
          notes: string | null
          organization_id: string
          phone: string
          region: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          license_expiry?: string | null
          license_file_name?: string | null
          license_file_path?: string | null
          location?: string | null
          name: string
          notes?: string | null
          organization_id: string
          phone: string
          region?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          license_expiry?: string | null
          license_file_name?: string | null
          license_file_path?: string | null
          location?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string
          region?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      incidents: {
        Row: {
          car_id: string
          cost: number | null
          created_at: string
          created_by: string | null
          description: string | null
          driver_name: string | null
          estimated_return_at: string | null
          id: string
          incident_at: string
          location: string | null
          organization_id: string
          resolved: boolean
          resolved_at: string | null
          resolved_notes: string | null
          severity: string
          type: string
        }
        Insert: {
          car_id: string
          cost?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          driver_name?: string | null
          estimated_return_at?: string | null
          id?: string
          incident_at?: string
          location?: string | null
          organization_id: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_notes?: string | null
          severity?: string
          type: string
        }
        Update: {
          car_id?: string
          cost?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          driver_name?: string | null
          estimated_return_at?: string | null
          id?: string
          incident_at?: string
          location?: string | null
          organization_id?: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_notes?: string | null
          severity?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          advance_amount: number
          amount_due: number
          amount_total: number
          booking_id: string
          created_at: string
          created_by: string | null
          id: string
          invoice_no: string
          issued_at: string
        }
        Insert: {
          advance_amount?: number
          amount_due: number
          amount_total: number
          booking_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_no?: string
          issued_at?: string
        }
        Update: {
          advance_amount?: number
          amount_due?: number
          amount_total?: number
          booking_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_no?: string
          issued_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      odometer_entries: {
        Row: {
          car_id: string
          created_at: string
          entered_by: string | null
          id: string
          odometer_km: number
          organization_id: string
          reading_at: string
        }
        Insert: {
          car_id: string
          created_at?: string
          entered_by?: string | null
          id?: string
          odometer_km: number
          organization_id: string
          reading_at?: string
        }
        Update: {
          car_id?: string
          created_at?: string
          entered_by?: string | null
          id?: string
          odometer_km?: number
          organization_id?: string
          reading_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "odometer_entries_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          name: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_bill_files: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          service_record_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          service_record_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          service_record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_bill_files_service_record_id_fkey"
            columns: ["service_record_id"]
            isOneToOne: false
            referencedRelation: "service_records"
            referencedColumns: ["id"]
          },
        ]
      }
      service_records: {
        Row: {
          bill_path: string | null
          car_id: string
          cost: number | null
          created_at: string
          entered_by: string | null
          id: string
          notes: string | null
          odometer_km: number
          organization_id: string
          rule_id: string | null
          serial_number: string | null
          service_name: string
          serviced_at: string
          vendor_location: string | null
          vendor_name: string | null
          warranty_expiry: string | null
          warranty_file_name: string | null
          warranty_file_path: string | null
        }
        Insert: {
          bill_path?: string | null
          car_id: string
          cost?: number | null
          created_at?: string
          entered_by?: string | null
          id?: string
          notes?: string | null
          odometer_km: number
          organization_id: string
          rule_id?: string | null
          serial_number?: string | null
          service_name: string
          serviced_at: string
          vendor_location?: string | null
          vendor_name?: string | null
          warranty_expiry?: string | null
          warranty_file_name?: string | null
          warranty_file_path?: string | null
        }
        Update: {
          bill_path?: string | null
          car_id?: string
          cost?: number | null
          created_at?: string
          entered_by?: string | null
          id?: string
          notes?: string | null
          odometer_km?: number
          organization_id?: string
          rule_id?: string | null
          serial_number?: string | null
          service_name?: string
          serviced_at?: string
          vendor_location?: string | null
          vendor_name?: string | null
          warranty_expiry?: string | null
          warranty_file_name?: string | null
          warranty_file_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_records_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_records_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "service_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      service_rules: {
        Row: {
          active: boolean
          created_at: string
          due_soon_threshold_days: number | null
          due_soon_threshold_km: number | null
          id: string
          interval_days: number | null
          interval_km: number | null
          is_critical: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          due_soon_threshold_days?: number | null
          due_soon_threshold_km?: number | null
          id?: string
          interval_days?: number | null
          interval_km?: number | null
          is_critical?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          due_soon_threshold_days?: number | null
          due_soon_threshold_km?: number | null
          id?: string
          interval_days?: number | null
          interval_km?: number | null
          is_critical?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      supervisor_activity_log: {
        Row: {
          action_details: Json | null
          action_type: string
          car_id: string | null
          created_at: string
          id: string
          organization_id: string
          supervisor_id: string
        }
        Insert: {
          action_details?: Json | null
          action_type: string
          car_id?: string | null
          created_at?: string
          id?: string
          organization_id: string
          supervisor_id: string
        }
        Update: {
          action_details?: Json | null
          action_type?: string
          car_id?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          supervisor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supervisor_activity_log_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
        ]
      }
      system_config: {
        Row: {
          id: string
          key: string
          organization_id: string
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          organization_id: string
          updated_at?: string
          value: Json
        }
        Update: {
          id?: string
          key?: string
          organization_id?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      tentative_holds: {
        Row: {
          booking_id: string
          created_at: string
          expires_at: string
          id: string
          organization_id: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          expires_at: string
          id?: string
          organization_id: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tentative_holds_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_snoozes: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          snooze_until: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          snooze_until: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          snooze_until?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_car_to_booking: {
        Args: {
          p_advance_amount?: number
          p_booking_id: string
          p_buffer_minutes?: number
          p_car_id: string
          p_driver_name?: string
          p_driver_phone?: string
          p_estimated_km?: number
          p_rate_per_day?: number
          p_rate_per_km?: number
          p_rate_total?: number
          p_rate_type?: Database["public"]["Enums"]["rate_type"]
        }
        Returns: Json
      }
      check_available_cars: {
        Args: {
          p_buffer_minutes?: number
          p_end_at: string
          p_exclude_booking_id?: string
          p_start_at: string
        }
        Returns: {
          car_id: string
          conflict_booked_by: string
          conflict_booking_ref: string
          conflict_end: string
          conflict_start: string
          is_available: boolean
          model: string
          seats: number
          vehicle_number: string
        }[]
      }
      get_org_entitlements: {
        Args: { p_org_id: string | null }
        Returns: Json
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "supervisor"
      booking_audit_action:
        | "created"
        | "updated"
        | "status_changed"
        | "vehicle_assigned"
        | "vehicle_removed"
        | "date_changed"
        | "rate_changed"
      booking_status:
        | "inquiry"
        | "tentative"
        | "confirmed"
        | "ongoing"
        | "completed"
        | "cancelled"
      payment_status: "unpaid" | "partial" | "paid"
      rate_type: "total" | "per_day" | "per_km" | "hybrid"
      trip_type: "local" | "outstation" | "airport" | "custom"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "manager", "supervisor"],
      booking_audit_action: [
        "created",
        "updated",
        "status_changed",
        "vehicle_assigned",
        "vehicle_removed",
        "date_changed",
        "rate_changed",
      ],
      booking_status: [
        "inquiry",
        "tentative",
        "confirmed",
        "ongoing",
        "completed",
        "cancelled",
      ],
      payment_status: ["unpaid", "partial", "paid"],
      rate_type: ["total", "per_day", "per_km", "hybrid"],
      trip_type: ["local", "outstation", "airport", "custom"],
    },
  },
} as const
