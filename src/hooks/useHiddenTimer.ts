import { useCallback, useEffect, useRef, useState } from "react";

export type TimerMode = "auto" | "manual";

export interface HiddenTimerState {
  /** Elapsed milliseconds. Only meaningful to show the user when `revealed` is true. */
  elapsedMs: number;
  running: boolean;
  revealed: boolean;
  mode: TimerMode;
  toggleRunning: () => void;
  reset: () => void;
  toggleRevealed: () => void;
  setMode: (mode: TimerMode) => void;
  toggleMode: () => void;
}

/**
 * Tracks elapsed time without forcing re-renders on every tick.
 * The clock only "wakes up" (re-renders on an interval) while the
 * timer is both running AND revealed — otherwise it silently
 * accumulates time in a ref so nothing leaks to the UI.
 *
 * Two reveal modes:
 *  - "auto":   revealed is driven entirely by run state. Starting the
 *              timer hides it, stopping it reveals it. Manual toggling
 *              is disabled.
 *  - "manual": revealed is fully user-controlled via toggleRevealed,
 *              independent of running state (original behavior).
 */
export function useHiddenTimer(): HiddenTimerState {
  const [running, setRunning] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [mode, setModeState] = useState<TimerMode>("manual");
  const [, forceRender] = useState(0);

  const accumulatedMsRef = useRef(0);
  const runStartRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const getElapsedMs = useCallback(() => {
    const running = runStartRef.current !== null;
    if (!running) return accumulatedMsRef.current;
    return accumulatedMsRef.current + (performance.now() - runStartRef.current!);
  }, []);

  const toggleRunning = useCallback(() => {
    if (runStartRef.current === null) {
      if (modeRef.current === "auto") {
        // Each run in auto mode starts from zero — no manual reset needed.
        accumulatedMsRef.current = 0;
      }
      runStartRef.current = performance.now();
      setRunning(true);
      if (modeRef.current === "auto") setRevealed(false);
    } else {
      accumulatedMsRef.current += performance.now() - runStartRef.current;
      runStartRef.current = null;
      setRunning(false);
      if (modeRef.current === "auto") setRevealed(true);
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
    // Manual reveal is disabled in auto mode; reveal state there is
    // purely a function of running.
    if (modeRef.current === "auto") return;
    setRevealed((r) => !r);
  }, []);

  const setMode = useCallback((next: TimerMode) => {
    setModeState(next);
    if (next === "auto") {
      // Sync reveal state to whatever it "should" be right now:
      // hidden while running, shown while stopped.
      setRevealed(runStartRef.current === null);
    }
  }, []);

  const toggleMode = useCallback(() => {
    setMode(modeRef.current === "auto" ? "manual" : "auto");
  }, [setMode]);

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
  // (so Reset / Reveal / Mode keep their own Enter/Space behavior without double-firing).
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
    mode,
    toggleRunning,
    reset,
    toggleRevealed,
    setMode,
    toggleMode,
  };
}