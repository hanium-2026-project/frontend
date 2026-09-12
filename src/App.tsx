import { DashboardPage } from "./pages/DashboardPage";

/**
 * 다크 모니터링 대시보드 한 화면 앱.
 * 이전엔 사이드바 + 라우터로 다중 페이지였지만, CV(추적/탐지)와 무관한
 * 옛 페이지들(VehiclesPage, ParkingMapPage, RoutePage, SimulationPage)을 정리하고
 * 단일 페이지로 단순화했다.
 *
 * react-router-dom 의존성은 package.json에 그대로 두어 미래 페이지 추가 시 곧바로 사용 가능.
 */
export function App() {
  return <DashboardPage />;
}
