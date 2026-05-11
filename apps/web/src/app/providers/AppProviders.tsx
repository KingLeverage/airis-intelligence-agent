import type { ReactNode } from "react";
import { StrictMode } from "react";
import { BrowserRouter } from "react-router-dom";

/** Root providers — add theme/query clients here as the app grows */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <StrictMode>
      <BrowserRouter>{children}</BrowserRouter>
    </StrictMode>
  );
}
