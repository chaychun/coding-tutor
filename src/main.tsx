import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import { DevBranchTag } from "@/components/DevBranchTag";
import { ThemeProvider } from "@/components/theme-provider";
import { SidebarProvider } from "@/components/ui/sidebar";
import { CredentialProvider } from "@/hooks/useCredentialStatus";
import { initSidecar } from "@/lib/sidecar";
import Home from "@/pages/Home";
import SessionPage from "@/pages/SessionPage";
import "@/app/globals.css";

// Mark Tauri mode on <html> so CSS can add traffic-light inset
if (window.__TAURI_INTERNALS__) {
  document.documentElement.dataset.tauri = "";
}

// Initialize sidecar connection before rendering.
// In Tauri, this fetches the port + auth token from the Rust core via invoke().
// In dev mode (no Tauri), it falls back to localhost:3001 defaults.
initSidecar().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ThemeProvider>
        <CredentialProvider>
          <DevBranchTag />
          <BrowserRouter>
            <Routes>
              <Route
                path="/"
                element={
                  <SidebarProvider>
                    <Home />
                  </SidebarProvider>
                }
              />
              <Route path="/projects/:projectId/sessions/:sessionId" element={<SessionPage />} />
            </Routes>
          </BrowserRouter>
        </CredentialProvider>
      </ThemeProvider>
    </StrictMode>
  );
});
