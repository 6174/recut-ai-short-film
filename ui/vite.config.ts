import { defineConfig } from "vite";
import { readFile, readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const referenceImagesRoot = resolve(import.meta.dirname, "../skills/vox-broll/references/images");

async function imageFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return imageFiles(path);
    return entry.name.startsWith(".") ? [] : [path];
  }));
  return nested.flat();
}

function copyStyleReferenceImages() {
  return {
    name: "copy-ai-short-film-style-references",
    async buildStart(this: { emitFile: (asset: { type: "asset"; fileName: string; source: Buffer }) => void }) {
      for (const path of await imageFiles(referenceImagesRoot)) {
        this.emitFile({ type: "asset", fileName: `images/${relative(referenceImagesRoot, path)}`, source: await readFile(path) });
      }
    },
  };
}

export default defineConfig({ base: "./", publicDir: false, plugins: [copyStyleReferenceImages(), tailwindcss(), react()] });
