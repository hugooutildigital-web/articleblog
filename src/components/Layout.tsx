import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, FileText, CalendarDays, Globe, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Tableau de bord" },
  { to: "/articles", icon: FileText, label: "Articles" },
  { to: "/scheduler", icon: CalendarDays, label: "Planificateur" },
  { to: "/sites", icon: Globe, label: "Sites" },
];

const Layout = () => {
  return (
    <div className="flex h-screen overflow-hidden bg-background bg-grid">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-border bg-sidebar flex flex-col">
        <div className="p-6 border-b border-border">
          <h1 className="font-display text-xl font-bold tracking-tight">
            <span className="text-primary">Blog</span>
            <span className="text-foreground">Flow</span>
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">automation engine</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-200 ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-border">
          <NavLink to="/new-article">
            <Button variant="emerald" className="w-full gap-2">
              <Plus className="w-4 h-4" />
              Nouvel Article
            </Button>
          </NavLink>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
