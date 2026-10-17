// Issue #233 — one interface language per account: signed in, the account's wins; a switch is saved to it.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { SessionGate, useAccountLocale } from '../src/lib/session';

type Lang = 'zh' | 'en';

function stubIdentity(user: { locale: string; localeChosen: boolean } | null) {
  const patches: unknown[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('api/auth/config')) return new Response(JSON.stringify({ loginRequired: false }));
    if (url.endsWith('api/auth/me') && init?.method === 'PATCH') {
      patches.push(JSON.parse(String(init.body)));
      return new Response('{}');
    }
    if (url.endsWith('api/auth/me')) {
      return user
        ? new Response(JSON.stringify({ user: { id: 'u1', email: 'hr@example.com', displayName: 'HR', avatarColor: null, ...user }, roles: ['hr'] }))
        : new Response('{}', { status: 401 });
    }
    throw new Error(`unexpected ${url}`);
  }));
  return patches;
}

function Module({ start }: { start: Lang }) {
  const [lang, setLang] = useState<Lang>(start);
  useAccountLocale(lang, () => setLang((l) => (l === 'zh' ? 'en' : 'zh')));
  return <button onClick={() => setLang((l) => (l === 'zh' ? 'en' : 'zh'))}>lang:{lang}</button>;
}

const mount = (start: Lang) => render(<SessionGate><Module start={start} /></SessionGate>);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('account interface language (#233)', () => {
  it('a module that remembered another language switches to the account’s, without saving anything', async () => {
    const patches = stubIdentity({ locale: 'en', localeChosen: true });
    mount('zh');
    await screen.findByText('lang:en');
    await new Promise((r) => setTimeout(r, 20));
    expect(patches).toEqual([]);
  });

  it('switching the language in a module saves it to the account', async () => {
    const patches = stubIdentity({ locale: 'zh', localeChosen: true });
    mount('zh');
    fireEvent.click(await screen.findByText('lang:zh'));
    await waitFor(() => expect(patches).toEqual([{ locale: 'en' }]));
  });

  it('an account that never chose a language takes the module’s', async () => {
    const patches = stubIdentity({ locale: 'zh', localeChosen: false });
    mount('en');
    await screen.findByText('lang:en');
    await waitFor(() => expect(patches).toEqual([{ locale: 'en' }]));
  });

  it('signed out (demo mode), nothing is read from or saved to an account', async () => {
    const patches = stubIdentity(null);
    mount('zh');
    fireEvent.click(await screen.findByText('lang:zh'));
    await screen.findByText('lang:en');
    expect(patches).toEqual([]);
  });
});
