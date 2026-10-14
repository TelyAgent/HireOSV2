import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { LibraryPage } from "./pages/LibraryPage";
import { DuplicateDetailPage } from "./pages/DuplicateDetailPage";
import { CandidateProfilePage } from "./pages/CandidateProfilePage";
import { JobRecommendationsPage } from "./pages/JobRecommendationsPage";
import { JobsListPage } from "./pages/JobsListPage";
import { JobCriteriaPage } from "./pages/JobCriteriaPage";
import { ScreeningWorkspacePage } from "./pages/ScreeningWorkspacePage";
import { ScreeningDetailPage } from "./pages/ScreeningDetailPage";
import { DecisionPage } from "./pages/DecisionPage";
import { ComparePage } from "./pages/ComparePage";
import { DeliveriesListPage } from "./pages/DeliveriesListPage";
import { DeliveryDetailPage } from "./pages/DeliveryDetailPage";
import { SettingsPage } from "./pages/SettingsPage";
import { NotFoundPage } from "./pages/NotFoundPage";

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/jobs" replace />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/imports/new" element={<Navigate to="/library" replace />} />
        <Route path="/duplicates/:id" element={<DuplicateDetailPage />} />
        <Route path="/candidates/:id" element={<CandidateProfilePage />} />
        <Route path="/candidates/:id/jobs" element={<JobRecommendationsPage />} />
        <Route path="/jobs" element={<JobsListPage />} />
        <Route path="/jobs/:id/criteria" element={<JobCriteriaPage />} />
        <Route path="/jobs/:id/screening" element={<ScreeningWorkspacePage />} />
        <Route path="/applications/:id" element={<ScreeningDetailPage />} />
        <Route path="/applications/:id/decision" element={<DecisionPage />} />
        <Route path="/comparisons/:id" element={<ComparePage />} />
        <Route path="/deliveries" element={<DeliveriesListPage />} />
        <Route path="/deliveries/:id" element={<DeliveryDetailPage />} />
        <Route path="/settings" element={<Navigate to="/settings/profile" replace />} />
        <Route path="/settings/:section" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  );
}
