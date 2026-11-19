import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  StarHopperCanvas,
  type StarHopperHandle,
} from './components/StarHopperCanvas';
import type { GameState, HeldControl, HeldControlsState, HudSnapshot } from './types/game';
import { soundEngine } from './utils/sound';

const INITIAL_HUD: HudSnapshot = {
  score: 0,
  best: 0,
  level: 1,
  lives: 3,
};

export default function App() {
  const [gameState, setGameState] = useState<GameState>('READY');
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [soundOn, setSoundOn] = useState(true);
  const [message, setMessage] = useState("Tap Start when you're ready.");
  const [activePad, setActivePad] = useState<HeldControlsState>({
    left: false,
    right: false,
    up: false,
    down: false,
    fire: false,
  });

  const gameRef = useRef<StarHopperHandle | null>(null);
  const heldControlsRef = useRef<HeldControlsState>({
    left: false,
    right: false,
    up: false,
    down: false,
    fire: false,
  });

  const setHeldControl = useCallback((key: HeldControl, pressed: boolean) => {
    if (heldControlsRef.current[key] === pressed) return;
    heldControlsRef.current[key] = pressed;
    setActivePad((prev) => (prev[key] === pressed ? prev : { ...prev, [key]: pressed }));
  }, []);

  useEffect(() => {
    const clearAllHolds = () => {
      heldControlsRef.current = {
        left: false,
        right: false,
        up: false,
        down: false,
        fire: false,
      };
      setActivePad({
        left: false,
        right: false,
        up: false,
        down: false,
        fire: false,
      });
    };
    window.addEventListener('blur', clearAllHolds);
    return () => window.removeEventListener('blur', clearAllHolds);
  }, []);

  const handleMainAction = () => {
    gameRef.current?.startGame();
  };

  const handlePauseAction = () => {
    gameRef.current?.togglePause();
  };

  const handleToggleSound = () => {
    const next = !soundOn;
    soundEngine.enabled = next;
    setSoundOn(next);
    if (next) {
      soundEngine.ensureContext();
      soundEngine.playToggleOn();
    }
  };

  const makePadHandlers = (control: HeldControl) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      soundEngine.ensureContext();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture is unavailable
      }
      setHeldControl(control, true);
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      setHeldControl(control, false);
    },
    onPointerCancel: () => {
      setHeldControl(control, false);
    },
    onLostPointerCapture: () => {
      setHeldControl(control, false);
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  const mainBtnLabel =
    gameState === 'READY'
      ? '▶ Start'
      : gameState === 'GAME_OVER'
        ? '▶ Play Again'
        : '↻ Restart';

  const pauseBtnLabel = gameState === 'PAUSED' ? '▶ Resume' : '⏸ Pause';

  const heartsDisplay = Array.from({ length: 3 }, (_, idx) =>
    idx < hud.lives ? '❤️' : '🖤'
  ).join('');

  return (
    <main className="mx-auto max-w-[880px] px-4 pt-5 pb-8">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-sm font-bold tracking-wide text-[var(--muted)]">
            Mini Space Game
          </p>
          <h1 className="m-0 text-[clamp(32px,6vw,52px)] font-black leading-[0.95] tracking-[-0.02em] text-balance">
            STAR <span className="text-[var(--amber-text)]">HOPPER</span>
          </h1>
          <p className="mt-2 mb-0 max-w-[540px] text-[18px] sm:text-[19px] leading-[1.45] text-[var(--muted)]">
            A light little space game.{' '}
            <strong className="text-[var(--ink)]">
              Fly, dodge the rocks, grab the stars, and blast your way through.
            </strong>{' '}
            No sign-up, no pressure — just play for a bit.
          </p>
        </div>
      </header>

      <section
        className="mb-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5"
        aria-label="Game scoreboard"
        aria-live="polite"
      >
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-3.5 py-3">
          <span className="block text-xs font-extrabold tracking-[0.08em] uppercase text-[var(--muted)] mb-0.5">
            Score
          </span>
          <b className="font-mono tabular-nums text-[28px] leading-none font-extrabold">
            {hud.score}
          </b>
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-3.5 py-3">
          <span className="block text-xs font-extrabold tracking-[0.08em] uppercase text-[var(--muted)] mb-0.5">
            Best this visit
          </span>
          <b className="font-mono tabular-nums text-[28px] leading-none font-extrabold">
            {hud.best}
          </b>
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-3.5 py-3">
          <span className="block text-xs font-extrabold tracking-[0.08em] uppercase text-[var(--muted)] mb-0.5">
            Level
          </span>
          <b className="font-mono tabular-nums text-[28px] leading-none font-extrabold">
            {hud.level}
          </b>
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-3.5 py-3">
          <span className="block text-xs font-extrabold tracking-[0.08em] uppercase text-[var(--muted)] mb-0.5">
            Lives ({hud.lives}/3)
          </span>
          <div
            className="text-[24px] leading-none tracking-[2px]"
            aria-label={`${hud.lives} out of 3 lives remaining`}
          >
            {heartsDisplay}
          </div>
        </div>
      </section>

      <StarHopperCanvas
        gameRef={gameRef}
        gameState={gameState}
        hud={hud}
        heldControlsRef={heldControlsRef}
        onStateChange={setGameState}
        onHudChange={setHud}
        onMessageChange={setMessage}
      />

      <div className="mt-3 flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={handleMainAction}
          className="flex-1 min-w-[130px] min-h-[54px] inline-flex items-center justify-center gap-2 rounded-full bg-[var(--amber)] px-6 py-3.5 text-[18px] font-extrabold text-[#1a1200] transition-transform duration-150 hover:brightness-105 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] whitespace-nowrap shrink-0 cursor-pointer"
        >
          {mainBtnLabel}
        </button>

        <button
          type="button"
          onClick={handlePauseAction}
          className="flex-1 min-w-[130px] min-h-[54px] inline-flex items-center justify-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel)] px-6 py-3.5 text-[18px] font-extrabold text-[var(--ink)] transition-transform duration-150 hover:brightness-95 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--amber)] whitespace-nowrap shrink-0 cursor-pointer"
        >
          {pauseBtnLabel}
        </button>

        <button
          type="button"
          onClick={handleToggleSound}
          aria-pressed={soundOn}
          className="flex-1 min-w-[150px] min-h-[54px] inline-flex items-center justify-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel)] px-6 py-3.5 text-[18px] font-extrabold text-[var(--ink)] transition-transform duration-150 hover:brightness-95 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--amber)] whitespace-nowrap shrink-0 cursor-pointer"
        >
          {soundOn ? '🔊 Sound: On' : '🔇 Sound: Off'}
        </button>
      </div>

      <p
        className="mt-3 min-h-[28px] text-center text-[17px] font-bold text-[var(--amber-text)]"
        aria-live="polite"
      >
        {message}
      </p>

      <section
        className="mt-3.5 rounded-[18px] border border-[var(--line)] bg-[var(--panel)] p-4"
        aria-label="Touch controls"
      >
        <h2 className="m-0 mb-1.5 text-[16px] font-extrabold">
          Touch &amp; mouse controls
        </h2>
        <p className="m-0 mb-3 text-[16px] leading-[1.4] text-[var(--muted)]">
          You can also{' '}
          <strong className="text-[var(--ink)]">
            drag your finger (or mouse) on the game screen
          </strong>{' '}
          to steer — that&apos;s the easiest way on a phone. Or use these big
          buttons:
        </p>

        <div className="mx-auto grid max-w-[520px] grid-cols-3 gap-2.5">
          <span aria-hidden="true" />
          <button
            type="button"
            aria-label="Move up"
            {...makePadHandlers('up')}
            className={`min-h-[64px] rounded-2xl border border-[var(--line)] text-[26px] font-black touch-none select-none transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--amber)] cursor-pointer ${
              activePad.up
                ? 'bg-[var(--amber)] text-[#111]'
                : 'bg-[var(--pad-bg)] text-[var(--ink)]'
            }`}
          >
            ↑
          </button>
          <span aria-hidden="true" />

          <button
            type="button"
            aria-label="Move left"
            {...makePadHandlers('left')}
            className={`min-h-[64px] rounded-2xl border border-[var(--line)] text-[26px] font-black touch-none select-none transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--amber)] cursor-pointer ${
              activePad.left
                ? 'bg-[var(--amber)] text-[#111]'
                : 'bg-[var(--pad-bg)] text-[var(--ink)]'
            }`}
          >
            ←
          </button>

          <button
            type="button"
            aria-label="Fire"
            {...makePadHandlers('fire')}
            className={`min-h-[64px] rounded-2xl border border-transparent text-[18px] font-black tracking-[0.02em] text-white touch-none select-none transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] whitespace-nowrap shrink-0 cursor-pointer ${
              activePad.fire
                ? 'bg-[#d9361a]'
                : 'bg-[var(--coral)] hover:bg-[var(--coral-hover)]'
            }`}
          >
            ● FIRE
          </button>

          <button
            type="button"
            aria-label="Move right"
            {...makePadHandlers('right')}
            className={`min-h-[64px] rounded-2xl border border-[var(--line)] text-[26px] font-black touch-none select-none transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--amber)] cursor-pointer ${
              activePad.right
                ? 'bg-[var(--amber)] text-[#111]'
                : 'bg-[var(--pad-bg)] text-[var(--ink)]'
            }`}
          >
            →
          </button>

          <span aria-hidden="true" />
          <button
            type="button"
            aria-label="Move down"
            {...makePadHandlers('down')}
            className={`min-h-[64px] rounded-2xl border border-[var(--line)] text-[26px] font-black touch-none select-none transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--amber)] cursor-pointer ${
              activePad.down
                ? 'bg-[var(--amber)] text-[#111]'
                : 'bg-[var(--pad-bg)] text-[var(--ink)]'
            }`}
          >
            ↓
          </button>
          <span aria-hidden="true" />
        </div>
      </section>

      <section
        className="mt-3.5 grid grid-cols-1 sm:grid-cols-3 gap-2.5"
        aria-label="How to play"
      >
        <article className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <div className="mb-2 text-[32px] leading-none" aria-hidden="true">
            ⭐
          </div>
          <h3 className="m-0 mb-1.5 text-[18px] font-extrabold">Collect stars</h3>
          <p className="m-0 text-[16px] leading-[1.5] text-[var(--muted)]">
            Each gold star is{' '}
            <strong className="text-[var(--ink)]">+25 points</strong>. A green
            fuel cell is <strong className="text-[var(--ink)]">+50</strong> and
            pops up now and then.
          </p>
        </article>

        <article className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <div className="mb-2 text-[32px] leading-none" aria-hidden="true">
            ☄️
          </div>
          <h3 className="m-0 mb-1.5 text-[18px] font-extrabold">
            Dodge or blast rocks
          </h3>
          <p className="m-0 text-[16px] leading-[1.5] text-[var(--muted)]">
            Shoot an asteroid for{' '}
            <strong className="text-[var(--ink)]">+10 points</strong>. If one
            hits you, you lose a heart. You get 3 hearts.
          </p>
        </article>

        <article className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <div className="mb-2 text-[32px] leading-none" aria-hidden="true">
            ⌨️
          </div>
          <h3 className="m-0 mb-1.5 text-[18px] font-extrabold">
            Keys that work
          </h3>
          <p className="m-0 text-[16px] leading-[1.6] text-[var(--muted)]">
            <kbd className="rounded-md bg-[var(--ink)] px-1.5 py-0.5 font-mono text-[13px] font-bold text-[var(--bg)]">
              ←
            </kbd>{' '}
            <kbd className="rounded-md bg-[var(--ink)] px-1.5 py-0.5 font-mono text-[13px] font-bold text-[var(--bg)]">
              →
            </kbd>{' '}
            <kbd className="rounded-md bg-[var(--ink)] px-1.5 py-0.5 font-mono text-[13px] font-bold text-[var(--bg)]">
              ↑
            </kbd>{' '}
            <kbd className="rounded-md bg-[var(--ink)] px-1.5 py-0.5 font-mono text-[13px] font-bold text-[var(--bg)]">
              ↓
            </kbd>{' '}
            or{' '}
            <kbd className="rounded-md bg-[var(--ink)] px-1.5 py-0.5 font-mono text-[13px] font-bold text-[var(--bg)]">
              W A S D
            </kbd>{' '}
            to move &nbsp;•&nbsp;{' '}
            <kbd className="rounded-md bg-[var(--ink)] px-1.5 py-0.5 font-mono text-[13px] font-bold text-[var(--bg)]">
              Space
            </kbd>{' '}
            to shoot &nbsp;•&nbsp;{' '}
            <kbd className="rounded-md bg-[var(--ink)] px-1.5 py-0.5 font-mono text-[13px] font-bold text-[var(--bg)]">
              P
            </kbd>{' '}
            to pause
          </p>
        </article>
      </section>

      <footer className="mt-4 text-center text-[15px] leading-[1.5] text-[var(--muted)]">
        Made for a light break. It gets a tiny bit faster each level — see how
        far you can get, Jamie. No score is saved when you close the page.
      </footer>
    </main>
  );
}
