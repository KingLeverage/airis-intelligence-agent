import { AppRoutes } from "./app/router";
import { NativeBrowserBridge } from "./features/native-browser-bridge/NativeBrowserBridge";

export default function App() {
  return (
    <>
      <NativeBrowserBridge />
      <AppRoutes />
    </>
  );
}
