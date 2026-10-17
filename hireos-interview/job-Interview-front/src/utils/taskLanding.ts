import type { Screen } from '../store/types';

// Targets explicitly named in the task-list specification. Unresolved or unknown
// states retain Overview; ProjectShell still applies the existing stage gates.
const TARGETS: Record<string, Screen> = {
  draft: 'overview',
  requirements_ready: 'rubric',
  planning: 'plan',
  ready_to_schedule: 'schedule',
  interview_in_progress: 'live',
  evidence_requested: 'debrief',
  awaiting_confirmation: 'decision',
  package_published: 'package',
  on_hold: 'overview',
};

export function taskLandingScreen(status: string): Screen {
  return Object.hasOwn(TARGETS, status) ? TARGETS[status] : 'overview';
}
