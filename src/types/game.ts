export type GameState = 'READY' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export type HeldControl = 'left' | 'right' | 'up' | 'down' | 'fire';

export interface HeldControlsState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  fire: boolean;
}

export interface HudSnapshot {
  score: number;
  best: number;
  level: number;
  lives: number;
}

export interface StarBg {
  x: number;
  y: number;
  r: number;
  speed: number;
}

export interface Bullet {
  x: number;
  y: number;
  vy: number;
  r: number;
}

export interface Asteroid {
  x: number;
  y: number;
  r: number;
  vy: number;
  vx: number;
  rot: number;
  vr: number;
  seed: number;
}

export interface CollectibleStar {
  x: number;
  y: number;
  r: number;
  vy: number;
  pulse: number;
}

export interface FuelCell {
  x: number;
  y: number;
  r: number;
  vy: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
}
