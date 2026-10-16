// Rendering for unit tests: a component the app uses is bundled with React by esbuild (Vite's own) and rendered to
// static HTML, so a test checks what the page shows without a browser. `source` is an ES module, resolved from the
// frontend's root, exporting `render`; the returned `render` is that function.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("../../", import.meta.url));

export async function bundleRender(source) {
  const dir = mkdtempSync(join(tmpdir(), "render-"));
  const outfile = join(dir, "render.mjs");
  try {
    await build({
      stdin: { contents: source, resolveDir: root, loader: "tsx" },
      bundle: true,
      format: "esm",
      platform: "node",
      jsx: "automatic",
      outfile,
      // React's CommonJS builds call require(); give the ES module bundle one.
      banner: { js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' },
      define: { "process.env.NODE_ENV": '"production"' },
      logLevel: "silent",
    });
    return (await import(pathToFileURL(outfile).href)).render;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** The visible text of rendered HTML, entities decoded and whitespace collapsed. */
export const textOf = (html) =>
  html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
