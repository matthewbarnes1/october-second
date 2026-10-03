import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { VFS } from '@morpheus/core';

const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', '.svelte-kit', '.morpheus-out', 'vendor']);

export function nodeVfs(root: string): VFS & { root: string } {
  let cache: string[] | null = null;
  async function walk(dir: string, rel = ''): Promise<string[]> {
    const out: string[] = [];
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (IGNORE_DIRS.has(e.name)) continue;
        out.push(...(await walk(path.join(dir, e.name), path.posix.join(rel, e.name))));
      } else if (e.isFile()) out.push(path.posix.join(rel, e.name));
    }
    return out;
  }
  return {
    root,
    async list() {
      cache ??= await walk(root);
      return cache;
    },
    async read(p: string) {
      try {
        return await fs.readFile(path.join(root, p), 'utf8');
      } catch {
        return null;
      }
    },
  };
}

export function memVfs(files: Record<string, string>): VFS {
  return {
    async list() { return Object.keys(files); },
    async read(p: string) { return files[p] ?? null; },
  };
}
