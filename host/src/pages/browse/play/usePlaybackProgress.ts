import { useCallback, useEffect, useRef } from 'react';
import { playbackApi } from '@fmby/v2-shared/contracts/playback';
import { clearLocalPosition, readLocalPosition, saveLocalPosition } from './playbackStorage';

const PROGRESS_REPORT_INTERVAL = 15_000;

function reportInBackground(request: Promise<unknown>) {
  void request.catch(() => {
    // Playback telemetry must not create an unhandled rejection or interrupt playback.
  });
}

interface UsePlaybackProgressOptions {
  itemId?: string;
  sessionId?: string;
  resumePositionSeconds?: number;
}

export function usePlaybackProgress({
  itemId,
  sessionId,
  resumePositionSeconds,
}: UsePlaybackProgressOptions) {
  const lastReportedRef = useRef(0);
  const latestTimeRef = useRef({ current: 0, duration: 0 });
  const resumePosition = resumePositionSeconds ?? readLocalPosition(itemId) ?? 0;

  useEffect(() => {
    if (!sessionId) return;

    const interval = window.setInterval(() => {
      const { current, duration } = latestTimeRef.current;
      if (current <= 0) return;
      if (Date.now() - lastReportedRef.current < 10_000) return;
      lastReportedRef.current = Date.now();
      reportInBackground(playbackApi.reportProgress(sessionId, {
        positionSeconds: current,
        durationSeconds: duration > 0 ? duration : undefined,
        paused: false,
      }));
    }, PROGRESS_REPORT_INTERVAL);

    return () => window.clearInterval(interval);
  }, [sessionId]);

  useEffect(() => {
    return () => {
      if (!sessionId) return;
      const { current, duration } = latestTimeRef.current;
      reportInBackground(playbackApi.stopSession(sessionId, {
        positionSeconds: current,
        durationSeconds: duration > 0 ? duration : undefined,
        completed: duration > 0 && current / duration >= 0.95,
      }));
    };
  }, [sessionId]);

  const handleTimeUpdate = useCallback(
    (currentTime: number, duration: number) => {
      latestTimeRef.current = { current: currentTime, duration };
      if (itemId && currentTime > 0) {
        saveLocalPosition(itemId, currentTime);
      }
    },
    [itemId],
  );

  const handlePause = useCallback(
    (currentTime: number, duration: number) => {
      if (!sessionId) return;
      lastReportedRef.current = Date.now();
      reportInBackground(playbackApi.reportProgress(sessionId, {
        positionSeconds: currentTime,
        durationSeconds: duration > 0 ? duration : undefined,
        paused: true,
      }));
    },
    [sessionId],
  );

  const handleEnded = useCallback(
    (currentTime: number, duration: number) => {
      if (!sessionId) return;
      reportInBackground(playbackApi.stopSession(sessionId, {
        positionSeconds: currentTime,
        durationSeconds: duration > 0 ? duration : undefined,
        completed: true,
      }));
      if (itemId) {
        clearLocalPosition(itemId);
      }
    },
    [sessionId, itemId],
  );

  return {
    resumePosition,
    handleTimeUpdate,
    handlePause,
    handleEnded,
  };
}