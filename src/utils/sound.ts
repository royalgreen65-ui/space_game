class SoundEngine {
  private ctx: AudioContext | null = null;
  public enabled = true;

  public ensureContext(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        try {
          this.ctx = new AudioCtx();
        } catch {
          this.ctx = null;
        }
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
  }

  public beep(
    freq: number,
    duration = 0.12,
    type: OscillatorType = 'square',
    volume = 0.06
  ): void {
    if (!this.enabled || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.value = volume;
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      const now = this.ctx.currentTime;
      osc.start(now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.stop(now + duration);
    } catch {
      // Ignore audio scheduling errors in restricted contexts
    }
  }

  public playStart(): void {
    this.beep(660, 0.12, 'square', 0.05);
    window.setTimeout(() => this.beep(880, 0.14, 'square', 0.05), 110);
  }

  public playShoot(): void {
    this.beep(980, 0.07, 'square', 0.04);
  }

  public playAsteroidHit(): void {
    this.beep(180, 0.1, 'sawtooth', 0.05);
  }

  public playPlayerHit(): void {
    this.beep(140, 0.22, 'sawtooth', 0.07);
  }

  public playStarPickup(): void {
    this.beep(1240, 0.1, 'sine', 0.06);
  }

  public playFuelPickup(): void {
    this.beep(880, 0.12, 'sine', 0.06);
    window.setTimeout(() => this.beep(1320, 0.12, 'sine', 0.06), 80);
  }

  public playLevelUp(): void {
    this.beep(740, 0.12, 'square', 0.05);
  }

  public playGameOver(): void {
    this.beep(220, 0.25, 'sawtooth', 0.06);
    window.setTimeout(() => this.beep(160, 0.3, 'sawtooth', 0.06), 180);
  }

  public playToggleOn(): void {
    this.beep(880, 0.1, 'sine', 0.05);
  }
}

export const soundEngine = new SoundEngine();
