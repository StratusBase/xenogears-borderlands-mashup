/** Explicit provisional balance, centralized for the first playable review. */
export const GRAVITY_PROTOTYPE=Object.freeze({
 radius:6,duration:4.5,clearance:1.8,coreRadius:.32,captureRadius:1.16,
 acceleration:24,maxSpeed:7,response:7,crushDps:18,tickInterval:.5,
 maxFields:3,maxTargets:32,maxMembers:12,maxEvents:256,fallAcceleration:14,maxFallSpeed:12,
});
export type GravityProfile=Readonly<typeof GRAVITY_PROTOTYPE>;
