import { realpath, stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

/**
 * The file a static request may read, or null (#126). Only the URL's path counts (never its query); it is decoded
 * once, resolved under `root`, and must stay inside it — "..", encoded "%2e%2e" and "%2f" variants, absolute paths
 * and backslashes can't leave it. The real path is checked too, so a symbolic link inside `root` that points
 * outside is refused, and only regular files are served.
 */
export async function resolveStaticPath(root, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes('\0') || decoded.includes('\\')) return null;
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const rootReal = await realpath(root);
  const candidate = resolve(rootReal, relative);
  if (candidate !== rootReal && !candidate.startsWith(rootReal + sep)) return null;
  try {
    const real = await realpath(candidate);
    if (!real.startsWith(rootReal + sep)) return null;
    return (await stat(real)).isFile() ? real : null;
  } catch {
    return null;
  }
}
