/** Physical MIRV tuning. Presentation consumes authoritative fuse/settle state. */
export const CLUSTER_MIRV = Object.freeze({ gravity: 14, restitution: .42, friction: .65, restSpeed: 1.2, bounces: 4, clearance: .20, travelLimit: 40 });

/** Deterministic gameplay distribution; does not consume combat or cosmetic RNG.
 * A fixed permutation decorrelates fuse order from the spatial launch ring. */
export function clusterBombletPlan(count: number, blastRadius: number, seed: number, fuses: { min: number; max: number }) {
  if (!Number.isInteger(count) || count < 2 || count > 12) return [];
  const total = count;
  const phase = seed * 2.399963229728653;
  const ranks = Array.from({ length: total }, (_, index) => index).sort((a, b) => ((a + 1) * .61803398875 % 1) - ((b + 1) * .61803398875 % 1));
  return Array.from({ length: total }, (_, index) => ({
    angle: phase + index * 2.399963229728653,
    radialSpeed: Math.max(.5, blastRadius) * (.55 + .72 * Math.sqrt((index + .5) / total)),
    lift: 3.5 + ((index * .754877666 + seed * .137) % 1),
    fuse: fuses.min + (fuses.max - fuses.min) * ranks.indexOf(index) / (total - 1),
  }));
}
