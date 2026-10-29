/** Presentation-only comparison policy. Select before constructing a scene or controller. */
export type CrowdFeedbackMode = 'classic' | 'crowd';

let mode: CrowdFeedbackMode = 'crowd';

export function setCrowdFeedbackMode(next: CrowdFeedbackMode): void { mode = next; }
export function getCrowdFeedbackMode(): CrowdFeedbackMode { return mode; }
