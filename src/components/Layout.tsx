import { Outlet, useLocation, useNavigate } from "react-router-dom";

/**
 * 새 디자인 기준: 메인 대시보드는 자체 Topbar를 가진 풀 화면.
 * 다른 페이지(Map/Vehicles/Simulation/Routes)는 상단 미니 nav만 두고
 * 대시보드로 돌아갈 수 있는 경로만 제공한다.
 */
const SUB_NAV = [
  { to: "/map", label: "지도" },
  { to: "/vehicles", label: "차량" },
  { to: "/simulation", label: "입출차" },
  { to: "/routes", label: "경로" },
];

export function Layout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isRoot = pathname === "/";

  return (
    <div className="app-shell">
      <main className="main-content">
        {!isRoot && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 14px",
              borderBottom: "0.5px solid var(--border)",
              background: "var(--bg-1)",
            }}
          >
            <button
              type="button"
              className="secondary-button"
              style={{ minHeight: 28, padding: "0 10px", fontSize: 12 }}
              onClick={() => navigate("/")}
            >
              ← 대시보드
            </button>
            <nav style={{ display: "flex", gap: 6, marginLeft: 8 }}>
              {SUB_NAV.map((n) => (
                <button
                  key={n.to}
                  type="button"
                  className={`fb ${pathname.startsWith(n.to) ? "act" : ""}`}
                  onClick={() => navigate(n.to)}
                >
                  {n.label}
                </button>
              ))}
            </nav>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
