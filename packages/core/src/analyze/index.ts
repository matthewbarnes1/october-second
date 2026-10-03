import type { SiteIR } from '../ir';
import { scoreAiLook, type AiLookReport } from './ai-tells';
import { auditUx, type UxReport } from './ux';

export interface AnalysisReport {
  ai: AiLookReport;
  ux: UxReport;
}

export function analyze(ir: SiteIR): AnalysisReport {
  return { ai: scoreAiLook(ir), ux: auditUx(ir) };
}

export * from './ai-tells';
export * from './ux';
export { siteText, pageText, sectionText, allSections } from './util';
export * from './packs';
