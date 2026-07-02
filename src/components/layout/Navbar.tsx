import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Search, 
  Bell, 
  User as UserIcon, 
  LogOut, 
  Shield, 
  Command,
  MonitorCheck
} from "lucide-react";

interface NavbarProps {
  onMobileMenuToggle: () => void;
}

export const Navbar: React.FC<NavbarProps> = () => {
  const { user, profile, signOut } = useAuth();
  const [searchFocused, setSearchFocused] = useState(false);

  // Keyboard shortcut listener for global search focus (CMD/CTRL + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("global-search-input")?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <header className="h-14 border-b border-slate-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/40 backdrop-blur-md px-6 flex items-center justify-between shrink-0 sticky top-0 z-30">
      
      {/* LEFT SIDE: SEARCH COCKPIT ENTRY */}
      <div className="flex-1 max-w-md hidden sm:block">
        <div className={`relative transition-all duration-200 rounded-lg ${searchFocused ? "ring-1 ring-blue-500/50" : ""}`}>
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/50" />
          <Input
            id="global-search-input"
            type="search"
            placeholder="Search tickets, clients, assets..."
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="pl-9 pr-12 bg-slate-50 dark:bg-zinc-950/60 border-slate-200 dark:border-zinc-800 focus-visible:ring-0 shadow-none h-9 text-xs"
          />
          <div className="absolute right-3 top-2 flex items-center gap-0.5 text-[10px] font-mono text-muted-foreground/60 bg-white dark:bg-zinc-900 border px-1.5 py-0.5 rounded pointer-events-none shadow-sm">
            <Command className="w-2.5 h-2.5 opacity-70" />
            <span>K</span>
          </div>
        </div>
      </div>

      {/* MOBILE HEADER ALIGNMENT ADJUSTMENT */}
      <div className="sm:hidden flex items-center gap-2">
        <MonitorCheck className="w-4 h-4 text-blue-600" />
        <span className="font-bold text-xs tracking-tight dark:text-zinc-200">WORKBENCH MGR</span>
      </div>

      {/* RIGHT SIDE: PROFILE & SYSTEMS TRIGGER ALIGNMENTS */}
      <div className="flex items-center gap-4 ml-auto">
        
        {/* ACTION DECK: METRIC ALERTS MONITOR */}
        <Button size="icon" variant="ghost" className="relative h-9 w-9 text-muted-foreground hover:text-foreground">
          <Bell className="w-4 h-4 stroke-[2.2]" />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-rose-500 rounded-full ring-2 ring-white dark:ring-zinc-900" />
        </Button>

        <div className="h-4 w-px bg-slate-200 dark:bg-zinc-800" />

        {/* DROP MENU LAYER: AUTHENTICATED USER MATRICES */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 px-2 gap-2 hover:bg-slate-100 dark:hover:bg-zinc-800/60 rounded-lg">
              <div className="h-6 w-6 rounded-full bg-blue-600/10 text-blue-600 flex items-center justify-center border border-blue-500/20">
                <UserIcon className="w-3.5 h-3.5" />
              </div>
              <div className="text-left hidden md:block max-w-[100px]">
                <p className="text-xs font-bold leading-none text-foreground truncate">{profile?.full_name || "Operator"}</p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          
          <DropdownMenuContent className="w-56 mt-1 border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl rounded-xl" align="end">
            <DropdownMenuLabel className="p-3">
              <div className="flex flex-col space-y-1">
                <p className="text-xs font-bold text-foreground">{profile?.full_name}</p>
                <p className="text-[10px] font-mono text-muted-foreground truncate">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-100 dark:bg-zinc-900" />
            
            <DropdownMenuItem className="text-xs font-medium p-2.5 gap-2.5 focus:bg-slate-50 dark:focus:bg-zinc-900 cursor-default">
              <Shield className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Access Level: <span className="font-bold text-blue-600">{profile?.role || "Staff"}</span></span>
            </DropdownMenuItem>
            
            <DropdownMenuSeparator className="bg-slate-100 dark:bg-zinc-900" />
            <DropdownMenuItem 
              onClick={() => signOut()}
              className="text-xs font-semibold p-2.5 gap-2.5 text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/20 focus:text-rose-600 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out Workstation</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};