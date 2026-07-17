import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { prefetchAll } from "./api";
import "./index.css";

// Warm all analytics endpoints once at boot — every page then paints
// instantly from cache (stale-while-revalidate) instead of showing loaders.
prefetchAll();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
