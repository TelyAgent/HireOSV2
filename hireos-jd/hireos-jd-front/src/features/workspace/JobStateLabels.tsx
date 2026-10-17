import { StatusBadge } from '../../components/ui/Primitives';
import { useStore } from '../../store/StoreContext';
import type { Job } from '../../data/types';

export function JobStateLabels({ hiringStatus, publishedVersion }: { hiringStatus: Job['hiringStatus']; publishedVersion: number | null | undefined }) {
  const { t } = useStore();
  const style = { display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const, maxWidth: '100%', fontSize: 12 };
  return <>
    <span role="group" aria-label={t('Recruiting status')} style={style}>
      <span>{t('Recruiting status')}:</span>
      <StatusBadge kind="hiring_status" value={hiringStatus} />
    </span>
    <span role="group" aria-label={t('JD publication')} style={style}>
      <span>{t('JD publication')}:</span>
      <span className={`badge ${publishedVersion == null ? 'badge-neutral' : 'badge-success'}`}>
        {publishedVersion === undefined ? t('Loading…') : publishedVersion === null ? t('Not published') : `v${publishedVersion} ${t('published')}`}
      </span>
    </span>
  </>;
}
