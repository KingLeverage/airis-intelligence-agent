import { Navigate, Route, Routes } from "react-router-dom";
import { WorkspacePage } from "../../features/shell/WorkspacePage";
import { RecoveryPage } from "../../features/admin/RecoveryPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<WorkspacePage />} />
      <Route path="/admin/recovery" element={<RecoveryPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
