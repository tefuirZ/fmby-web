import { ArtPlayerEngineAdapter } from './engines/ArtPlayerEngine';
import { DPlayerEngineAdapter } from './engines/DPlayerEngine';
import { resolvePlayerEngineId } from './playerConfig';
import type { PlayerEngine, PlayerEngineCreateOptions } from './types';

const artPlayerAdapter = new ArtPlayerEngineAdapter();
const dplayerAdapter = new DPlayerEngineAdapter();

export { resolvePlayerEngineId } from './playerConfig';

export async function createPlayerEngine(
  options: PlayerEngineCreateOptions,
): Promise<PlayerEngine> {
  const engineId = resolvePlayerEngineId();

  switch (engineId) {
    case 'artplayer':
      return artPlayerAdapter.create(options);
    case 'dplayer':
    default:
      return dplayerAdapter.create(options);
  }
}