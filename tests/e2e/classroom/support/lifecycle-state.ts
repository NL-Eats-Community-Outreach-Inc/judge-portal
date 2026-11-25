import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';

export type ClassroomLifecycleState = {
  courseTitle: string;
  courseSlug: string;
  moduleTitle?: string;
  moduleSlug?: string;
  lessonTitle?: string;
  lessonSlug?: string;
  lessonId?: string;
  textContent?: string;
  videoTitle?: string;
  videoAssetId?: string;
  imageAlt?: string;
  imageCaption?: string;
  fileTitle?: string;
  fileDescription?: string;
  fileContent?: string;
};

const statePath = path.join(process.cwd(), 'test-results', 'classroom-lifecycle.json');

export function writeLifecycleState(state: ClassroomLifecycleState) {
  mkdirSync(path.dirname(statePath), { recursive: true });
  writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
}

export function readLifecycleState(): ClassroomLifecycleState {
  if (!existsSync(statePath)) {
    throw new Error(
      `Classroom lifecycle state was not found at ${statePath}. Run the complete Playwright suite so the teacher setup project runs first.`
    );
  }

  return JSON.parse(readFileSync(statePath, 'utf8')) as ClassroomLifecycleState;
}

export function hasLifecycleState() {
  return existsSync(statePath);
}

export function deleteLifecycleState() {
  if (existsSync(statePath)) unlinkSync(statePath);
}
