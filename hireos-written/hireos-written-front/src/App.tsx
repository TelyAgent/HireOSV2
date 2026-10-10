import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { useStore } from "./store/StoreContext";
import { useOpenTaskCount } from "./features/useOpenTaskCount";
import { loadRealWrittenTasksIntoFixtures } from "./data/realTasksMerge";
import { loadBankQuestionsIntoFixtures } from "./data/realQuestionsMerge";
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
import { ComparisonsListPage } from "./pages/ComparisonsListPage";
import { ComparisonDetailPage } from "./pages/ComparisonDetailPage";
import { SettingsPage } from "./pages/SettingsPage";
import { AiModelsPage } from "./pages/AiModelsPage";
import { CandidateApplyPage } from "./pages/CandidateApplyPage";

export default function App() {
  const openTaskCount = useOpenTaskCount();
  const { state, set } = useStore();

  // Loads real tasks from hireos-written-backend once per session and merges them into the fixture
  // dicts — every page that reads CASES/CORE_CANDIDATES/CORE_JOBS/TASKS (My Tasks, the candidate detail
  // page, ...) sees them from here on, same as hireos-jd-front's App-level job load.
  useEffect(() => {
    let cancelled = false;
    loadRealWrittenTasksIntoFixtures()
      .then(() => {
        if (cancelled) return;
        set({ realTasksVersion: state.realTasksVersion + 1 });
      })
      .catch((error) => console.warn("Failed to load real written tasks from the backend:", error));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The Question Bank is needed app-wide too (question detail page, the plan drawer's preset picker),
  // not just on the bank page -- loaded once here, re-fetched by the bank page itself on every visit.
  useEffect(() => {
    let cancelled = false;
    loadBankQuestionsIntoFixtures()
      .then(() => { if (!cancelled) set({ bankQuestionsVersion: Date.now() }); })
      .catch((error) => console.warn("Failed to load the question bank from the backend:", error));
    return () => {
      cancelled = true;
    };
  }, [set]);

  return (
    <Routes>
      {/* Candidate-facing, no login and no internal HR chrome — kept outside <AppShell>. */}
      <Route path="/apply/:token" element={<CandidateApplyPage />} />
      <Route path="/*" element={<ShellRoutes openTaskCount={openTaskCount} />} />
    </Routes>
  );
}

function ShellRoutes({ openTaskCount }: { openTaskCount: number }) {
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
        <Route path="/comparisons" element={<ComparisonsListPage />} />
        <Route path="/comparisons/:id" element={<ComparisonDetailPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/ai-models" element={<AiModelsPage />} />
        <Route path="*" element={<Navigate to="/tasks" replace />} />
      </Routes>
    </AppShell>
  );
}
