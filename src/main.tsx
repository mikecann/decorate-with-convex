import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import "./index.css";
import App from "./App";
import { RouteProvider } from "./routes";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

// Set --vh to 1% of the viewport height for mobile-safe full height
function setVh() {
  document.documentElement.style.setProperty(
    "--vh",
    `${window.innerHeight * 0.01}px`
  );
}
window.addEventListener("resize", setVh);
setVh();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexAuthProvider client={convex}>
      <RouteProvider>
        <App />
      </RouteProvider>
    </ConvexAuthProvider>
  </StrictMode>
);
