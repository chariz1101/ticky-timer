import { useCallback, useEffect, useRef, useState } from "react";

function playStartBuzzer(ctx: AudioContext) {
  const duration = 0.55;
  const now = ctx.currentTime;

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc1.type = "sawtooth";
  osc2.type = "square";
  osc1.frequency.value = 1046; 
  osc2.frequency.value = 1052; 

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
        // Each run in auto mode starts from zero 
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
    if (modeRef.current === "auto") return;
    setRevealed((r) => !r);
  }, []);

  const setMode = useCallback((next: TimerMode) => {
    accumulatedMsRef.current = 0;
    runStartRef.current = null;
    setRunning(false);
    setRevealed(false);
    setModeState(next);
  }, []);

  const toggleMode = useCallback(() => {
    setMode(modeRef.current === "auto" ? "manual" : "auto");
  }, [setMode]);

  useEffect(() => {
    if (revealed && running) {
      intervalRef.current = window.setInterval(() => {
        forceRender((n) => n + 1);
      }, 47);
      return () => {
        if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
      };
    }
    return undefined;
  }, [revealed, running]);

  useEffect(() => {
    return () => {
      audioCtxRef.current?.close();
    };
  }, []);

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