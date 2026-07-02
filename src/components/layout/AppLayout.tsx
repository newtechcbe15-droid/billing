import React, { useState } from "react";
import { Navigate, Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";
import { 
  LayoutDashboard, 
  Wrench, 
  Users, 
  FileText, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  User as UserIcon,
  Laptop
} from "lucide-react";

export const AppLayout: React.FC = () => {
  const { user, profile, loading, signOut, isAdmin } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // 1. Session state hydration gate guard
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-zinc-950 gap-3">
        <Laptop className="h-8 w-8 animate-bounce text-blue-600" />
        <p className="text-xs font-mono tracking-widest text-muted-foreground animate-pulse uppercase">
          Verifying secure authorization clearance...
        </p>
      </div>
    );
  }

  // 2. Strict unauthenticated state fallbacks
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Pure path configuration matrix with role checking
  const navigationItems = [
    { name: "Dashboard Cockpit", path: "/", icon: LayoutDashboard, access: true },
    { name: "Service Tickets", path: "/jobs", icon: Wrench, access: true },
    { name: "Customer Profiles", path: "/customers", icon: Users, access: true },
    { name: "Financial Ledger & Reports", path: "/reports", icon: FileText, access: isAdmin },
    { name: "System Settings", path: "/settings", icon: Settings, access: isAdmin },
  ];

  const activeNavItem = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-zinc-950 font-sans transition-colors duration-200">
      
      {/* MOBILE BACKDROP DRAWER FILTER LAYER */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-zinc-950/40 backdrop-blur-sm lg:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR VIEW ASSEMBLY CONTAINER */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 border-r border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 backdrop-blur-md flex flex-col justify-between p-5 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:h-screen
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <div className="space-y-6">
          {/* CORE HEADER SEGMENT */}
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2.5 font-black tracking-tighter text-lg uppercase">
              <div className="p-1.5 rounded-lg bg-blue-600 text-white">
                <Laptop className="w-5 h-5 stroke-[2.5]" />
              </div>
              <span className="text-slate-900 dark:text-zinc-50">NTCS <span className="text-blue-600">ERP</span></span>
            </Link>
            <Button size="icon" variant="ghost" onClick={() => setSidebarOpen(false)} className="lg:hidden h-8 w-8">
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* DYNAMIC NAVIGATION LINKS ARRAY */}
          <nav className="space-y-1">
            {navigationItems.map((item) => {
              if (!item.access) return null;
              const Icon = item.icon;
              const active = activeNavItem(item.path);

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-150 relative
                    ${active 
                      ? "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 font-bold shadow-sm" 
                      : "text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-zinc-800/50"}
                  `}
                >
                  <Icon className={`w-4 h-4 stroke-[2.2] ${active ? "text-blue-600 dark:text-blue-400" : "opacity-70"}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* LOGGED CONTEXT CRADLE FOOTER LAYER */}
        <div className="border-t border-slate-100 dark:border-zinc-800 pt-4 space-y-3">
          <div className="flex items-center gap-3 px-2">
            <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-muted-foreground border border-border">
              <UserIcon className="w-4 h-4" />
            </div>
            <div className="truncate flex-1">
              <p className="text-xs font-bold text-foreground/90 truncate">{profile?.full_name || user?.email}</p>
              <span className="inline-flex items-center text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 border text-muted-foreground mt-0.5">
                {profile?.role || "Staff Operator"}
              </span>
            </div>
          </div>
          <Button 
            variant="ghost" 
            onClick={signOut}
            className="w-full justify-start text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-xs font-semibold tracking-wide gap-3 h-10 px-3 rounded-lg"
          >
            <LogOut className="w-4 h-4 stroke-[2.2]" />
            Terminate Session
          </Button>
        </div>
      </aside>

      {/* VIEWPORT CONTENT AXIS WRAPPER */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        
        {/* VIEWPORT GLOBAL NAVBAR ACTION DECK */}
        <header className="h-14 border-b border-slate-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/40 backdrop-blur-md px-6 flex items-center justify-between shrink-0 lg:justify-end">
          <Button size="icon" variant="ghost" onClick={() => setSidebarOpen(true)} className="lg:hidden h-9 w-9">
            <Menu className="w-5 h-5 text-muted-foreground" />
          </Button>
          
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-mono opacity-40 hidden sm:inline select-none">
              SECURE INDEX: WORKSTATION_ACTIVE
            </span>
          </div>
        </header>

        {/* CENTRAL ROUTER OUTPUT VIEWPORT CHANNEL */}
        <main className="flex-1 overflow-y-auto focus:outline-none">
          <Outlet />
        </main>
      </div>

      <Toaster />
    </div>
  );
};