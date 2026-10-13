export type MailLocale = 'zh' | 'en';

export type RenderedMail = { subject: string; html: string; text: string };

const BRAND = '#0f766e';
const CODE_BG = '#dff3f0';
const TEXT = '#111827';
const MUTED = '#4b5563';

export function mailLocale(value: string | undefined | null): MailLocale {
  return value && value.toLowerCase().startsWith('en') ? 'en' : 'zh';
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string);
}

/**
 * Table layout + inline styles only: Outlook and Gmail drop <style> blocks and flex/grid.
 */
function layout(bodyRows: string) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f7f8;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7f8;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #d9e2e1;border-radius:16px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'PingFang SC','Microsoft YaHei',Arial,sans-serif;">
<tr><td style="background:${BRAND};padding:22px 28px;color:#ffffff;font-size:20px;font-weight:700;">HireOS</td></tr>
${bodyRows}
</table>
</td></tr>
</table>
</body></html>`;
}

function paragraph(content: string, style = `color:${TEXT};font-size:15px;line-height:1.6;`) {
  return `<tr><td style="padding:0 28px 14px;${style}">${content}</td></tr>`;
}

export function renderLoginCodeEmail(code: string, locale: MailLocale): RenderedMail {
  const copy =
    locale === 'en'
      ? {
          subject: `${code} is your HireOS verification code`,
          greeting: 'Hi,',
          intro: 'Use the code below to sign in to HireOS:',
          validity: 'The code is valid for 10 minutes and can only be used once. Please do not forward it to anyone.',
          ignore: 'If you did not request this sign-in, you can ignore this email.',
        }
      : {
          subject: `${code} 是你的 HireOS 登录验证码`,
          greeting: '你好，',
          intro: '请使用下面的验证码登录 HireOS：',
          validity: '验证码 10 分钟内有效，只能使用一次。请不要转发给任何人。',
          ignore: '如果不是你本人在登录，忽略这封邮件即可。',
        };
  const spaced = code.split('').join(' ');
  const html = layout(
    `<tr><td style="padding:26px 28px 6px;color:${TEXT};font-size:15px;line-height:1.6;">${copy.greeting}</td></tr>
${paragraph(copy.intro)}
<tr><td style="padding:6px 28px 22px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td align="center" style="background:${CODE_BG};border-radius:12px;padding:22px 12px;font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:#0b4f4a;">${spaced}</td>
</tr></table>
</td></tr>
${paragraph(copy.validity, `color:${MUTED};font-size:13px;line-height:1.6;`)}
${paragraph(copy.ignore, `color:${MUTED};font-size:13px;line-height:1.6;padding-bottom:28px;`)}`,
  );
  const text = `${copy.greeting}\n\n${copy.intro}\n\n${code}\n\n${copy.validity}\n${copy.ignore}\n`;
  return { subject: copy.subject, html, text };
}

export function renderInviteEmail(input: { inviterName: string; signInUrl: string; locale: MailLocale }): RenderedMail {
  const inviter = escapeHtml(input.inviterName);
  const url = escapeHtml(input.signInUrl);
  const copy =
    input.locale === 'en'
      ? {
          subject: `${input.inviterName} invited you to HireOS`,
          greeting: 'Hi,',
          intro: `${inviter} has invited you to HireOS. Sign in with this email address — we'll send you a one-time code, no password needed.`,
          button: 'Sign in to HireOS',
          plainIntro: `${input.inviterName} has invited you to HireOS. Sign in with this email address — we'll send you a one-time code, no password needed.`,
        }
      : {
          subject: `${input.inviterName} 邀请你加入 HireOS`,
          greeting: '你好，',
          intro: `${inviter} 邀请你加入 HireOS。用这个邮箱登录即可，我们会发送一次性验证码，不需要密码。`,
          button: '登录 HireOS',
          plainIntro: `${input.inviterName} 邀请你加入 HireOS。用这个邮箱登录即可，我们会发送一次性验证码，不需要密码。`,
        };
  const html = layout(
    `<tr><td style="padding:26px 28px 6px;color:${TEXT};font-size:15px;line-height:1.6;">${copy.greeting}</td></tr>
${paragraph(copy.intro)}
<tr><td style="padding:8px 28px 30px;">
<a href="${url}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px;">${copy.button}</a>
</td></tr>`,
  );
  const text = `${copy.greeting}\n\n${copy.plainIntro}\n\n${input.signInUrl}\n`;
  return { subject: copy.subject, html, text };
}
