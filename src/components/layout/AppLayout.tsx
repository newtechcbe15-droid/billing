import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";

export const AppLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-cockpit-grid font-sans antialiased text-foreground print:block print:h-auto print:bg-white">
      {/* Dynamic Master Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Primary Cockpit Content Channel */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden print:overflow-visible print:h-auto">
        {/* Master Global Navigation Header */}
        <Navbar onMobileMenuToggle={() => setSidebarOpen((prev) => !prev)} />

        {/* Dynamic Route Viewport */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 print:overflow-visible print:p-0 print:m-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};