import { ArtPlayerEngineAdapter } from './engines/ArtPlayerEngine';
import { DPlayerEngineAdapter } from './engines/DPlayerEngine';
import { resolvePlayerEngineId } from './playerConfig';
import type { PlayerEngine, PlayerEngineAdapter, PlayerEngineCreateOptions, PlayerEngineId } from './types';

const playerEngineRegistry: Record<PlayerEngineId, PlayerEngineAdapter> = {
  dplayer: new DPlayerEngineAdapter(),
  artplayer: new ArtPlayerEngineAdapter(),
};

export async function createPlayerEngine(
  options: PlayerEngineCreateOptions,
  engineId: PlayerEngineId = resolvePlayerEngineId(),
): Promise<PlayerEngine> {
  return playerEngineRegistry[engineId].create(options);
}
