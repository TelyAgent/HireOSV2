import { useRef, useState } from 'react';
import { api, ApiError, uploadMaterial, type Job, type Material } from './api';
import { useStore } from '../../store/StoreContext';
import { errorText, intakeText } from './i18n';
import { safeRandomUUID } from '../../utils/uuid';

export type MaterialUpload = { key: string; name: string; file: File; material?: Material; uploading: boolean; error?: string };

/**
 * "Start from a JD": the recruiter pastes JD text (or picks a JD file, whose extracted
 * text fills the field), optionally adds candidate résumés, then creates the project —
 * POST /jobs creates a local Job, and each readable résumé becomes an interview task
 * via the existing POST /jobs/:id/tasks.
 */
export function useCreateProject() {
  const { state, set, openTask, say } = useStore();
  const [jdText, setJdText] = useState('');
  const [jdFileName, setJdFileName] = useState('');
  const [jdFileBusy, setJdFileBusy] = useState(false);
  const [materials, setMaterials] = useState<MaterialUpload[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const jdFileGeneration = useRef(0);

  async function pickJdFile(file: File) {
    const generation = ++jdFileGeneration.current;
    setJdFileName(file.name); setJdFileBusy(true); setError('');
    try {
      const material = await uploadMaterial(file);
      if (generation !== jdFileGeneration.current) return;
      if (material.errorCode || !material.text.trim()) setError(material.errorCode || 'NO_EXTRACTABLE_TEXT');
      else setJdText(material.text);
    } catch (e) { if (generation === jdFileGeneration.current) setError((e as ApiError).code); }
    finally { if (generation === jdFileGeneration.current) setJdFileBusy(false); }
  }

  async function uploadOne(item: MaterialUpload) {
    setMaterials((rows) => rows.map((r) => r.key === item.key ? { ...r, uploading: true, error: undefined } : r));
    try {
      const material = await uploadMaterial(item.file);
      setMaterials((rows) => rows.map((r) => r.key === item.key ? { ...r, uploading: false, material, error: material.errorCode || undefined } : r));
    } catch (e) { setMaterials((rows) => rows.map((r) => r.key === item.key ? { ...r, uploading: false, error: (e as ApiError).code } : r)); }
  }

  function addMaterials(files: File[]) {
    const added = files.map((file) => ({ key: safeRandomUUID(), name: file.name, file, uploading: true }));
    setMaterials((rows) => [...rows, ...added]);
    for (const item of added) void uploadOne(item);
  }

  function removeMaterial(key: string) { setMaterials((rows) => rows.filter((r) => r.key !== key)); }

  function reset() {
    jdFileGeneration.current++;
    setJdText(''); setJdFileName(''); setJdFileBusy(false); setMaterials([]); setError('');
  }

  async function create() {
    if (!jdText.trim()) { setError('JD_REQUIRED'); return; }
    setCreating(true); setError('');
    try {
      const job = await api<Job>('/jobs', { method: 'POST', body: JSON.stringify({ jdText }) });
      let firstTaskId: string | null = null;
      const failed: string[] = [];
      for (const m of materials) {
        if (!m.material || m.material.readStatus !== 'available') { failed.push(m.name); continue; }
        try {
          const task = await api<{ id: string }>(`/jobs/${job.id}/tasks`, { method: 'POST', body: JSON.stringify({ materialId: m.material.id }) });
          firstTaskId ??= task.id;
        } catch { failed.push(m.name); }
      }
      set({ showCreateModal: false });
      reset();
      const zh = state.lang === 'zh';
      if (firstTaskId) {
        set({
          jdText: job.jdText,
          jdOnlyDraft: true, draftCreated: true,
          rubricExtracted: false, rubricConfirmed: false, rubricVersion: 1, rubricEditing: false,
          planApproved: false, planEditing: false, candidateLinked: true,
          r1Done: false, r2Done: false, r1Scheduled: false, r2Scheduled: false,
          decision: null, decHr: false, decHm: false, decRecorded: false,
          offerState: 'none', followUpRounds: [], transcriptState: 'ok', liveNotes: '',
          notesSavedAt: zh ? '刚刚已保存' : 'Saved just now',
          aiSuggestionState: 'idle', r2Scores: { poir: 3, sca: null, cm: 3 },
        });
        openTask(firstTaskId, 'overview');
      }
      const base = firstTaskId
        ? intakeText(state.lang).saved
        : zh ? '已通过 JD 创建项目。可在"按岗位聚类"视图为该岗位关联候选人。' : 'Project created from the JD. Link a candidate from the Cluster-by-role view.';
      say(failed.length
        ? base + (zh ? ` 以下资料未能关联：${failed.join('、')}。` : ` Could not link: ${failed.join(', ')}.`)
        : base);
    } catch (e) { setError((e as ApiError).code); }
    finally { setCreating(false); }
  }

  return {
    jdText, setJdText, jdFileName, jdFileBusy, pickJdFile,
    materials, addMaterials, removeMaterial, retryMaterial: uploadOne,
    create, creating, reset,
    error: error ? errorText(error, state.lang) : '',
    busy: creating || jdFileBusy || materials.some((m) => m.uploading),
  };
}
