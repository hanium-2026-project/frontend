import { Car, LayoutDashboard, Map, Navigation, Route, Settings } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/", label: "대시보드", icon: LayoutDashboard },
  { to: "/map", label: "지도", icon: Map },
  { to: "/vehicles", label: "차량", icon: Car },
  { to: "/simulation", label: "입출차", icon: Settings },
  { to: "/routes", label: "경로", icon: Route }
];

export function Layout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Navigation aria-hidden="true" size={24} />
          <div>
            <strong>Hanium Parking</strong>
            <span>관제 MVP</span>
          </div>
        </div>
        <nav>
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => (isActive ? "active" : "")}>
              <Icon aria-hidden="true" size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
