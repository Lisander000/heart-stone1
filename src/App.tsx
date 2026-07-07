import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Home from "./pages/Home.tsx";
import NotFound from "./pages/NotFound.tsx";
import Auth from "./pages/Auth.tsx";
import ICPDocument from "./pages/ICPDocument.tsx";
import Competitors from "./pages/Competitors.tsx";
import Offers from "./pages/Offers.tsx";
import Orders from "./pages/ops/Orders.tsx";
import OrderDetail from "./pages/ops/OrderDetail.tsx";
import Unfulfilled from "./pages/ops/Unfulfilled.tsx";
import Shipments from "./pages/ops/Shipments.tsx";
import Returns from "./pages/ops/Returns.tsx";
import ReturnDetail from "./pages/ops/ReturnDetail.tsx";
import ReturnsDashboard from "./pages/ops/ReturnsDashboard.tsx";
import Tickets from "./pages/ops/Tickets.tsx";
import OpsOverview from "./pages/ops/OpsOverview.tsx";
import RecordDetail from "./pages/ops/RecordDetail.tsx";
import RecordForm from "./pages/ops/RecordForm.tsx";
import ProductHealth from "./pages/ops/ProductHealth.tsx";
import Agents from "./pages/ops/Agents.tsx";
import Finance from "./pages/ops/Finance.tsx";
import ForecastActual from "./pages/finance/ForecastActual.tsx";
import Notifications from "./pages/ops/Notifications.tsx";
import Team from "./pages/ops/Team.tsx";
import AppShell from "./layouts/AppShell.tsx";
import { ProtectedRoute } from "./components/ProtectedRoute.tsx";
import Profile from "./pages/Profile.tsx";
import DailyTracker from "./pages/tracker/DailyTracker.tsx";
import CreativeStudio from "./pages/creative/CreativeStudio.tsx";
import AdCopiesStudio from "./pages/creative/AdCopiesStudio.tsx";
import TestingTracker from "./pages/creative/TestingTracker.tsx";
import UgcStudio from "./pages/creative/UgcStudio.tsx";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
              <Route path="/" element={<Home />} />
              <Route path="/bank" element={<Index initialView="brands" />} />
              <Route path="/collections" element={<Index initialView="collections" />} />
              <Route path="/synthesis" element={<Index initialView="synthesis" />} />
              <Route path="/entries" element={<Index initialView="entries" />} />
              <Route path="/icp" element={<ICPDocument />} />
              <Route path="/competitors" element={<Competitors />} />
              <Route path="/offers" element={<Offers />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/orders/:orderId" element={<OrderDetail />} />
              <Route path="/unfulfilled" element={<Unfulfilled />} />
              <Route path="/shipments" element={<Shipments />} />
              <Route path="/returns" element={<Returns />} />
              <Route path="/returns/dashboard" element={<ReturnsDashboard />} />
              <Route path="/returns/:id" element={<ReturnDetail />} />
              <Route path="/tickets" element={<Tickets />} />
              <Route path="/ops" element={<OpsOverview />} />
              <Route path="/product-health" element={<ProductHealth />} />
              <Route path="/agents" element={<Agents />} />
              <Route path="/finance" element={<Finance />} />
              <Route path="/finance/forecast" element={<ForecastActual />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/team" element={<Team />} />
              <Route path="/ops/:table/new" element={<RecordForm />} />
              <Route path="/ops/:table/:id/edit" element={<RecordForm />} />
              <Route path="/ops/:table/:id" element={<RecordDetail />} />
              <Route path="/daily-tracker" element={<DailyTracker />} />
              <Route path="/creative/concepts" element={<CreativeStudio />} />
              <Route path="/creative/ad-copies" element={<AdCopiesStudio />} />
              <Route path="/creative/testing" element={<TestingTracker />} />
              <Route path="/creative/ugc" element={<UgcStudio />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
