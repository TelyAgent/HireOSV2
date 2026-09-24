import { useRef, useState } from 'react';
import { api, ApiError, uploadMaterial, type Job, type Material } from './api';
import { useStore } from '../../store/StoreContext';
import { errorText, intakeText } from './i18n';
import { safeRandomUUID } from '../../utils/uuid';

// GET /external-jobs — Core Record's job directory (the "pick an existing job" picker's
// search results). Interview has no JD authoring of its own; a job's identity always
// comes from here, its JD content from hireos-jd (see backend JdContentFacade).
export type ExternalJob = { id: string; title: string; team?: string; location?: string; employmentType?: string; seniority?: string; status: string };

export type ResumeUpload = { key: string; name: string; file: File; material?: Material; uploading: boolean; error?: string };

/**
 * The lightweight entry point that replaced JD authoring: search Core Record's job
 * directory, attach the one the recruiter picked (syncing its identity + JD content
 * locally), then upload résumés — each one creates an interview task via the existing
 * TasksService.create endpoint, unchanged.
 */
export function useAttachJob() {
  const { state, set, openTask, say } = useStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ExternalJob[]>([]);
  const [searching, setSearching] = useState(false);
  const [job, setJob] = useState<Job>();
  const [attaching, setAttaching] = useState(false);
  const [resumes, setResumes] = useState<ResumeUpload[]>([]);
  const [error, setError] = useState('');
  const searchGeneration = useRef(0);
  const firstTaskId = useRef<string | null>(null);

  async function search(q: string) {
    setQuery(q);
    const generation = ++searchGeneration.current;
    setSearching(true); setError('');
    try {
      const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
      const rows = await api<ExternalJob[]>(`/external-jobs${qs}`);
      if (generation === searchGeneration.current) setResults(rows);
    } catch (e) { if (generation === searchGeneration.current) setError((e as ApiError).code); }
    finally { if (generation === searchGeneration.current) setSearching(false); }
  }

  async function pick(coreJobId: string) {
    setAttaching(true); setError('');
    try {
      const attached = await api<Job>('/jobs/attach', { method: 'POST', body: JSON.stringify({ coreJobId }) });
      setJob(attached); firstTaskId.current = null; setResumes([]);
    } catch (e) { setError((e as ApiError).code); }
    finally { setAttaching(false); }
  }

  function back() { setJob(undefined); setResumes([]); firstTaskId.current = null; setError(''); }

  async function uploadResume(item: ResumeUpload) {
    if (!job) return;
    setResumes((rows) => rows.map((r) => r.key === item.key ? { ...r, uploading: true, error: undefined } : r));
    try {
      const material = await uploadMaterial(item.file);
      const task = await api<{ id: string }>(`/jobs/${job.id}/tasks`, { method: 'POST', body: JSON.stringify({ materialId: material.id }) });
      if (!firstTaskId.current) firstTaskId.current = task.id;
      setResumes((rows) => rows.map((r) => r.key === item.key ? { ...r, uploading: false, material } : r));
    } catch (e) { setResumes((rows) => rows.map((r) => r.key === item.key ? { ...r, uploading: false, error: (e as ApiError).code } : r)); }
  }

  function addResumes(files: File[]) {
    const added = files.map((file) => ({ key: safeRandomUUID(), name: file.name, file, uploading: true }));
    setResumes((rows) => [...rows, ...added]);
    for (const item of added) void uploadResume(item);
  }

  function finish() {
    if (!job) return;
    set({ showCreateModal: false });
    const taskId = firstTaskId.current;
    const jdText = job.jdText;
    setQuery(''); setResults([]); setJob(undefined); setResumes([]); firstTaskId.current = null;
    if (taskId) {
      // A résumé was attached, so this job already has a real task — enter its flow.
      set({
        jdText,
        jdOnlyDraft: true, draftCreated: true,
        rubricExtracted: false, rubricConfirmed: false, rubricVersion: 1, rubricEditing: false,
        planApproved: false, planEditing: false, candidateLinked: true,
        r1Done: false, r2Done: false, r1Scheduled: false, r2Scheduled: false,
        inviteFailed: false, decision: null, decHr: false, decHm: false, decRecorded: false,
        offerState: 'none', followUpRounds: [], transcriptState: 'ok', liveNotes: '',
        notesSavedAt: state.lang === 'zh' ? '刚刚已保存' : 'Saved just now',
        aiSuggestionState: 'idle', r2Scores: { poir: 3, sca: null, cm: 3 },
      });
      openTask(taskId, 'overview');
      say(intakeText(state.lang).saved);
    } else {
      // Job attached but no résumé yet — no task to open a project-flow page for.
      say(state.lang === 'zh'
        ? '岗位已关联。请到"按岗位聚类"视图为该岗位关联候选人，再进入面试流程。'
        : 'Job attached. Link a candidate from the Cluster-by-role view to start its interview flow.');
    }
  }

  return {
    query, search, results, searching,
    job, attaching, pick, back,
    resumes, setResumes, addResumes, uploadResume,
    finish,
    error: error ? errorText(error, state.lang) : '',
    busy: attaching || resumes.some((r) => r.uploading),
  };
}
