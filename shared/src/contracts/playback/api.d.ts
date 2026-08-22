import type { PlaybackProgressUpdate, PlaybackSession } from './types';
export declare const playbackApi: {
    createSession(itemId: string): Promise<PlaybackSession>;
    reportProgress(sessionId: string, payload: PlaybackProgressUpdate): Promise<void>;
    stopSession(sessionId: string, payload: PlaybackProgressUpdate): Promise<void>;
};
//# sourceMappingURL=api.d.ts.map