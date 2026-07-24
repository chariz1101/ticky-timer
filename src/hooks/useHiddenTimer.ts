import { useCallback, useEffect, useRef, useState } from "react";

export interface HiddenTimerState {
  /** Elapsed milliseconds. Only meaningful to show the user when `revealed` is true. */
  elapsedMs: number;
  running: boolean;
  revealed: boolean;
  toggleRunning: () => void;
  reset: () => void;
  toggleRevealed: () => void;
}

/**
 * Tracks elapsed time without forcing re-renders on every tick.
 * The clock only "wakes up" (re-renders on an interval) while the
 * timer is both running AND revealed — otherwise it silently
 * accumulates time in a ref so nothing leaks to the UI.
 */
export function useHiddenTimer(): HiddenTimerState {
  const [running, setRunning] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [, forceRender] = useState(0);

  const accumulatedMsRef = useRef(0);
  const runStartRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  const getElapsedMs = useCallback(() => {
    const running = runStartRef.current !== null;
    if (!running) return accumulatedMsRef.current;
    return accumulatedMsRef.current + (performance.now() - runStartRef.current!);
  }, []);

  const toggleRunning = useCallback(() => {
    if (runStartRef.current === null) {
      runStartRef.current = performance.now();
      setRunning(true);
    } else {
      accumulatedMsRef.current += performance.now() - runStartRef.current;
      runStartRef.current = null;
      setRunning(false);
    }
  }, []);

  const reset = useCallback(() => {
    accumulatedMsRef.current = 0;
    if (runStartRef.current !== null) {
      runStartRef.current = performance.now();
    }
    forceRender((n) => n + 1);
  }, []);

  const toggleRevealed = useCallback(() => {
    setRevealed((r) => !r);
  }, []);

  // Only run a visible ticking interval when revealed AND running.
  useEffect(() => {
    if (revealed && running) {
      intervalRef.current = window.setInterval(() => {
        forceRender((n) => n + 1);
      }, 47); // slightly off-beat interval keeps the centiseconds feeling analog, not robotic
      return () => {
        if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
      };
    }
    return undefined;
  }, [revealed, running]);

  // Spacebar starts/stops the timer, but never while focus is on a button
  // (so Reset / Reveal keep their own Enter/Space behavior without double-firing).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const target = e.target as HTMLElement | null;
      const isInteractive = target && (target.tagName === "BUTTON" || target.tagName === "INPUT");
      if (isInteractive) return;
      e.preventDefault();
      toggleRunning();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleRunning]);

  return {
    elapsedMs: getElapsedMs(),
    running,
    revealed,
    toggleRunning,
    reset,
    toggleRevealed,
  };
}