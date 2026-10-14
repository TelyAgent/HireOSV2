import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { JobLibraryPage } from "./pages/JobLibraryPage";
import { NewJobPage } from "./pages/NewJobPage";
import { JobWorkspacePage } from "./pages/JobWorkspacePage";
import { SettingsPage } from "./pages/SettingsPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { useStore } from "./store/StoreContext";
import { loadJobsIntoStore } from "./features/jobs/jobsLoader";

export default function App() {
  const { mutate } = useStore();

  // Loads real jobs from the backend once per session and merges them into the store — every page
  // that reads `state.jobs` (Home, Job Library, Tasks, Files, ...) sees them from here on, instead of
  // each page having to fetch this itself.
  useEffect(() => {
    void loadJobsIntoStore(mutate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/jobs" replace />} />
        <Route path="/jobs" element={<JobLibraryPage />} />
        <Route path="/jobs/new" element={<NewJobPage />} />
        <Route path="/jobs/:id" element={<JobWorkspacePage />} />
        <Route path="/jobs/:id/:tab" element={<JobWorkspacePage />} />
        <Route path="/settings" element={<Navigate to="/settings/profile" replace />} />
        <Route path="/settings/:section" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  );
}
