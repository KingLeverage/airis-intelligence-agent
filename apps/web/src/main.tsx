import { createRoot } from "react-dom/client";
import { AppProviders } from "./app/providers";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <AppProviders>
    <App />
  </AppProviders>,
);
