import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Wrench,
  Truck,
  Package,
  FileText,
  BarChart3,
  Wallet,
  Users,
  LogOut,
  X,
  Laptop,
  Radio,
  Plus
} from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { profile, signOut } = useAuth();
  const location = useLocation();

  const navSections = [
    {
      title: "Core Operations",
      items: [
        {
          name: "Dashboard",
          path: "/",
          icon: LayoutDashboard,
          badge: "Cockpit"
        },
        {
          name: "New Job / Billing",
          path: "/jobs",
          icon: Wrench,
          isAction: true
        },
        {
          name: "Delivery & Handover",
          path: "/delivery",
          icon: Truck
        }
      ]
    },
    {
      title: "Inventory & Invoicing",
      items: [
        {
          name: "Stock Management",
          path: "/stock",
          icon: Package
        },
        {
          name: "Invoices",
          path: "/invoice",
          icon: FileText
        }
      ]
    },
    {
      title: "Finance & Insights",
      items: [
        {
          name: "Daily Cash Ledger",
          path: "/revenue",
          icon: Wallet
        },
        {
          name: "Staff Salary & Payroll",
          path: "/salary",
          icon: Users,
          badge: "Monthly Report"
        },
        {
          name: "Reports & Analytics",
          path: "/reports",
          icon: BarChart3
        }
      ]
    }
  ];

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Main Sidebar Shell */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col justify-between border-r border-border/80 bg-card/95 backdrop-blur-2xl p-4 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 select-none print:hidden ${
          isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        <div className="space-y-6">
          {/* Logo Brand Header */}
          <div className="flex items-center justify-between px-2 pt-1">
            <NavLink
              to="/"
              onClick={onClose}
              className="flex items-center gap-2.5 group"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 group-hover:scale-105 transition-transform">
                <Laptop className="w-5 h-5 stroke-[2.3]" />
              </div>
              <div className="flex flex-col">
                <span className="font-black tracking-tight text-sm text-foreground flex items-center gap-1.5">
                  NTCS <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">ERP</span>
                </span>
                <span className="text-[10px] font-medium text-muted-foreground tracking-tight flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Service Centre
                </span>
              </div>
            </NavLink>

            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              className="h-8 w-8 text-muted-foreground lg:hidden"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Live Sync Status Bar */}
          <div className="mx-1 px-3 py-1.5 rounded-lg bg-muted/60 border border-border/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
              <span className="text-[11px] font-semibold text-muted-foreground">Supabase Live</span>
            </div>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold">
              ACTIVE
            </span>
          </div>

          {/* Grouped Nav Items */}
          <nav className="space-y-4">
            {navSections.map((section) => (
              <div key={section.title} className="space-y-1">
                <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                  {section.title}
                </p>
                {section.items.map((item) => {
                  const Icon = item.icon;
                  // Handle exact root match vs subpath matches
                  const isActive =
                    item.path === "/"
                      ? location.pathname === "/"
                      : location.pathname === item.path ||
                        location.pathname.startsWith(`${item.path}/`) ||
                        (item.path === "/jobs" && location.pathname.startsWith("/edit-job/"));

                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={onClose}
                      className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold tracking-tight transition-all duration-150 ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 font-bold"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon
                          className={`w-4 h-4 stroke-[2.2] transition-transform group-hover:scale-110 ${
                            isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                          }`}
                        />
                        <span>{item.name}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                            isActive
                              ? "bg-white/20 text-white"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                      {item.isAction && !isActive && (
                        <span className="text-muted-foreground/40 group-hover:text-muted-foreground">
                          <Plus className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Operator Profile Bottom Card */}
        <div className="space-y-3 pt-3 border-t border-border/80">
          <div className="flex items-center gap-2.5 px-2 py-1">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-xs shadow-sm">
              {profile?.full_name?.charAt(0) || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-foreground truncate">
                {profile?.full_name || "Operator"}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[9px] font-mono font-semibold uppercase px-1.5 py-0.2 rounded bg-primary/10 text-primary border border-primary/20">
                  {profile?.role || "Admin"}
                </span>
                <span className="text-[10px] text-muted-foreground truncate">Singanallur</span>
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            onClick={() => signOut()}
            className="w-full h-8 justify-start gap-2.5 text-xs font-semibold text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg px-2"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </Button>
        </div>
      </aside>
    </>
  );
};