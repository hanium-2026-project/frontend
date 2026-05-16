import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Layout } from "./components/Layout";
import { DashboardPage } from "./pages/DashboardPage";
import { ParkingMapPage } from "./pages/ParkingMapPage";
import { RoutePage } from "./pages/RoutePage";
import { SimulationPage } from "./pages/SimulationPage";
import { VehiclesPage } from "./pages/VehiclesPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "map", element: <ParkingMapPage /> },
      { path: "vehicles", element: <VehiclesPage /> },
      { path: "simulation", element: <SimulationPage /> },
      { path: "routes", element: <RoutePage /> }
    ]
  }
]);

export function App() {
  return <RouterProvider router={router} />;
}
