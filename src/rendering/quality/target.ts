/** Reviewable quality target; no fixed palette is inferred from elemental payloads. */
export const QUALITY_TARGET = Object.freeze({
  outlineCssPixels: 1.85,
  weapon: 'R / 07 — serviceable field rifle, machined steel, enamel shell, rubber furniture',
  enemy: 'Single red optic, asymmetric gun arm, tapered armored core, exposed load joints',
  mech: 'Six meter industrial frame, armored cockpit, load rams, grounded split feet',
  effects: 'Short muzzle-local flash; surface-normal sparks and dust; bounded pools',
  audio: 'Layered reports, stage-synchronized foley, differentiated pilot steps and mech mass',
});

/** Uses the existing renderer's public setting; disposing restores its prior style. */
export function applyQualityInk(renderer:{outlineWidth:number}):()=>void{
 const previous=renderer.outlineWidth;renderer.outlineWidth=QUALITY_TARGET.outlineCssPixels;
 return()=>{renderer.outlineWidth=previous;};
}
