import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { 
  Search, 
  Menu, 
  Plus, 
  Calendar,
  Command
} from "lucide-react";

interface NavbarProps {
  onMobileMenuToggle: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onMobileMenuToggle }) => {
  const navigate = useNavigate();
  const [searchVal, setSearchVal] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  // Today's formatted date string
  const todayFormatted = new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  });

  // Global search shortcut (Ctrl/Cmd + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("navbar-global-search")?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchVal.trim()) return;
    // Navigate to reports or delivery with query
    navigate(`/reports?q=${encodeURIComponent(searchVal.trim())}`);
  };

  return (
    <header className="cockpit-header h-14 px-4 sm:px-6 flex items-center justify-between shrink-0 select-none print:hidden">
      {/* Left: Mobile Toggle & Quick Search */}
      <div className="flex items-center gap-3 flex-1 max-w-lg">
        <Button
          size="icon"
          variant="ghost"
          onClick={onMobileMenuToggle}
          className="h-9 w-9 lg:hidden text-muted-foreground hover:text-foreground"
        >
          <Menu className="w-5 h-5" />
        </Button>

        <form onSubmit={handleSearchSubmit} className="relative flex-1 hidden sm:block">
          <div
            className={`relative flex items-center rounded-xl transition-all duration-200 ${
              searchFocused
                ? "ring-2 ring-primary/40 bg-card shadow-sm"
                : "bg-muted/50 hover:bg-muted/80"
            }`}
          >
            <Search className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              id="navbar-global-search"
              type="search"
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search by Bill No, Customer, Phone, or IMEI..."
              className="pl-9 pr-14 h-9 text-xs bg-transparent border-0 focus-visible:ring-0 shadow-none text-foreground placeholder:text-muted-foreground/70"
            />
            <div className="absolute right-2.5 flex items-center gap-0.5 text-[10px] font-mono text-muted-foreground bg-background/80 border border-border/80 px-1.5 py-0.5 rounded shadow-xs pointer-events-none">
              <Command className="w-2.5 h-2.5 opacity-60" />
              <span>K</span>
            </div>
          </div>
        </form>
      </div>

      {/* Right Action Toolbar */}
      <div className="flex items-center gap-2.5 sm:gap-3 ml-auto">
        {/* Date Display Badge */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/50 border border-border/60 text-xs font-medium text-muted-foreground">
          <Calendar className="w-3.5 h-3.5 text-primary" />
          <span>{todayFormatted}</span>
        </div>

        {/* Quick New Ticket Action Button */}
        <Button
          size="sm"
          onClick={() => navigate("/jobs")}
          className="h-9 px-3.5 text-xs font-bold gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-500/20 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span className="hidden sm:inline">New Service Ticket</span>
          <span className="sm:hidden">New</span>
        </Button>

        <div className="h-4 w-px bg-border/80 mx-0.5" />

        {/* Theme Toggle (Dark / Light) */}
        <ThemeToggle />
      </div>
    </header>
  );
};