import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Wrench,
  Users,
  FileText,
  Settings,
  LogOut,
  X,
  ShieldCheck,
  Laptop
} from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  // Optional badges payload representing real-time metric tracking updates from backend triggers
  workflowBadges?: {
    jobsActive?: number;
    warrantiesExpiring?: number;
  };
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, 
  onClose,
  workflowBadges = { jobsActive: 0, warrantiesExpiring: 0 }
}) => {
  const { profile, signOut, isAdmin } = useAuth();
  const location = useLocation();

  // Declarative design model mapping application layout navigation structures
  const navigationRoutes = [
    {
      name: "Dashboard Cockpit",
      path: "/",
      icon: LayoutDashboard,
      access: true,
      badge: null
    },
    {
      name: "Service Job Operations",
      path: "/jobs",
      icon: Wrench,
      access: true,
      badge: workflowBadges?.jobsActive && workflowBadges.jobsActive > 0 ? {
        text: workflowBadges.jobsActive.toString(),
        variant: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50"
      } : null
    },
    {
      name: "Customer Profiles",
      path: "/customers",
      icon: Users,
      access: true,
      badge: null
    },
    {
      name: "Ledgers & Reports",
      path: "/reports",
      icon: FileText,
      access: isAdmin,
      badge: workflowBadges?.warrantiesExpiring && workflowBadges.warrantiesExpiring > 0 ? {
        text: "Alert",
        variant: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 animate-pulse"
      } : null
    },
    {
      name: "System Settings",
      path: "/settings",
      icon: Settings,
      access: isAdmin,
      badge: null
    }
  ];

  const isRouteActive = (path: string) => location.pathname === path;

  return (
    <>
      {/* MOBILE DRAWER MASK TRANSITION FILTER */}
      <div
        className={`fixed inset-0 z-40 bg-zinc-950/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* CORE NAVIGATION COLUMN ARCHITECTURE CONTAINER */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-64 transform flex-col justify-between border-r border-slate-200 bg-white p-5 transition-transform duration-300 ease-in-out dark:border-zinc-800 dark:bg-zinc-900/80 backdrop-blur-md lg:static lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="space-y-6">
          {/* LOGO AND COLLAPSE ACTION DECK */}
          <div className="flex items-center justify-between">
            <Link to="/" onClick={onClose} className="flex items-center gap-2.5 font-black tracking-tighter text-lg uppercase">
              <div className="p-1.5 rounded-lg bg-blue-600 text-white shadow-sm shadow-blue-500/20">
                <Laptop className="w-5 h-5 stroke-[2.5]" />
              </div>
              <span className="text-slate-900 dark:text-zinc-50">
                NTCS <span className="text-blue-600">ERP</span>
              </span>
            </Link>
            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              className="h-8 w-8 text-muted-foreground hover:text-foreground lg:hidden"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* APP LINK NAV CONTAINER ARRAY */}
          <nav className="space-y-1">
            {navigationRoutes.map((route) => {
              if (!route.access) return null;
              const IconComponent = route.icon;
              const active = isRouteActive(route.path);

              return (
                <Link
                  key={route.path}
                  to={route.path}
                  onClick={onClose}
                  className={`group flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-150 ${
                    active
                      ? "bg-blue-50 text-blue-600 shadow-sm dark:bg-blue-950/30 dark:text-blue-400 font-bold"
                      : "text-muted-foreground hover:bg-slate-100 hover:text-foreground dark:hover:bg-zinc-800/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <IconComponent
                      className={`w-4 h-4 stroke-[2.2] transition-colors ${
                        active ? "text-blue-600 dark:text-blue-400" : "opacity-70 group-hover:text-foreground"
                      }`}
                    />
                    <span>{route.name}</span>
                  </div>

                  {/* RENDER APP DESIGN BADGE MATRIX */}
                  {route.badge && (
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md ${route.badge.variant}`}>
                      {route.badge.text}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* WORKSTATION IDENTITY CRADLE FOOTER MODULE */}
        <div className="space-y-3 border-t border-slate-100 pt-4 dark:border-zinc-800">
          <div className="flex items-center gap-3 px-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="flex-1 truncate">
              <p className="truncate text-xs font-bold text-foreground/90">{profile?.full_name || "Operator Session"}</p>
              <span className="mt-0.5 inline-flex items-center rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground dark:bg-zinc-800 border dark:border-zinc-700">
                {profile?.role || "Staff"}
              </span>
            </div>
          </div>

          <Button
            variant="ghost"
            onClick={() => signOut()}
            className="h-10 w-full justify-start gap-3 rounded-lg px-3 text-xs font-semibold tracking-wide text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/20"
          >
            <LogOut className="w-4 h-4 stroke-[2.2]" />
            Exit Workstation
          </Button>
        </div>
      </aside>
    </>
  );
};