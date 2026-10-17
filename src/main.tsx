import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "next-themes";
import { ErrorBoundary, ErrorWatch } from "@/components/error-boundary";
import App from "./App";
import { ToastProvider, Toaster } from "@/components/ui/Toast";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { toastManager } from "@/lib/errors";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ToastProvider toastManager={toastManager}>
        <TooltipProvider>
          <ErrorWatch />
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
          <Toaster />
        </TooltipProvider>
      </ToastProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
