import type { Claim, Confidence, Provenance } from '../model/types';

export const CONFIDENCE_WEIGHT: Record<Confidence, number> = { high: 1, medium: 0.75, low: 0.45 };
export const PROVENANCE_WEIGHT: Record<Provenance, number> = {
  quotation: 1,
  documented: 1,
  inference: 0.8,
  speculative: 0.5,
};

/** How much the archive lets us lean on this claim. */
export function claimWeight(c: Claim): number {
  return CONFIDENCE_WEIGHT[c.confidence] * PROVENANCE_WEIGHT[c.provenance];
}

export type Side = 'affirm' | 'deny' | 'qualify';

export function sideOf(stance: number | undefined): Side {
  if (stance === undefined) return 'qualify';
  if (stance > 0.25) return 'affirm';
  if (stance < -0.25) return 'deny';
  return 'qualify';
}

export function formatStance(s: number | undefined): string {
  if (s === undefined) return 'no stated stance';
  const sign = s > 0 ? '+' : s < 0 ? '−' : '±';
  return `${sign}${Math.abs(s).toFixed(1)}`;
}

export const PROVENANCE_LABEL: Record<Provenance, string> = {
  quotation: 'Documented quotation',
  documented: 'Documented position',
  inference: 'Reasoned inference',
  speculative: 'Speculative simulation',
};

export const PROVENANCE_SHORT: Record<Provenance, string> = {
  quotation: 'Quotation',
  documented: 'Documented',
  inference: 'Inference',
  speculative: 'Speculative',
};
