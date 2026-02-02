import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth-context";
import AppLayout from "@/components/layout/AppLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Fleet from "./pages/Fleet";
import FleetNew from "./pages/FleetNew";
import FleetDetail from "./pages/FleetDetail";
import Odometer from "./pages/Odometer";
import VehicleReport from "./pages/VehicleReport";
import Services from "./pages/Services";
import ServiceNew from "./pages/ServiceNew";
import CriticalQueue from "./pages/CriticalQueue";
import Incidents from "./pages/Incidents";
import DowntimeReport from "./pages/DowntimeReport";
import Reports from "./pages/Reports";
import Financials from "./pages/Financials";
import Settings from "./pages/Settings";
import UserManagement from "./pages/UserManagement";
import Bookings from "./pages/Bookings";
import BookingCalendar from "./pages/BookingCalendar";
import BookingNew from "./pages/BookingNew";
import BookingEdit from "./pages/BookingEdit";
import BookingInvoice from "./pages/BookingInvoice";
import BookingHistory from "./pages/BookingHistory";
import Bills from "./pages/Bills";
import BillingManagement from "./pages/BillingManagement";
import Drivers from "./pages/Drivers";
import Supervisors from "./pages/Supervisors";
import NotFound from "./pages/NotFound";
import MarketingLayout from "./pages/marketing/MarketingLayout";
import Index from "./pages/Index";
import ProductPage from "./pages/marketing/ProductPage";
import FeaturesPage from "./pages/marketing/FeaturesPage";
import RolesPage from "./pages/marketing/RolesPage";
import HowItWorksPage from "./pages/marketing/HowItWorksPage";
import SecurityPage from "./pages/marketing/SecurityPage";
import PricingPage from "./pages/marketing/PricingPage";
import ContactPage from "./pages/marketing/ContactPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Marketing (public) */}
            <Route element={<MarketingLayout />}>
              <Route path="/" element={<Index />} />
              <Route path="/product" element={<ProductPage />} />
              <Route path="/features" element={<FeaturesPage />} />
              <Route path="/roles" element={<RolesPage />} />
              <Route path="/how-it-works" element={<HowItWorksPage />} />
              <Route path="/security" element={<SecurityPage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/contact" element={<ContactPage />} />
            </Route>
            {/* App login (no layout) */}
            <Route path="/auth" element={<Auth />} />
            {/* App (dashboard) - under /app */}
            <Route path="/app" element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="fleet" element={<Fleet />} />
              <Route path="fleet/new" element={<FleetNew />} />
              <Route path="fleet/:id" element={<FleetDetail />} />
              <Route path="drivers" element={<Drivers />} />
              <Route path="odometer" element={<Odometer />} />
              <Route path="vehicle-report/:id" element={<VehicleReport />} />
              <Route path="services" element={<Services />} />
              <Route path="services/new" element={<ServiceNew />} />
              <Route path="critical" element={<CriticalQueue />} />
              <Route path="incidents" element={<Incidents />} />
              <Route path="downtime-report" element={<DowntimeReport />} />
              <Route path="reports" element={<Reports />} />
              <Route path="financials" element={<Financials />} />
              <Route path="settings" element={<Settings />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="supervisors" element={<Supervisors />} />
              <Route path="bookings" element={<Bookings />} />
              <Route path="bookings/calendar" element={<BookingCalendar />} />
              <Route path="bookings/new" element={<BookingNew />} />
              <Route path="bookings/:id/edit" element={<BookingEdit />} />
              <Route path="bookings/:id/invoice" element={<BookingInvoice />} />
              <Route path="bookings/:id/bills" element={<Bills />} />
              <Route path="bookings/:id/history" element={<BookingHistory />} />
              <Route path="billing" element={<BillingManagement />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
