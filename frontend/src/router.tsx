import { createBrowserRouter, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./screens/Dashboard";
import IntakeFeed from "./screens/IntakeFeed";
import Priorities from "./screens/Priorities";
import ConstituencyXRay from "./screens/ConstituencyXRay";
import Departments from "./screens/Departments";
import Act from "./screens/Act";
import ForgottenVillages from "./screens/ForgottenVillages";
import AskSarvik from "./screens/AskSarvik";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      // Dashboard home is the default landing screen.
      { index: true, element: <Dashboard /> },
      { path: "intake", element: <IntakeFeed /> },
      { path: "priorities", element: <Priorities /> },
      { path: "x-ray", element: <ConstituencyXRay /> },
      { path: "departments", element: <Departments /> },
      { path: "act", element: <Act /> },
      { path: "forgotten", element: <ForgottenVillages /> },
      { path: "ask", element: <AskSarvik /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
