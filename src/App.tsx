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
import VehicleHealthScore from "./pages/VehicleHealthScore";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import UserManagement from "./pages/UserManagement";
import Bookings from "./pages/Bookings";
import BookingCalendar from "./pages/BookingCalendar";
import BookingNew from "./pages/BookingNew";
import BookingEdit from "./pages/BookingEdit";
import BookingInvoice from "./pages/BookingInvoice";
import BookingHistory from "./pages/BookingHistory";
import Drivers from "./pages/Drivers";
import Supervisors from "./pages/Supervisors";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/fleet" element={<Fleet />} />
              <Route path="/fleet/new" element={<FleetNew />} />
              <Route path="/fleet/:id" element={<FleetDetail />} />
              <Route path="/drivers" element={<Drivers />} />
              <Route path="/odometer" element={<Odometer />} />
              <Route path="/vehicle-report/:id" element={<VehicleReport />} />
              <Route path="/services" element={<Services />} />
              <Route path="/services/new" element={<ServiceNew />} />
              <Route path="/critical" element={<CriticalQueue />} />
              <Route path="/incidents" element={<Incidents />} />
              <Route path="/downtime-report" element={<DowntimeReport />} />
              <Route path="/health-score" element={<VehicleHealthScore />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/users" element={<UserManagement />} />
              <Route path="/supervisors" element={<Supervisors />} />
              <Route path="/bookings" element={<Bookings />} />
              <Route path="/bookings/calendar" element={<BookingCalendar />} />
              <Route path="/bookings/new" element={<BookingNew />} />
              <Route path="/bookings/:id/edit" element={<BookingEdit />} />
              <Route path="/bookings/:id/invoice" element={<BookingInvoice />} />
              <Route path="/bookings/:id/history" element={<BookingHistory />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
