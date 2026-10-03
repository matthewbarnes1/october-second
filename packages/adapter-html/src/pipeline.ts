import { analyze, getPreset, interpretBrief, planRedesign, applyPlan, type AnalysisReport, type Depth, type Operation, type RedesignPlan, type SiteIR, type StyleSpec, listPresets, verifyStyle } from '@morpheus/core';
import { nodeVfs, memVfs } from './fs';
import { readSite } from './read';
import { refreshSignals } from './write';
import type { VFS } from '@morpheus/core';

export interface StyleChoice { preset?: string; brief?: string }

export function resolveStyle(choice: StyleChoice): { style: StyleSpec; notes: string[] } {
  if (choice.brief?.trim()) {
    if (choice.preset) {
      // A preset plus a brief: the brief refines the preset.
      const base = getPreset(choice.preset);
      const r = interpretBrief(`${base?.description ?? ''} ${choice.brief}`, choice.preset);
      return { style: r.style, notes: [`Brief refined "${choice.preset}"`, ...r.notes] };
    }
    const r = interpretBrief(choice.brief);
    return { style: r.style, notes: [`Brief matched "${r.basePreset}"`, ...r.notes] };
  }
  const style = getPreset(choice.preset ?? 'editorial');
  if (!style) throw new Error(`Unknown style "${choice.preset}". Available: ${listPresets().map((p) => p.id).join(', ')}`);
  return { style, notes: [] };
}

export interface RunOptions extends StyleChoice {
  depth: Depth;
  /** Also ship a dark colour scheme. */
  dark?: boolean;
  excluded?: string[];
  manual?: Operation[];
}

export interface RunResult {
  source: SiteIR;
  plan: RedesignPlan;
  output: SiteIR;
  before: AnalysisReport;
  after: AnalysisReport;
  styleNotes: string[];
  contrast: ReturnType<typeof verifyStyle>;
}

export async function loadSite(input: string | VFS | Record<string, string>) {
  const vfs: VFS = typeof input === 'string' ? nodeVfs(input) : 'list' in (input as any) && typeof (input as any).list === 'function' ? (input as VFS) : memVfs(input as Record<string, string>);
  return readSite(vfs);
}

export function runRedesign(source: SiteIR, opts: RunOptions): RunResult {
  const { style: resolved, notes } = resolveStyle(opts);
  const style = opts.dark ? { ...resolved, darkMode: 'auto' as const } : resolved;
  const plan = planRedesign(source, { depth: opts.depth, style, brief: opts.brief, excluded: opts.excluded, manual: opts.manual });
  const output = refreshSignals(applyPlan(source, plan));
  return { source, plan, output, before: analyze(source), after: analyze(output), styleNotes: notes, contrast: verifyStyle(style) };
}
