import React, { Suspense } from "react";
import { 
  createBrowserRouter, 
  RouterProvider, 
  Navigate 
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

// Infrastructure Contexts & UI components
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/toaster";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle } from "lucide-react";

// Lazy-loaded application pages for optimized code splitting
const Dashboard = React.lazy(() => import("@/pages/Dashboard"));
const ServiceJobForm = React.lazy(() => import("@/pages/ServiceJobForm"));
const Reports = React.lazy(() => import("@/pages/Reports"));
const RevenueExpenses = React.lazy(() => import("@/pages/RevenueExpenses"));
const Delivery = React.lazy(() => import("@/pages/Delivery"));
const Stock = React.lazy(() => import("@/pages/Stock"));
const Salary = React.lazy(() => import("@/pages/Salary"));
const Attendance = React.lazy(() => import("@/pages/Attendance"));
const InvoiceList = React.lazy(() => import("@/pages/InvoiceList"));
const Invoice = React.lazy(() => import("@/pages/Invoice"));

// 1. Initialize High-Performance Query Cache
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 30, // 30 seconds fresh cache
      refetchOnWindowFocus: false,
    },
  },
});

// ============================================================================
// ROUTING TOPOLOGY
// ============================================================================
const systemRouterTopology = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    errorElement: <GlobalErrorBoundary />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "dashboard", element: <Dashboard /> },
      { path: "jobs", element: <ServiceJobForm /> },
      { path: "billing", element: <ServiceJobForm /> },
      { path: "edit-job/:id", element: <ServiceJobForm /> },
      { path: "delivery", element: <Delivery /> },
      { path: "stock", element: <Stock /> },
      { path: "reports", element: <Reports /> },
      { path: "revenue", element: <RevenueExpenses /> },
      { path: "salary", element: <Salary /> },
      { path: "attendance", element: <Attendance /> },
      { path: "invoice", element: <InvoiceList /> },
      { path: "invoice/:id", element: <Invoice /> },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Suspense fallback={<GlobalLoadingSpinner message="Initializing Workstation..." />}>
          <RouterProvider router={systemRouterTopology} />
        </Suspense>
      </AuthProvider>
      <Toaster />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

// Global Loading Fallback Spinner
function GlobalLoadingSpinner({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex flex-col items-center justify-center gap-3 font-sans select-none">
      <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/20 animate-pulse">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
      <p className="text-xs font-mono text-muted-foreground tracking-wide">{message}</p>
    </div>
  );
}

// Global Error Boundary Fallback
function GlobalErrorBoundary() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 font-sans">
      <div className="max-w-md w-full text-center space-y-4 bg-card p-8 rounded-2xl shadow-xl border border-destructive/20">
        <div className="w-14 h-14 bg-destructive/10 text-destructive rounded-2xl flex items-center justify-center mx-auto mb-2">
          <AlertTriangle className="w-7 h-7 stroke-[2.3]" />
        </div>
        <h2 className="text-lg font-black uppercase tracking-tight text-foreground">Operational Interrupt</h2>
        <p className="text-xs text-muted-foreground font-medium leading-relaxed">
          An unexpected issue was encountered while rendering this component.
        </p>
        <Button 
          onClick={() => window.location.reload()} 
          className="mt-4 font-bold bg-primary hover:bg-primary/90 text-primary-foreground w-full rounded-xl shadow-lg"
        >
          Reload Workstation
        </Button>
        <Button 
          variant="ghost" 
          onClick={() => window.location.href = "/"} 
          className="text-xs font-semibold w-full mt-1"
        >
          Return to Dashboard
        </Button>
      </div>
    </div>
  );
}