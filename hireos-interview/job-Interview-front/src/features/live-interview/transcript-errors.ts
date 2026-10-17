/**
 * A round's transcript error code (`InterviewRound.transcriptError`, set by the backend's RtmsService) as what
 * happened and what to do next (#392). An unknown code still shows, after a general explanation.
 */
const KNOWN: Record<string, { zh: string; en: string }> = {
  TRANSCRIPT_LANGUAGE_UNSUPPORTED: {
    zh: '实时转写不支持本轮设置的面试语言。请在排期中把面试语言改为中文、英文或“混合（自动识别）”，然后重新开始会议。',
    en: "Live transcription doesn't support this round's interview language. Set the round's interview language to Chinese, English or “Mixed (detect automatically)” when scheduling, then restart the meeting.",
  },
  RTMS_CREDENTIALS_REQUIRED: {
    zh: '服务器没有配置 Zoom 实时转写（RTMS）凭据，无法开始转写。请联系管理员配置后重新开始会议。',
    en: "The server has no Zoom live transcript (RTMS) credentials, so the transcript can't start. Ask an admin to configure them, then restart the meeting.",
  },
  ZM_RTMS_CLIENT_REQUIRED: {
    zh: '服务器缺少 Zoom 实时转写组件，无法开始转写。请联系管理员。',
    en: "The server is missing the Zoom live transcript component, so the transcript can't start. Contact an admin.",
  },
  TRANSCRIPT_CONFIG_FAILED: {
    zh: 'Zoom 没有接受转写设置。请重新开始会议；如果仍然失败，请联系管理员检查 Zoom 应用的转写权限。',
    en: "Zoom didn't accept the transcript settings. Restart the meeting; if it still fails, ask an admin to check the Zoom app's transcript permission.",
  },
  JOIN_REJECTED: {
    zh: 'Zoom 拒绝了转写服务加入会议。请重新开始会议；如果仍然失败，请联系管理员检查 Zoom 应用配置。',
    en: 'Zoom refused to let the transcript service join the meeting. Restart the meeting; if it still fails, ask an admin to check the Zoom app setup.',
  },
  JOIN_FAILED: {
    zh: '转写服务没能连上会议（可能是网络中断）。请重新开始会议。',
    en: "The transcript service couldn't connect to the meeting (possibly a network drop). Restart the meeting.",
  },
  RTMS_START_FAILED: {
    zh: '会议开始后，实时转写没有启动。请重新开始会议。',
    en: "The live transcript didn't start after the meeting began. Restart the meeting.",
  },
};

export function transcriptErrorText(code: string | null | undefined, lang: 'zh' | 'en'): string {
  if (code && KNOWN[code]) return KNOWN[code][lang];
  // RTMS_START_<HTTP status>[_<Zoom code>]: Zoom refused to start the stream.
  if (code?.startsWith('RTMS_START_')) {
    return lang === 'zh'
      ? `Zoom 拒绝启动实时转写（${code}）。请重新开始会议；如果仍然失败，请联系管理员。`
      : `Zoom refused to start the live transcript (${code}). Restart the meeting; if it still fails, contact an admin.`;
  }
  const general = lang === 'zh' ? '转写连接出错。请重新开始会议。' : 'The transcript connection failed. Restart the meeting.';
  return code ? `${general} (${code})` : general;
}
