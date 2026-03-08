import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import NewOrder from "./pages/NewOrder";
import Products from "./pages/Products";
import Users from "./pages/Users";
import Backups from "./pages/Backups";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Layout from "./components/Layout";
import NotFound from "./pages/NotFound";
import { Skeleton } from "@/components/ui/skeleton";

const queryClient = new QueryClient();

const PageSkeleton = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="space-y-4 w-64">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-64" />
    </div>
  </div>
);

const ProtectedRoute = ({ children, requiredPermission }: { children: React.ReactNode; requiredPermission?: string }) => {
  const { isAuthenticated, loading } = useAuth();
  const perms = usePermissions();

  if (loading) return <PageSkeleton />;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (perms === null) return <PageSkeleton />;

  if (requiredPermission && !(perms as any)[requiredPermission]) {
    return <Navigate to="/orders" replace />;
  }

  return <Layout>{children}</Layout>;
};

const LoginRoute = () => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <PageSkeleton />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <Login />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LoginRoute />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute requiredPermission="viewOrders"><Orders /></ProtectedRoute>} />
            <Route path="/orders/new" element={<ProtectedRoute requiredPermission="createOrder"><NewOrder /></ProtectedRoute>} />
            <Route path="/products" element={<ProtectedRoute requiredPermission="createOrder"><Products /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute requiredPermission="manageUsers"><Users /></ProtectedRoute>} />
            <Route path="/backups" element={<ProtectedRoute requiredPermission="viewFinancial"><Backups /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
