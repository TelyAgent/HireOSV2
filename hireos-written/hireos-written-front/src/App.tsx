import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { useOpenTaskCount } from "./features/useOpenTaskCount";
import { TasksPage } from "./pages/TasksPage";
import { QuestionBankPage } from "./pages/QuestionBankPage";
import { QuestionDetailPage } from "./pages/QuestionDetailPage";
import { BuilderPage } from "./pages/BuilderPage";
import { AssessmentsListPage } from "./pages/AssessmentsListPage";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";
import { PlanPage } from "./pages/PlanPage";
import { InvitationComposerPage } from "./pages/InvitationComposerPage";
import { SubmissionInboxPage } from "./pages/SubmissionInboxPage";
import { SubmissionDetailPage } from "./pages/SubmissionDetailPage";
import { EvaluationReviewPage } from "./pages/EvaluationReviewPage";
import { ReleasePage } from "./pages/ReleasePage";
import { RevisionPage } from "./pages/RevisionPage";
import { DeliveryPage } from "./pages/DeliveryPage";
import { ComparisonsListPage } from "./pages/ComparisonsListPage";
import { ComparisonDetailPage } from "./pages/ComparisonDetailPage";
import { FilesPage } from "./pages/FilesPage";
import { SettingsPage } from "./pages/SettingsPage";
import { AiModelsPage } from "./pages/AiModelsPage";

export default function App() {
  const openTaskCount = useOpenTaskCount();

  return (
    <AppShell openTaskCount={openTaskCount}>
      <Routes>
        <Route path="/" element={<Navigate to="/tasks" replace />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/question-bank" element={<QuestionBankPage />} />
        <Route path="/questions/:id" element={<QuestionDetailPage />} />
        <Route path="/questions/:id/builder" element={<BuilderPage />} />
        <Route path="/assessments" element={<AssessmentsListPage />} />
        <Route path="/assessments/:id" element={<ProjectDetailPage />} />
        <Route path="/cases/:id/plan" element={<PlanPage />} />
        <Route path="/invitations/new" element={<InvitationComposerPage />} />
        <Route path="/submissions" element={<SubmissionInboxPage />} />
        <Route path="/attempts/:id/submission" element={<SubmissionDetailPage />} />
        <Route path="/attempts/:id/review" element={<EvaluationReviewPage />} />
        <Route path="/results/:id/release" element={<ReleasePage />} />
        <Route path="/cases/:id/revisions/:round" element={<RevisionPage />} />
        <Route path="/deliveries/:id" element={<DeliveryPage />} />
        <Route path="/comparisons" element={<ComparisonsListPage />} />
        <Route path="/comparisons/:id" element={<ComparisonDetailPage />} />
        <Route path="/files" element={<FilesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/ai-models" element={<AiModelsPage />} />
        <Route path="*" element={<Navigate to="/tasks" replace />} />
      </Routes>
    </AppShell>
  );
}
