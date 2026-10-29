import './evaluationLab';
import type { Game } from '../game';
import { CombatMeasurement, type MeasurementEvent, type MeasurementSnapshot } from '../diagnostics/measurement';

interface PublicEvaluation {
  game: Pick<Game, 'getEncounterSnapshot'>;
  snapshot(): MeasurementSnapshot | null;
  events(): MeasurementEvent[];
  sourceFingerprint: string;
}
const evaluationWindow = window as Window & { arsenalEvaluation?: PublicEvaluation };

/** Additive export transport only. The imported lab owns every input, fixture and clock. */
if (import.meta.env.DEV) {
  const panel = document.createElement('section');
  panel.setAttribute('aria-label', 'Workspace evidence export');
  panel.style.cssText = 'position:fixed;z-index:101;right:8px;top:8px;width:min(340px,calc(100vw - 16px));padding:12px;background:#13212af2;color:#f2e5cc;border:1px solid #72c4b8;font:13px/1.4 system-ui;';
  const note = document.createElement('p');
  note.textContent = 'Export transport only: existing evaluation controls, inputs, builds, and simulation stay unchanged. Save each finished attempt before reloading.';
  const save = document.createElement('button'); save.type = 'button'; save.textContent = 'Save evidence to workspace';
  const status = document.createElement('output'); status.setAttribute('aria-live', 'polite');
  status.style.cssText = 'display:block;white-space:pre-wrap;overflow-wrap:anywhere;margin-top:8px';
  panel.append(note, save, status); document.body.append(panel);
  save.addEventListener('click', () => { void saveEvidence(); });

  async function saveEvidence(): Promise<void> {
    save.disabled = true;
    try {
      const evaluation = evaluationWindow.arsenalEvaluation;
      if (!evaluation) throw new Error('Evaluation is still loading. Start and finish a run first.');
      const measurement = evaluation.snapshot();
      if (!measurement || !measurement.outcome) throw new Error('Finish, fail, time out, or abort the run before saving.');
      if (measurement.metadata.scenario !== 'encounter') throw new Error('Select Live encounter for pacing evidence.');
      const events = evaluation.events();
      if (events.length === 0 || events.length >= 100_000) throw new Error('Missing trace or trace cap reached; this attempt cannot be exported as complete evidence.');
      if (measurement.metadata.sourceFingerprint !== evaluation.sourceFingerprint) throw new Error('Source fingerprint differs from this measurement.');
      const replay = new CombatMeasurement(measurement.metadata);
      if (events.some(event => !replay.record(event)) || JSON.stringify(replay.snapshot()) !== JSON.stringify(measurement)) {
        throw new Error('Event trace does not exactly reproduce the measurement.');
      }
      // Below the lab's fixed trace cap, every accepted event is retained. We do
      // not infer missing private counters or change any original event value.
      const evidence = {
        measurement, events, encounter: evaluation.game.getEncounterSnapshot(),
        sourceFingerprint: evaluation.sourceFingerprint, droppedTraceEvents: 0,
        hardwareStatus: 'NOT RUN',
        inputAttestation: 'Existing evaluation-lab controls and scripted policy; no physical controller test is asserted.',
        exportTransport: 'Same-origin workspace POST; observation only, no input or gameplay changes.',
      };
      const response = await fetch('/__pacing-evidence', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: `${JSON.stringify(evidence, null, 2)}\n`,
      });
      const result = await response.json() as { filename?: string; error?: string };
      if (!response.ok || !result.filename) throw new Error(result.error ?? `Workspace save failed (${response.status}).`);
      status.textContent = `SAVED TO WORKSPACE\n${result.filename}\n${measurement.outcome.toUpperCase()} · ${measurement.duration.toFixed(2)} seconds · ${events.length} exact events`;
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Workspace save failed.';
    } finally { save.disabled = false; }
  }
}
