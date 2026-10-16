export type DownloadFailureStage = 'request' | 'download';
export function exportFailureCode(stage: DownloadFailureStage) {
  return stage === 'download' ? 'DOWNLOAD_FAILED' : 'EXPORT_FAILED';
}
