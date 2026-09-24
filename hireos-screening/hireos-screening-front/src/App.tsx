import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { useOpenTaskCount } from "./features/tasks/useOpenTaskCount";
import { TasksPage } from "./pages/TasksPage";
import { LibraryPage } from "./pages/LibraryPage";
import { ImportPage } from "./pages/ImportPage";
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
import { FilesPage } from "./pages/FilesPage";
import { PreferencesPage } from "./pages/PreferencesPage";
import { AiModelsPage } from "./pages/AiModelsPage";

export default function App() {
  const openTaskCount = useOpenTaskCount();

  return (
    <AppShell openTaskCount={openTaskCount}>
      <Routes>
        <Route path="/" element={<Navigate to="/tasks" replace />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/imports/new" element={<ImportPage />} />
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
        <Route path="/files" element={<FilesPage />} />
        <Route path="/settings/preferences" element={<PreferencesPage />} />
        <Route path="/settings/ai-models" element={<AiModelsPage />} />
        <Route path="*" element={<Navigate to="/tasks" replace />} />
      </Routes>
    </AppShell>
  );
}
