import { useRef, useState } from 'react';
import { api, ApiError, uploadMaterial, type Job, type Material } from './api';
import { useStore } from '../../store/StoreContext';
import { errorText, intakeText } from './i18n';
import { safeRandomUUID } from '../../utils/uuid';

// GET /external-jobs — Core Record's job directory, for "choose an existing job".
export type ExternalJob = { id: string; title: string; team?: string; location?: string; employmentType?: string; seniority?: string; status: string };

export type JdMode = 'new' | 'existing';
export type ResumeUpload = { name: string; material?: Material; uploading: boolean; error?: string; file: File };

type QuickStartResult = { job: Job; duplicate: boolean; task: { id: string } | null };

/**
 * The "New interview project" entry: a job — new JD text (pasted, or read from a JD file)
 * or an existing job from Core Record — plus at most one résumé. POST /quick-start creates
 * the job in the JD subsystem (deduping identical JDs), and turns the résumé into the task.
 */
export function useCreateProject() {
  const { state, set, openTask, say } = useStore();
  const [mode, setMode] = useState<JdMode>('new');
  const [jdText, setJdText] = useState('');
  const [jdFile, setJdFile] = useState<{ name: string; materialId?: string }>();
  const [jdFileBusy, setJdFileBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ExternalJob[]>([]);
  const [searching, setSearching] = useState(false);
  const [pickedJob, setPickedJob] = useState<ExternalJob>();
  const [resume, setResume] = useState<ResumeUpload>();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const jdFileGeneration = useRef(0);
  const searchGeneration = useRef(0);
  const resumeGeneration = useRef(0);

  async function pickJdFile(file: File) {
    const generation = ++jdFileGeneration.current;
    setJdFile({ name: file.name }); setJdFileBusy(true); setError('');
    try {
      const material = await uploadMaterial(file);
      if (generation !== jdFileGeneration.current) return;
      if (material.errorCode || !material.text.trim()) { setError(material.errorCode || 'NO_EXTRACTABLE_TEXT'); return; }
      setJdText(material.text); setJdFile({ name: file.name, materialId: material.id });
    } catch (e) { if (generation === jdFileGeneration.current) setError((e as ApiError).code); }
    finally { if (generation === jdFileGeneration.current) setJdFileBusy(false); }
  }

  // Editing the text by hand means it no longer is the file's text.
  function editJdText(text: string) {
    setJdText(text);
    if (error === 'JD_REQUIRED' && text.trim()) setError('');
    if (jdFile?.materialId) setJdFile(undefined);
  }

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

  function switchMode(next: JdMode) {
    setMode(next); setError('');
    if (next === 'existing' && !results.length && !searching) void search(query);
  }

  async function pickResume(file: File) {
    const generation = ++resumeGeneration.current;
    setResume({ name: file.name, file, uploading: true }); setError('');
    try {
      const material = await uploadMaterial(file);
      if (generation === resumeGeneration.current) setResume({ name: file.name, file, material, uploading: false, error: material.errorCode || undefined });
    } catch (e) { if (generation === resumeGeneration.current) setResume({ name: file.name, file, uploading: false, error: (e as ApiError).code }); }
  }

  function removeResume() { resumeGeneration.current++; setResume(undefined); }

  function reset() {
    jdFileGeneration.current++; searchGeneration.current++; resumeGeneration.current++;
    setMode('new'); setJdText(''); setJdFile(undefined); setJdFileBusy(false);
    setQuery(''); setResults([]); setSearching(false); setPickedJob(undefined);
    setResume(undefined); setError('');
  }

  async function create() {
    if (mode === 'new' && !jdText.trim()) { setError('JD_REQUIRED'); return; }
    if (mode === 'existing' && !pickedJob) { setError('JOB_REQUIRED'); return; }
    if (resume && (!resume.material || resume.error)) { setError(resume.error || 'MATERIAL_NOT_AVAILABLE'); return; }
    setCreating(true); setError('');
    try {
      const jd = mode === 'new' ? { text: jdText, ...(jdFile?.materialId ? { materialId: jdFile.materialId } : {}) } : { coreJobId: pickedJob!.id };
      const result = await api<QuickStartResult>('/quick-start', {
        method: 'POST',
        headers: { 'Idempotency-Key': safeRandomUUID() },
        body: JSON.stringify({ jd, ...(resume?.material ? { resumeMaterialId: resume.material.id } : {}) }),
      });
      set({ showCreateModal: false });
      reset();
      const zh = state.lang === 'zh';
      if (result.task) {
        set({
          jdText: result.job.jdText,
          jdOnlyDraft: true, draftCreated: true,
          rubricExtracted: false, rubricConfirmed: false, rubricVersion: 1, rubricEditing: false,
          planApproved: false, planEditing: false, candidateLinked: true,
          r1Done: false, r2Done: false, r1Scheduled: false, r2Scheduled: false,
          decision: null, decHr: false, decHm: false, decRecorded: false,
          offerState: 'none', followUpRounds: [], transcriptState: 'ok', liveNotes: '',
          notesSavedAt: zh ? '刚刚已保存' : 'Saved just now',
          aiSuggestionState: 'idle', r2Scores: { poir: 3, sca: null, cm: 3 },
        });
        openTask(result.task.id, 'overview');
      }
      const duplicateNote = result.duplicate
        ? (zh ? `已存在相同岗位「${result.job.title}」，已关联到该岗位。` : `A job with the same JD already exists ("${result.job.title}") — linked to it.`)
        : '';
      const outcome = result.task
        ? intakeText(state.lang).saved
        : zh ? '岗位已就绪。可在"按岗位聚类"视图为该岗位关联候选人。' : 'Job is ready. Link a candidate from the Cluster-by-role view.';
      say([duplicateNote, outcome].filter(Boolean).join(' '));
    } catch (e) { setError((e as ApiError).code); }
    finally { setCreating(false); }
  }

  return {
    mode, switchMode,
    jdText, editJdText, jdFile, jdFileBusy, pickJdFile,
    query, search, results, searching, pickedJob, setPickedJob,
    resume, pickResume, removeResume,
    create, creating, reset,
    error: error ? errorText(error, state.lang) : '',
    jdRequired: error === 'JD_REQUIRED',
    busy: creating || jdFileBusy || Boolean(resume?.uploading),
  };
}
