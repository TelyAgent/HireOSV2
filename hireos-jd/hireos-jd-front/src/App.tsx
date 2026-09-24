import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { HomePage } from "./pages/HomePage";
import { TasksPage } from "./pages/TasksPage";
import { JobLibraryPage } from "./pages/JobLibraryPage";
import { NewJobPage } from "./pages/NewJobPage";
import { JobWorkspacePage } from "./pages/JobWorkspacePage";
import { TemplatesPage } from "./pages/TemplatesPage";
import { FilesPage } from "./pages/FilesPage";
import { SettingsPage } from "./pages/SettingsPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { useStore } from "./store/StoreContext";
import { listJobs } from "./features/jobs/jobsApi";
import { coreJobToLocalJob } from "./features/jobs/jobsMapping";

export default function App() {
  const { mutate } = useStore();

  // Loads real jobs from the backend once per session and merges them into the store — every page
  // that reads `state.jobs` (Home, Job Library, Tasks, Files, ...) sees them from here on, instead of
  // each page having to fetch this itself.
  useEffect(() => {
    let cancelled = false;
    listJobs()
      .then((coreJobs) => {
        if (cancelled) return;
        mutate((draft) => {
          for (const cj of coreJobs) draft.jobs[cj.id] = coreJobToLocalJob(cj, draft.jobs[cj.id]);
        });
      })
      .catch((error) => console.warn("Failed to load real jobs from the backend:", error));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/jobs" element={<JobLibraryPage />} />
        <Route path="/jobs/new" element={<NewJobPage />} />
        <Route path="/jobs/:id" element={<JobWorkspacePage />} />
        <Route path="/jobs/:id/:tab" element={<JobWorkspacePage />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/files" element={<FilesPage />} />
        <Route path="/settings" element={<Navigate to="/settings/overview" replace />} />
        <Route path="/settings/:section" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  );
}
