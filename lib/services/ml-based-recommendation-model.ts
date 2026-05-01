import { OrchestratorResult } from './recommendation-orchestrator';

export async function generateMLRecommendation(
  _learnworldsUserId: string
): Promise<OrchestratorResult | null> {
  throw new Error('ML inference not yet implemented (Phase 4)');
}
