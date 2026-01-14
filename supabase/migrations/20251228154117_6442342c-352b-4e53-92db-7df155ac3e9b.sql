-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'manager');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Create cars table
CREATE TABLE public.cars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_number TEXT UNIQUE NOT NULL,
  model TEXT NOT NULL,
  year INTEGER,
  fuel_type TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  vin_chassis TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create odometer_entries table
CREATE TABLE public.odometer_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id UUID NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  odometer_km INTEGER NOT NULL,
  reading_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  entered_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create service_rules table (admin-defined templates)
CREATE TABLE public.service_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  interval_km INTEGER,
  interval_days INTEGER,
  is_critical BOOLEAN NOT NULL DEFAULT false,
  due_soon_threshold_km INTEGER DEFAULT 500,
  due_soon_threshold_days INTEGER DEFAULT 7,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create car_service_rules table (attach rules to cars)
CREATE TABLE public.car_service_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id UUID NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES public.service_rules(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_serviced_km INTEGER,
  last_serviced_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (car_id, rule_id)
);

-- Create service_records table
CREATE TABLE public.service_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id UUID NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES public.service_rules(id),
  service_name TEXT NOT NULL,
  serviced_at DATE NOT NULL,
  odometer_km INTEGER NOT NULL,
  vendor_name TEXT,
  vendor_location TEXT,
  cost NUMERIC(12, 2),
  notes TEXT,
  bill_path TEXT,
  entered_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_snoozes table for dismissing popups
CREATE TABLE public.user_snoozes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snooze_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.odometer_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_service_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_snoozes ENABLE ROW LEVEL SECURITY;

-- Security definer function to check user role (prevents infinite recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to get user's role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- User roles policies (only admins can manage)
CREATE POLICY "Users can view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert roles" ON public.user_roles
  FOR INSERT TO authenticated 
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles" ON public.user_roles
  FOR UPDATE TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles" ON public.user_roles
  FOR DELETE TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'));

-- Cars policies (both admin and manager can CRUD)
CREATE POLICY "Authenticated users can view cars" ON public.cars
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin and Manager can insert cars" ON public.cars
  FOR INSERT TO authenticated 
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin and Manager can update cars" ON public.cars
  FOR UPDATE TO authenticated 
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Only Admin can delete cars" ON public.cars
  FOR DELETE TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'));

-- Odometer entries policies
CREATE POLICY "Authenticated users can view odometer" ON public.odometer_entries
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin and Manager can insert odometer" ON public.odometer_entries
  FOR INSERT TO authenticated 
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- Service rules policies (only admin can manage)
CREATE POLICY "Authenticated users can view service rules" ON public.service_rules
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only Admin can insert service rules" ON public.service_rules
  FOR INSERT TO authenticated 
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only Admin can update service rules" ON public.service_rules
  FOR UPDATE TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only Admin can delete service rules" ON public.service_rules
  FOR DELETE TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'));

-- Car service rules policies
CREATE POLICY "Authenticated users can view car service rules" ON public.car_service_rules
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only Admin can insert car service rules" ON public.car_service_rules
  FOR INSERT TO authenticated 
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin and Manager can update car service rules" ON public.car_service_rules
  FOR UPDATE TO authenticated 
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- Service records policies
CREATE POLICY "Authenticated users can view service records" ON public.service_records
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin and Manager can insert service records" ON public.service_records
  FOR INSERT TO authenticated 
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin and Manager can update service records" ON public.service_records
  FOR UPDATE TO authenticated 
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- User snoozes policies
CREATE POLICY "Users can view own snoozes" ON public.user_snoozes
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own snoozes" ON public.user_snoozes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own snoozes" ON public.user_snoozes
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cars_updated_at
  BEFORE UPDATE ON public.cars
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_service_rules_updated_at
  BEFORE UPDATE ON public.service_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email));
  RETURN NEW;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert default service rule: General Service every 10,000 km (critical)
INSERT INTO public.service_rules (name, interval_km, is_critical, due_soon_threshold_km)
VALUES ('General Service', 10000, true, 500);

-- Create storage bucket for service bills
INSERT INTO storage.buckets (id, name, public) VALUES ('service-bills', 'service-bills', false);

-- Storage policies for service-bills bucket
CREATE POLICY "Authenticated users can view bills" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'service-bills');

CREATE POLICY "Admin and Manager can upload bills" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'service-bills' AND 
    (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "Admin and Manager can update bills" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'service-bills' AND 
    (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "Admin can delete bills" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'service-bills' AND public.has_role(auth.uid(), 'admin'));