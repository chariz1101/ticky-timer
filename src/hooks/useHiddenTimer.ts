import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Sustained, high-pitched buzzer for the start of a run — like a basketball
 * shot-clock horn. Two slightly-detuned oscillators (sawtooth + square)
 * layered together give it that harsh, buzzy texture instead of a clean tone.
 */
function playStartBuzzer(ctx: AudioContext) {
  const duration = 0.55;
  const now = ctx.currentTime;

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc1.type = "sawtooth";
  osc2.type = "square";
  osc1.frequency.value = 1046; // C6 — high and piercing
  osc2.frequency.value = 1052; // slightly detuned from osc1 for the "buzz" beat

  // Quick attack, sustained buzz, short release at the very end.
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.14, now + 0.015);
  gain.gain.setValueAtTime(0.14, now + duration - 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + duration);
  osc2.stop(now + duration);
}

/**
 * Short, soft chirp for the end of a run — a quick single blip, clearly
 * distinct from the long start buzzer.
 */
function playStopChirp(ctx: AudioContext) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 587;

  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.15, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.1);
}

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
 *              is disabled. Each run also starts from zero automatically,
 *              so there's no need for a Reset button in this mode.
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
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Created lazily, on the first spacebar press, so it's tied to a real user
  // gesture (browsers block audio that starts without one).
  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const getElapsedMs = useCallback(() => {
    const running = runStartRef.current !== null;
    if (!running) return accumulatedMsRef.current;
    return accumulatedMsRef.current + (performance.now() - runStartRef.current!);
  }, []);

  const toggleRunning = useCallback(() => {
    if (runStartRef.current === null) {
      // starting
      if (modeRef.current === "auto") {
        // Each run in auto mode starts from zero — no manual reset needed.
        accumulatedMsRef.current = 0;
      }
      runStartRef.current = performance.now();
      setRunning(true);
      if (modeRef.current === "auto") setRevealed(false);
      playStartBuzzer(getAudioCtx());
    } else {
      // stopping
      accumulatedMsRef.current += performance.now() - runStartRef.current;
      runStartRef.current = null;
      setRunning(false);
      if (modeRef.current === "auto") setRevealed(true);
      playStopChirp(getAudioCtx());
    }
  }, [getAudioCtx]);

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
    // Switching modes mid-run (or with leftover time sitting around) would
    // leave an ambiguous state — e.g. stale elapsed time from a manual
    // session suddenly showing up "revealed" the moment you flip to auto,
    // with no Reset button visible in auto mode to clear it. So changing
    // modes always starts a clean slate: zeroed, stopped, hidden.
    accumulatedMsRef.current = 0;
    runStartRef.current = null;
    setRunning(false);
    setRevealed(false);
    setModeState(next);
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

  // Release the audio device when the component goes away.
  useEffect(() => {
    return () => {
      audioCtxRef.current?.close();
    };
  }, []);

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