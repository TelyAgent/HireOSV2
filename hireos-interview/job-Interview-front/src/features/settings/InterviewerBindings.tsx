import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Modal, Select } from 'antd';
import { LinkOutlined, ReloadOutlined } from '@ant-design/icons';
import { api, ApiError } from '../project-intake/api';

type Member = { id: string; displayName: string; email: string; status: string; membershipStatus: string };
type Binding = { accountId: string; boundBy: string; boundAt: string };
type Entry = { id: string; name: string; accountBinding: Binding | null };

export function InterviewerBindings({ members }: { members: Member[] }) {
  const [rows, setRows] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<Entry | null>(null);
  const [saving, setSaving] = useState(false);
  const fail = (e: unknown) => setError(e instanceof ApiError ? ({
    INTERVIEWER_ALREADY_BOUND: '该面试官已绑定账号，请刷新查看。',
    ACCOUNT_NOT_ACTIVE_MEMBER: '该账号不是当前工作区的有效成员，请重新选择。',
    ADMIN_REQUIRED: '仅管理员可以关联账号。',
    IDENTITY_UNAVAILABLE: '账号服务暂不可用，未完成关联，请重试。',
  }[e.code] ?? '关联状态未确认，请刷新后重试。') : '加载失败，请重试。');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setRows(await api<Entry[]>('/interviewers/account-bindings')); }
    catch (e) { fail(e); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const save = async () => {
    if (!confirm || !selection[confirm.id] || saving) return;
    setSaving(true); setError('');
    try {
      const binding = await api<Binding>(`/interviewers/${confirm.id}/account-binding`, {
        method: 'POST', body: JSON.stringify({ accountId: selection[confirm.id] }),
      });
      setRows(previous => previous.map(row => row.id === confirm.id ? { ...row, accountBinding: binding } : row));
      setConfirm(null);
    } catch (e) { fail(e); }
    finally { setSaving(false); }
  };
  const name = (id: string) => members.find(m => m.id === id)?.displayName ?? id;
  return <section data-testid="interviewer-bindings" style={{ marginTop: 24 }}>
    <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>面试官账号关联
      <Button icon={<ReloadOutlined />} aria-label="刷新账号关联" title="刷新账号关联" loading={loading} disabled={saving} onClick={() => void load()} />
    </h3>
    {error && <Alert type="error" role="alert" message={error} />}
    {loading ? <p>加载中</p> : rows.length === 0 ? <p>暂无面试官</p> : rows.map(row => <div key={row.id} data-testid={`binding-${row.id}`} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
      <strong style={{ overflowWrap: 'anywhere' }}>{row.name}</strong>
      {row.accountBinding ? <span style={{ overflowWrap: 'anywhere' }}>
        已关联：{name(row.accountBinding.accountId)} · 操作人：{name(row.accountBinding.boundBy)} · {new Date(row.accountBinding.boundAt).toLocaleString()}
      </span> : <>
        <Select aria-label={`${row.name} 关联账号`} placeholder="选择有效账号" style={{ width: 320, maxWidth: '100%' }}
          value={selection[row.id]} disabled={saving} onChange={value => setSelection(prev => ({ ...prev, [row.id]: value }))}
          options={members.filter(m => m.status === 'active' && m.membershipStatus === 'active').map(m => ({ value: m.id, label: `${m.displayName} (${m.email})` }))} />
        <Button aria-label="关联账号" icon={<LinkOutlined />} disabled={!selection[row.id] || saving} onClick={() => { setError(''); setConfirm(row); }}>关联账号</Button>
      </>}
    </div>)}
    <Modal title="确认账号关联" open={Boolean(confirm)} onCancel={() => { if (!saving) setConfirm(null); }} onOk={() => void save()}
      confirmLoading={saving} cancelButtonProps={{ disabled: saving }} closable={!saving} maskClosable={!saving} okText="确认关联" cancelText="取消">
      {confirm && <p>{confirm.name} → {name(selection[confirm.id])}</p>}
      {error && <Alert type="error" role="alert" message={error} />}
    </Modal>
  </section>;
}
