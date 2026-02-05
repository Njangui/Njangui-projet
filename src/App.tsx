import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import PropertyDetail from "./pages/PropertyDetail";
import CreateListing from "./pages/CreateListing";
import Messages from "./pages/Messages";
import Dashboard from "./pages/Dashboard";
import SeekerDashboard from "./pages/SeekerDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import Search from "./pages/Search";
import TestimonialsPage from "./pages/TestimonialsPage";
import Verification from "./pages/Verification";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/property/:id" element={<PropertyDetail />} />
                <Route path="/create-listing" element={<CreateListing />} />
                <Route path="/messages" element={<Messages />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/seeker-dashboard" element={<SeekerDashboard />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/search" element={<Search />} />
                <Route path="/testimonials" element={<TestimonialsPage />} />
                <Route path="/verification" element={<Verification />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
