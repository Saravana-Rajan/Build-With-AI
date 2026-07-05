import { createBrowserRouter, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import IntakeFeed from "./screens/IntakeFeed";
import Priorities from "./screens/Priorities";
import ConstituencyXRay from "./screens/ConstituencyXRay";
import Act from "./screens/Act";
import ForgottenVillages from "./screens/ForgottenVillages";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      // Constituency X-Ray is the hero — land there by default.
      { index: true, element: <Navigate to="/x-ray" replace /> },
      { path: "intake", element: <IntakeFeed /> },
      { path: "priorities", element: <Priorities /> },
      { path: "x-ray", element: <ConstituencyXRay /> },
      { path: "act", element: <Act /> },
      { path: "forgotten", element: <ForgottenVillages /> },
      { path: "*", element: <Navigate to="/x-ray" replace /> },
    ],
  },
]);
