import React, { useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import type {
  Asteroid,
  Bullet,
  CollectibleStar,
  FuelCell,
  GameState,
  HeldControlsState,
  HudSnapshot,
  Particle,
  StarBg,
} from '../types/game';
import { soundEngine } from '../utils/sound';

const LOGICAL_WIDTH = 800;
const LOGICAL_HEIGHT = 500;
const MAX_LIVES = 3;

export interface StarHopperHandle {
  startGame: () => void;
  togglePause: () => void;
  resumeGame: () => void;
}

interface StarHopperCanvasProps {
  gameState: GameState;
  hud: HudSnapshot;
  heldControlsRef: React.MutableRefObject<HeldControlsState>;
  onStateChange: (next: GameState) => void;
  onHudChange: (next: HudSnapshot) => void;
  onMessageChange: (msg: string) => void;
  gameRef: React.Ref<StarHopperHandle>;
}

function createInitialBgStars(): StarBg[] {
  const stars: StarBg[] = [];
  for (let i = 0; i < 90; i++) {
    stars.push({
      x: Math.random() * LOGICAL_WIDTH,
      y: Math.random() * LOGICAL_HEIGHT,
      r: Math.random() * 1.8 + 0.4,
      speed: Math.random() * 28 + 10,
    });
  }
  return stars;
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function StarHopperCanvas({
  gameState,
  hud,
  heldControlsRef,
  onStateChange,
  onHudChange,
  onMessageChange,
  gameRef,
}: StarHopperCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Mutable simulation state kept in refs for zero-overhead 60fps loop
  const stateRef = useRef<GameState>('READY');
  const scoreRef = useRef(0);
  const bestRef = useRef(0);
  const levelRef = useRef(1);
  const livesRef = useRef(MAX_LIVES);

  const playerRef = useRef({
    x: LOGICAL_WIDTH / 2,
    y: LOGICAL_HEIGHT - 90,
    r: 20,
    speed: 420,
  });

  const bulletsRef = useRef<Bullet[]>([]);
  const asteroidsRef = useRef<Asteroid[]>([]);
  const starsRef = useRef<CollectibleStar[]>([]);
  const fuelsRef = useRef<FuelCell[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const bgStarsRef = useRef<StarBg[]>(createInitialBgStars());

  const keysRef = useRef<Record<string, boolean>>({});
  const touchMoveRef = useRef<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);

  const rafIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const spawnTimerRef = useRef(0);
  const starTimerRef = useRef(0);
  const fuelTimerRef = useRef(3);
  const fireCooldownRef = useRef(0);
  const invulnUntilRef = useRef(0);

  const syncHud = useCallback(() => {
    onHudChange({
      score: scoreRef.current,
      best: bestRef.current,
      level: levelRef.current,
      lives: livesRef.current,
    });
  }, [onHudChange]);

  const explode = useCallback((x: number, y: number, color: string, count = 14) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 180;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.55,
        max: 0.55,
        color,
      });
    }
  }, []);

  const shoot = useCallback(() => {
    if (fireCooldownRef.current > 0) return;
    fireCooldownRef.current = 0.22;
    bulletsRef.current.push({
      x: playerRef.current.x,
      y: playerRef.current.y - 24,
      vy: -560,
      r: 5,
    });
    soundEngine.playShoot();
  }, []);

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = LOGICAL_WIDTH * dpr;
    const targetH = LOGICAL_HEIGHT * dpr;
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // Background drifting starfield
    ctx.fillStyle = '#ffffff';
    const bgStars = bgStarsRef.current;
    for (let i = 0; i < bgStars.length; i++) {
      const b = bgStars[i];
      ctx.globalAlpha = 0.35 + (b.r / 2) * 0.3;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Distant planet
    ctx.beginPath();
    ctx.arc(LOGICAL_WIDTH - 110, 78, 34, 0, Math.PI * 2);
    ctx.fillStyle = '#1d3a5f';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(LOGICAL_WIDTH - 122, 66, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#2a507c';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(LOGICAL_WIDTH - 96, 88, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#2a507c';
    ctx.fill();

    // Fuel cells
    const fuels = fuelsRef.current;
    for (let fi = 0; fi < fuels.length; fi++) {
      const f = fuels[fi];
      ctx.fillStyle = '#16a34a';
      ctx.strokeStyle = '#bbf7d0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(f.x - 13, f.y - 15, 26, 30, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('F', f.x, f.y + 1);
    }

    // Collectible gold stars
    const stars = starsRef.current;
    for (let si = 0; si < stars.length; si++) {
      const s = stars[si];
      const sc = 1 + Math.sin(s.pulse) * 0.12;
      const rot = Math.sin(s.pulse * 0.4) * 0.3;
      const radOuter = s.r * sc;
      ctx.save();
      ctx.shadowColor = '#ffd23f';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const ang = rot + (i * Math.PI) / 5 - Math.PI / 2;
        const rad = i % 2 === 0 ? radOuter : radOuter * 0.48;
        const px = s.x + Math.cos(ang) * rad;
        const py = s.y + Math.sin(ang) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = '#ffd23f';
      ctx.fill();
      ctx.restore();
    }

    // Asteroids
    const asteroids = asteroidsRef.current;
    for (let ai = 0; ai < asteroids.length; ai++) {
      const a = asteroids[ai];
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.rot);
      ctx.beginPath();
      const pts = 8;
      for (let k = 0; k < pts; k++) {
        const ang = (k / pts) * Math.PI * 2;
        const rad =
          a.r * (0.78 + ((Math.sin(a.seed * 10 + k * 2.3) + 1) / 2) * 0.32);
        const px = Math.cos(ang) * rad;
        const py = Math.sin(ang) * rad;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = '#8a6f55';
      ctx.fill();
      ctx.strokeStyle = '#5d4a36';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-a.r * 0.25, -a.r * 0.15, a.r * 0.18, 0, Math.PI * 2);
      ctx.fillStyle = '#6e5843';
      ctx.fill();
      ctx.restore();
    }

    // Bullets
    const bullets = bulletsRef.current;
    ctx.fillStyle = '#7df9ff';
    for (let bi = 0; bi < bullets.length; bi++) {
      const bl = bullets[bi];
      ctx.beginPath();
      ctx.roundRect(bl.x - 3, bl.y - 10, 6, 16, 3);
      ctx.fill();
    }

    // Particles
    const particles = particlesRef.current;
    for (let pi = 0; pi < particles.length; pi++) {
      const p = particles[pi];
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Player spacecraft
    const now = performance.now();
    const blink =
      now < invulnUntilRef.current && Math.floor(now / 120) % 2 === 0;
    const player = playerRef.current;
    ctx.save();
    ctx.translate(player.x, player.y);
    if (blink) ctx.globalAlpha = 0.35;

    // Thruster flame
    const flame = 14 + Math.random() * 8;
    ctx.beginPath();
    ctx.moveTo(-7, 16);
    ctx.lineTo(0, 16 + flame);
    ctx.lineTo(7, 16);
    ctx.closePath();
    ctx.fillStyle = '#ff9f1a';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-4, 16);
    ctx.lineTo(0, 16 + flame * 0.55);
    ctx.lineTo(4, 16);
    ctx.closePath();
    ctx.fillStyle = '#ffd23f';
    ctx.fill();

    // Ship hull
    ctx.beginPath();
    ctx.moveTo(0, -26);
    ctx.lineTo(7, -6);
    ctx.lineTo(22, 14);
    ctx.lineTo(12, 18);
    ctx.lineTo(5, 10);
    ctx.lineTo(-5, 10);
    ctx.lineTo(-12, 18);
    ctx.lineTo(-22, 14);
    ctx.lineTo(-7, -6);
    ctx.closePath();
    ctx.fillStyle = '#e8eef5';
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Nose accent
    ctx.beginPath();
    ctx.moveTo(0, -26);
    ctx.lineTo(5, 2);
    ctx.lineTo(-5, 2);
    ctx.closePath();
    ctx.fillStyle = '#ff4d2e';
    ctx.fill();

    // Cockpit window
    ctx.beginPath();
    ctx.arc(0, -4, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = '#0fb5d6';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }, []);

  const triggerGameOver = useCallback(() => {
    stateRef.current = 'GAME_OVER';
    if (scoreRef.current > bestRef.current) {
      bestRef.current = scoreRef.current;
    }
    syncHud();
    onStateChange('GAME_OVER');
    onMessageChange(
      `Game over. You scored ${scoreRef.current}. Tap Play Again for another go.`
    );
    soundEngine.playGameOver();
  }, [onMessageChange, onStateChange, syncHud]);

  const updateSimulation = useCallback(
    (dt: number) => {
      let hudDirty = false;

      // Drifting background stars
      const bgStars = bgStarsRef.current;
      for (let i = 0; i < bgStars.length; i++) {
        bgStars[i].y += bgStars[i].speed * dt;
        if (bgStars[i].y > LOGICAL_HEIGHT + 4) {
          bgStars[i].y = -4;
          bgStars[i].x = Math.random() * LOGICAL_WIDTH;
        }
      }

      // Movement
      const keys = keysRef.current;
      const held = heldControlsRef.current;
      const player = playerRef.current;
      let vx = 0;
      let vy = 0;

      if (keys['arrowleft'] || keys['a']) vx -= 1;
      if (keys['arrowright'] || keys['d']) vx += 1;
      if (keys['arrowup'] || keys['w']) vy -= 1;
      if (keys['arrowdown'] || keys['s']) vy += 1;

      if (held.left) vx -= 1;
      if (held.right) vx += 1;
      if (held.up) vy -= 1;
      if (held.down) vy += 1;

      if (vx !== 0 || vy !== 0) {
        const len = Math.sqrt(vx * vx + vy * vy);
        player.x += (vx / len) * player.speed * dt;
        player.y += (vy / len) * player.speed * dt;
        touchMoveRef.current = null;
      } else if (touchMoveRef.current) {
        const dx = touchMoveRef.current.x - player.x;
        const dy = touchMoveRef.current.y - player.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 6) {
          const step = Math.min(d, player.speed * 1.15 * dt);
          player.x += (dx / d) * step;
          player.y += (dy / d) * step;
        }
      }

      player.x = Math.max(24, Math.min(LOGICAL_WIDTH - 24, player.x));
      player.y = Math.max(30, Math.min(LOGICAL_HEIGHT - 24, player.y));

      if (keys[' '] || held.fire) {
        shoot();
      }
      if (fireCooldownRef.current > 0) {
        fireCooldownRef.current -= dt;
      }

      // Spawners
      spawnTimerRef.current -= dt;
      const spawnEvery = Math.max(0.42, 1.05 - levelRef.current * 0.09);
      if (spawnTimerRef.current <= 0) {
        const r = 16 + Math.random() * 26;
        asteroidsRef.current.push({
          x: Math.random() * (LOGICAL_WIDTH - 40) + 20,
          y: -r - 10,
          r,
          vy: 90 + Math.random() * 90 + levelRef.current * 14,
          vx: (Math.random() - 0.5) * 40,
          rot: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 1.6,
          seed: Math.random() * 10,
        });
        spawnTimerRef.current = spawnEvery * (0.7 + Math.random() * 0.6);
      }

      starTimerRef.current -= dt;
      if (starTimerRef.current <= 0) {
        starsRef.current.push({
          x: Math.random() * (LOGICAL_WIDTH - 50) + 25,
          y: -20,
          r: 13,
          vy: 85 + Math.random() * 40,
          pulse: Math.random() * 6,
        });
        starTimerRef.current = 1.1 + Math.random() * 1.1;
      }

      fuelTimerRef.current -= dt;
      if (fuelTimerRef.current <= 0) {
        fuelsRef.current.push({
          x: Math.random() * (LOGICAL_WIDTH - 50) + 25,
          y: -20,
          r: 14,
          vy: 75 + Math.random() * 30,
        });
        fuelTimerRef.current = 7 + Math.random() * 6;
      }

      // Bullets
      const bullets = bulletsRef.current;
      for (let bi = bullets.length - 1; bi >= 0; bi--) {
        bullets[bi].y += bullets[bi].vy * dt;
        if (bullets[bi].y < -12) {
          bullets.splice(bi, 1);
        }
      }

      // Asteroids & collisions
      const now = performance.now();
      const asteroids = asteroidsRef.current;
      for (let ai = asteroids.length - 1; ai >= 0; ai--) {
        const a = asteroids[ai];
        a.y += a.vy * dt;
        a.x += a.vx * dt;
        a.rot += a.vr * dt;
        if (a.y > LOGICAL_HEIGHT + 50) {
          asteroids.splice(ai, 1);
          continue;
        }

        // Bullet hit
        let hit = false;
        for (let bj = bullets.length - 1; bj >= 0; bj--) {
          if (dist(a, bullets[bj]) < a.r + bullets[bj].r) {
            explode(a.x, a.y, '#ffb020', 16);
            bullets.splice(bj, 1);
            hit = true;
            scoreRef.current += 10;
            hudDirty = true;
            break;
          }
        }
        if (hit) {
          asteroids.splice(ai, 1);
          soundEngine.playAsteroidHit();
          continue;
        }

        // Player hit
        if (now > invulnUntilRef.current && dist(a, player) < a.r + player.r - 6) {
          asteroids.splice(ai, 1);
          explode(player.x, player.y, '#ff4d2e', 22);
          livesRef.current -= 1;
          invulnUntilRef.current = now + 1600;
          hudDirty = true;
          soundEngine.playPlayerHit();
          if (livesRef.current <= 0) {
            triggerGameOver();
            return;
          } else {
            const rem = livesRef.current;
            onMessageChange(
              `Ouch! That one got you. ${rem} ${rem === 1 ? 'heart' : 'hearts'} left — you flash while you recover.`
            );
          }
        }
      }

      // Collectible stars
      const stars = starsRef.current;
      for (let si = stars.length - 1; si >= 0; si--) {
        const s = stars[si];
        s.y += s.vy * dt;
        s.pulse += dt * 5;
        if (s.y > LOGICAL_HEIGHT + 24) {
          stars.splice(si, 1);
          continue;
        }
        if (dist(s, player) < s.r + player.r + 4) {
          stars.splice(si, 1);
          scoreRef.current += 25;
          hudDirty = true;
          explode(s.x, s.y, '#ffd23f', 10);
          soundEngine.playStarPickup();
          onMessageChange('⭐ +25 — nice grab!');
        }
      }

      // Collectible fuel cells
      const fuels = fuelsRef.current;
      for (let fi = fuels.length - 1; fi >= 0; fi--) {
        const f = fuels[fi];
        f.y += f.vy * dt;
        if (f.y > LOGICAL_HEIGHT + 24) {
          fuels.splice(fi, 1);
          continue;
        }
        if (dist(f, player) < f.r + player.r + 4) {
          fuels.splice(fi, 1);
          scoreRef.current += 50;
          hudDirty = true;
          explode(f.x, f.y, '#4ade80', 12);
          soundEngine.playFuelPickup();
          onMessageChange('⛽ +50 — fuel cell collected!');
        }
      }

      // Particles
      const particles = particlesRef.current;
      for (let pi = particles.length - 1; pi >= 0; pi--) {
        const p = particles[pi];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) {
          particles.splice(pi, 1);
        }
      }

      // Level progression
      const newLevel = Math.floor(scoreRef.current / 200) + 1;
      if (newLevel !== levelRef.current) {
        levelRef.current = newLevel;
        hudDirty = true;
        onMessageChange(
          `Level ${newLevel} — a little faster now. You’ve got this.`
        );
        soundEngine.playLevelUp();
      }

      if (scoreRef.current > bestRef.current) {
        bestRef.current = scoreRef.current;
        hudDirty = true;
      }

      if (hudDirty) {
        syncHud();
      }
    },
    [explode, heldControlsRef, onMessageChange, shoot, syncHud, triggerGameOver]
  );

  const loop = useCallback(
    (timestamp: number) => {
      if (stateRef.current !== 'PLAYING') {
        drawFrame();
        return;
      }
      const dt = Math.min(0.033, (timestamp - lastTimeRef.current) / 1000 || 0.016);
      lastTimeRef.current = timestamp;
      updateSimulation(dt);
      drawFrame();
      if (stateRef.current === 'PLAYING') {
        rafIdRef.current = requestAnimationFrame(loop);
      }
    },
    [drawFrame, updateSimulation]
  );

  const startGame = useCallback(() => {
    soundEngine.ensureContext();
    scoreRef.current = 0;
    levelRef.current = 1;
    livesRef.current = MAX_LIVES;
    bulletsRef.current = [];
    asteroidsRef.current = [];
    starsRef.current = [];
    fuelsRef.current = [];
    particlesRef.current = [];
    playerRef.current.x = LOGICAL_WIDTH / 2;
    playerRef.current.y = LOGICAL_HEIGHT - 90;
    spawnTimerRef.current = 0;
    starTimerRef.current = 0;
    fuelTimerRef.current = 3;
    fireCooldownRef.current = 0;
    invulnUntilRef.current = 0;
    touchMoveRef.current = null;

    stateRef.current = 'PLAYING';
    syncHud();
    onStateChange('PLAYING');
    onMessageChange('Go! Grab stars, dodge the rocks.');

    lastTimeRef.current = performance.now();
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
    rafIdRef.current = requestAnimationFrame(loop);
    soundEngine.playStart();
  }, [loop, onMessageChange, onStateChange, syncHud]);

  const resumeGame = useCallback(() => {
    if (stateRef.current !== 'PAUSED') return;
    soundEngine.ensureContext();
    stateRef.current = 'PLAYING';
    onStateChange('PLAYING');
    onMessageChange('Back in flight!');
    lastTimeRef.current = performance.now();
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
    rafIdRef.current = requestAnimationFrame(loop);
  }, [loop, onMessageChange, onStateChange]);

  const togglePause = useCallback(() => {
    if (stateRef.current === 'PLAYING') {
      stateRef.current = 'PAUSED';
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      onStateChange('PAUSED');
      onMessageChange('Paused.');
    } else if (stateRef.current === 'PAUSED') {
      resumeGame();
    } else {
      onMessageChange('Start the game first, then you can pause it.');
    }
  }, [onMessageChange, onStateChange, resumeGame]);

  useImperativeHandle(
    gameRef,
    () => ({
      startGame,
      togglePause,
      resumeGame,
    }),
    [resumeGame, startGame, togglePause]
  );

  // Initial static frame & cleanup on unmount
  useEffect(() => {
    drawFrame();
    const handleResize = () => drawFrame();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [drawFrame]);

  // Global keyboard bindings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      const k = e.key.toLowerCase();
      if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(k)) {
        e.preventDefault();
      }
      keysRef.current[k] = true;

      if (k === 'p') {
        if (stateRef.current === 'PLAYING' || stateRef.current === 'PAUSED') {
          togglePause();
        }
      } else if (k === ' ' && stateRef.current === 'READY') {
        startGame();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };

    const handleBlur = () => {
      keysRef.current = {};
      draggingRef.current = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [startGame, togglePause]);

  const toCanvasCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: ((clientX - rect.left) / rect.width) * LOGICAL_WIDTH,
      y: ((clientY - rect.top) / rect.height) * LOGICAL_HEIGHT,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    soundEngine.ensureContext();
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pos = toCanvasCoords(e.clientX, e.clientY);
    if (pos) touchMoveRef.current = pos;
    if (stateRef.current === 'PLAYING') {
      shoot();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draggingRef.current) return;
    const pos = toCanvasCoords(e.clientX, e.clientY);
    if (pos) touchMoveRef.current = pos;
  };

  const handlePointerUpOrCancel = () => {
    draggingRef.current = false;
  };

  return (
    <section
      className="relative overflow-hidden rounded-[22px] border border-[var(--canvas-border)] bg-[var(--canvas-shell)] p-2.5 shadow-xl"
      aria-label="Game area"
    >
      <div
        className="relative overflow-hidden rounded-[14px]"
        style={{
          background:
            'radial-gradient(ellipse at 50% 120%, #16233f 0%, #070b18 55%)',
        }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUpOrCancel}
          onPointerCancel={handlePointerUpOrCancel}
          aria-label="Star Hopper game canvas"
          className="block w-full aspect-[4/5] sm:aspect-[16/10] touch-none select-none bg-transparent cursor-crosshair"
        />

        {gameState !== 'PLAYING' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#040710]/82 backdrop-blur-[3px] p-6 text-center text-white">
            {gameState === 'READY' && (
              <>
                <h2 className="text-[clamp(28px,6vw,44px)] font-black leading-none mb-2.5 text-balance">
                  Ready to fly?
                </h2>
                <p className="text-[17px] sm:text-[18px] leading-relaxed text-slate-300 mb-5 max-w-[420px]">
                  Use the <strong className="text-white">arrow keys</strong> or
                  drag on the screen to move.
                  <br />
                  Press <strong className="text-white">Space</strong> to shoot.
                  Collect ⭐ stars for points.
                </p>
                <button
                  type="button"
                  onClick={startGame}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--amber)] px-7 py-3.5 min-h-[54px] text-[18px] font-extrabold text-[#1a1200] transition-transform duration-150 hover:brightness-105 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white whitespace-nowrap shrink-0 cursor-pointer"
                >
                  ▶ Start Game
                </button>
              </>
            )}

            {gameState === 'PAUSED' && (
              <>
                <h2 className="text-[clamp(28px,6vw,44px)] font-black leading-none mb-2.5 text-balance">
                  Paused
                </h2>
                <p className="text-[17px] sm:text-[18px] leading-relaxed text-slate-300 mb-5 max-w-[420px]">
                  Take a breather. Your ship is right where you left it.
                </p>
                <button
                  type="button"
                  onClick={resumeGame}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--amber)] px-7 py-3.5 min-h-[54px] text-[18px] font-extrabold text-[#1a1200] transition-transform duration-150 hover:brightness-105 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white whitespace-nowrap shrink-0 cursor-pointer"
                >
                  ▶ Keep Flying
                </button>
              </>
            )}

            {gameState === 'GAME_OVER' && (
              <>
                <h2 className="text-[clamp(28px,6vw,44px)] font-black leading-none mb-2.5 text-balance">
                  Flight over — nice try!
                </h2>
                <p className="text-[17px] sm:text-[18px] leading-relaxed text-slate-300 mb-5 max-w-[420px]">
                  You scored{' '}
                  <strong className="text-white font-mono tabular-nums">
                    {hud.score} points
                  </strong>{' '}
                  and reached{' '}
                  <strong className="text-white">Level {hud.level}</strong>.
                  <br />
                  Want another run? It only takes a tap.
                </p>
                <button
                  type="button"
                  onClick={startGame}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--amber)] px-7 py-3.5 min-h-[54px] text-[18px] font-extrabold text-[#1a1200] transition-transform duration-150 hover:brightness-105 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white whitespace-nowrap shrink-0 cursor-pointer"
                >
                  ▶ Play Again
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
