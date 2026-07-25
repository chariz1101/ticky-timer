import { useMemo } from "react";
import { useHiddenTimer } from "../hooks/useHiddenTimer";
import "./TickyTimer.css";

function formatElapsed(ms: number): { mm: string; ss: string; cc: string } {
  const totalCentis = Math.floor(ms / 10);
  const mm = Math.floor(totalCentis / 6000);
  const ss = Math.floor((totalCentis % 6000) / 100);
  const cc = totalCentis % 100;
  return {
    mm: String(mm).padStart(2, "0"),
    ss: String(ss).padStart(2, "0"),
    cc: String(cc).padStart(2, "0"),
  };
}

const BEZEL_TICKS = 60;

export default function TickyTimer() {
  const { elapsedMs, running, revealed, mode, reset, toggleRevealed, setMode } = useHiddenTimer();

  const { mm, ss, cc } = useMemo(() => formatElapsed(elapsedMs), [elapsedMs]);

  const statusLabel = running ? "running" : elapsedMs > 0 ? "stopped" : "armed";

  const ticks = useMemo(
    () =>
      Array.from({ length: BEZEL_TICKS }, (_, i) => {
        const angle = (i / BEZEL_TICKS) * 360;
        const major = i % 5 === 0;
        return (
          <div
            key={i}
            className={`ticky-bezel-tick${major ? " ticky-bezel-tick--major" : ""}`}
            style={{ transform: `rotate(${angle}deg)` }}
          />
        );
      }),
    []
  );

  return (
    <div className="ticky-stage">
      <div className="ticky-eyebrow">ticky&nbsp;timer</div>

      <div className="ticky-mode-switch" role="group" aria-label="Reveal mode">
        <button
          type="button"
          className={`ticky-mode-btn${mode === "auto" ? " ticky-mode-btn--active" : ""}`}
          onClick={() => setMode("auto")}
          disabled={running}
        >
          Auto
        </button>
        <button
          type="button"
          className={`ticky-mode-btn${mode === "manual" ? " ticky-mode-btn--active" : ""}`}
          onClick={() => setMode("manual")}
          disabled={running}
        >
          Manual
        </button>
      </div>

      <div className={`ticky-dial${running ? " ticky-dial--running" : ""}`}>
        <div className="ticky-bezel">{ticks}</div>

        <div className="ticky-face">
          <div className={`ticky-readout${revealed ? " ticky-readout--revealed" : ""}`}>
            {revealed ? (
              <>
                <span>{mm}</span>
                <span className="ticky-colon">:</span>
                <span>{ss}</span>
                <span className="ticky-centis">.{cc}</span>
              </>
            ) : (
              <span className="ticky-mask">••:••</span>
            )}
          </div>
          <div className="ticky-status">{statusLabel}</div>
        </div>
      </div>

      <p className="ticky-hint">
        Press <kbd>Space</kbd> to {running ? "stop" : "start"}
        {mode === "auto" ? " · hides on start, reveals on stop" : ""}
      </p>

      <div className="ticky-controls">
        {mode === "manual" && (
          <button type="button" className="ticky-btn ticky-btn--reset" onClick={reset}>
            Reset
          </button>
        )}
        {mode === "manual" && (
          <button type="button" className="ticky-btn ticky-btn--reveal" onClick={toggleRevealed}>
            {revealed ? "Hide" : "Reveal"}
          </button>
        )}
      </div>
    </div>
  );
}