import React, { Suspense } from "react";
import { 
  createBrowserRouter, 
  RouterProvider, 
  Navigate, 
  Outlet, 
  useLocation 
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

// Infrastructure Contexts & UI primitives
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { Loader2, Wrench, BarChart3, AlertTriangle, Truck, Wallet, Package, FileText } from "lucide-react";

// Lazy-Loaded Enterprise Page Bundles for Code Splitting & Performance Optimization
const ServiceJobForm = React.lazy(() => import("@/pages/ServiceJobForm"));
const Reports = React.lazy(() => import("@/pages/Reports"));
const RevenueExpenses = React.lazy(() => import("@/pages/RevenueExpenses"));
const Delivery = React.lazy(() => import("@/pages/Delivery"));
const Stock = React.lazy(() => import("@/pages/Stock"));
const InvoiceList = React.lazy(() => import("@/pages/InvoiceList"));
const Invoice = React.lazy(() => import("@/pages/Invoice"));

// 1. Initialize High-Performance Query Ingestion Cache
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 30, // 30 seconds global stale threshold
      refetchOnWindowFocus: false,
    },
  },
});


// ============================================================================
// APP ROOT WRAPPER LAYER WITH CORE NAVIGATION FRAMEWORK
// ============================================================================
function AppLayout() {
  const { profile } = useAuth();
  const currentYear = new Date().getFullYear(); // Resolves to 2026 natively

  return (
    <div className="flex min-h-screen bg-mesh-gradient font-sans antialiased text-slate-900 dark:text-zinc-50 print:block print:min-h-0 print:bg-white print:p-0 print:m-0">
      {/* APP SIDEBAR NAVIGATION AXIS */}
      <aside className="w-64 border-r border-white/40 dark:border-zinc-800/40 bg-white/40 dark:bg-zinc-950/40 backdrop-blur-xl flex flex-col justify-between p-4 shrink-0 select-none shadow-sm z-10 print:hidden">
        <div className="space-y-6">
          <div className="px-2 py-1.5 border-b border-dashed border-slate-100 dark:border-zinc-900 flex items-center gap-2.5">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-md">N</div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-tight">NTCS ERP Dashboard</h3>
              <p className="text-[10px] text-muted-foreground font-medium">Dashboard • {currentYear}</p>
            </div>
          </div>

          <nav className="space-y-1">
            <SidebarLink to="/" icon={<Wrench className="w-4 h-4" />} label="New Job / Billing" />
            <SidebarLink to="/delivery" icon={<Truck className="w-4 h-4" />} label="Delivery" />
            <SidebarLink to="/stock" icon={<Package className="w-4 h-4" />} label="Stock" />
            <SidebarLink to="/reports" icon={<BarChart3 className="w-4 h-4" />} label="Reports" />
            <SidebarLink to="/revenue" icon={<Wallet className="w-4 h-4" />} label="Revenue & Exp." />
            <SidebarLink to="/invoice" icon={<FileText className="w-4 h-4" />} label="Invoice" />
          </nav>
        </div>

        {/* CURRENT OPERATOR DECK PROFILE SUMMARY */}
        <div className="border-t border-slate-100 dark:border-zinc-900 pt-4 px-2 space-y-2">
          <div className="flex flex-col">
            <span className="text-xs font-bold truncate max-w-[200px]">{profile?.full_name || "User"}</span>
            <span className="text-[9px] uppercase font-mono tracking-wider text-muted-foreground bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm px-1.5 py-0.5 rounded w-max mt-1 border border-white/40 dark:border-zinc-800/50">
              Role: {profile?.role || "Staff"}
            </span>
          </div>
        </div>
      </aside>

      {/* CORE VIEW LAYER SHEET CONTAINER */}
      <main className="flex-1 overflow-y-auto print:overflow-visible print:w-full print:h-auto print:p-0 print:m-0 print:static">
        <Suspense fallback={<GlobalLoadingSpinner message="Loading..." />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}

// Helper atomic navigation item component wrapper
function SidebarLink({ to, icon, label, allowedRoles }: { to: string; icon: React.ReactNode; label: string; allowedRoles?: ("Admin" | "Staff")[] }) {
  const { profile } = useAuth();
  const location = useLocation();
  const isActive = to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

  if (allowedRoles && profile?.role && !allowedRoles.includes(profile.role)) return null;

  return (
    <a 
      href={to} 
      onClick={(e) => { e.preventDefault(); window.history.pushState({}, "", to); window.dispatchEvent(new PopStateEvent("popstate")); }}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 ${
        isActive 
          ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 font-bold" 
          : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900/60"
      }`}
    >
      {icon}
      <span>{label}</span>
    </a>
  );
}

// ============================================================================
// ROUTING TOPOLOGY DECLARATIONS
// ============================================================================
const systemRouterTopology = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    errorElement: <GlobalErrorBoundary />,
    children: [
      { index: true, element: <ServiceJobForm /> },
      { path: "edit-job/:id", element: <ServiceJobForm /> },
      { path: "delivery", element: <Delivery /> },
      { path: "stock", element: <Stock /> },
      { path: "reports", element: <Reports /> },
      { path: "revenue", element: <RevenueExpenses /> },
      { path: "invoice", element: <InvoiceList /> },
      { path: "invoice/:id", element: <Invoice /> },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);

// ============================================================================
// ROOT BOOTSTRAP EXPORT PANEL ENTRYPOINT
// ============================================================================
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={systemRouterTopology} />
      </AuthProvider>
      <Toaster />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

// ============================================================================
// AUXILIARY LAYOUT FALLBACK TERMINALS
// ============================================================================
function GlobalLoadingSpinner({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-3 font-sans select-none">
      <Loader2 className="w-6 h-6 animate-spin text-blue-600 stroke-[2.5]" />
      <p className="text-xs font-mono text-muted-foreground tracking-wide">{message}</p>
    </div>
  );
}


function GlobalErrorBoundary() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950 p-4 font-sans">
      <div className="max-w-md w-full text-center space-y-4 bg-white dark:bg-zinc-900 p-8 rounded-2xl shadow-xl border border-rose-100 dark:border-rose-900/30">
        <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-500 rounded-full flex items-center justify-center mx-auto mb-2 shadow-inner">
          <AlertTriangle className="w-8 h-8 stroke-[2.5]" />
        </div>
        <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-zinc-50">Something went wrong</h2>
        <p className="text-xs text-muted-foreground font-medium leading-relaxed">
          An unexpected error occurred while rendering this page. 
          Our automated systems have logged the issue.
        </p>
        <Button onClick={() => window.location.reload()} className="mt-4 font-bold bg-slate-900 hover:bg-slate-800 text-white w-full rounded-xl shadow-lg">
          Reload Page
        </Button>
        <Button variant="ghost" onClick={() => window.location.href = "/"} className="text-xs font-semibold w-full mt-2">
          Return Home
        </Button>
      </div>
    </div>
  );
}