export class GameAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private initialized = false;

  private shootBuffer: AudioBuffer | null = null;
  private hurtBuffer: AudioBuffer | null = null;
  private reloadBuffer: AudioBuffer | null = null;

  async init() {
    if (this.initialized) return;
    try {
      this.ctx = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
      this.masterGain = this.ctx.createGain();
      // Lower overall volume to prevent headache
      this.masterGain.gain.value = 0.5;
      this.masterGain.connect(this.ctx.destination);

      // Async generation of high quality sounds
      await Promise.all([
        this.generateShootBuffer(),
        this.generateHurtBuffer(),
        this.generateReloadBuffer(),
      ]);

      this.initialized = true;
    } catch (e) {
      console.warn("AudioContext not supported", e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  setVolume(volume: number) {
    if (this.masterGain) {
      this.masterGain.gain.value = volume;
    }
  }

  private playBuffer(
    buffer: AudioBuffer | null,
    volume: number = 1.0,
    playbackRate: number = 1.0,
  ) {
    if (!this.ctx || !this.masterGain || !buffer) return;
    this.resume();
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;

    // Optional node for individual gain
    const gainNode = this.ctx.createGain();
    gainNode.gain.value = volume;

    source.connect(gainNode);
    gainNode.connect(this.masterGain);
    source.start(0);
  }

  playShoot() {
    // slight variation in pitch for realism
    const pitch = 0.9 + Math.random() * 0.2;
    this.playBuffer(this.shootBuffer, 0.4, pitch); // lowered volume
  }

  playBotShoot(distance: number) {
    if (!this.ctx || !this.shootBuffer) return;
    const maxDist = 80;
    if (distance > maxDist) return;

    // attenuate volume based on distance
    const distFactor = Math.max(0, 1 - distance / maxDist);
    // make bot shoots quieter overall
    const volume = 0.2 * distFactor * distFactor;
    const pitch = 0.8 + Math.random() * 0.4;
    this.playBuffer(this.shootBuffer, volume, pitch);
  }

  playReload() {
    this.playBuffer(this.reloadBuffer, 1.0, 1.0);
  }

  playHurt() {
    const pitch = 0.95 + Math.random() * 0.1;
    this.playBuffer(this.hurtBuffer, 1.0, pitch);
  }

  // --- Offline Generators ---

  private async generateShootBuffer() {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const duration = 1.2; // Allows long tail
    const offlineCtx = new OfflineAudioContext(
      1,
      sampleRate * duration,
      sampleRate,
    );

    // Layer 1: Sharp Transient (Crack) -> less sharp
    const osc1 = offlineCtx.createOscillator();
    osc1.type = "triangle";
    osc1.frequency.setValueAtTime(200, 0);
    osc1.frequency.exponentialRampToValueAtTime(0.01, 0.05);

    const gain1 = offlineCtx.createGain();
    gain1.gain.setValueAtTime(1.0, 0); // Less loud
    gain1.gain.exponentialRampToValueAtTime(0.01, 0.05);
    osc1.connect(gain1);
    gain1.connect(offlineCtx.destination);
    osc1.start(0);
    osc1.stop(0.05);

    // Layer 2: Low-end body thump (The gunpowder charge)
    const osc2 = offlineCtx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(150, 0);
    osc2.frequency.exponentialRampToValueAtTime(40, 0.25);

    const gain2 = offlineCtx.createGain();
    gain2.gain.setValueAtTime(2.0, 0);
    gain2.gain.exponentialRampToValueAtTime(0.01, 0.25);

    // Saturate the low end slightly
    const shaper = offlineCtx.createWaveShaper();
    const curve = new Float32Array(400);
    for (let i = 0; i < 400; i++) {
      let x = (i * 2) / 400 - 1;
      // Soft clipping
      curve[i] =
        ((3 + 10) * x * 20 * (Math.PI / 180)) / (Math.PI + 10 * Math.abs(x));
    }
    shaper.curve = curve;

    osc2.connect(gain2);
    gain2.connect(shaper);
    shaper.connect(offlineCtx.destination);
    osc2.start(0);
    osc2.stop(0.25);

    // Layer 3: Gunshot Noise blast (The expanding gases)
    const noiseBuffer = offlineCtx.createBuffer(
      1,
      sampleRate * duration,
      sampleRate,
    );
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < noiseBuffer.length; i++) {
      let white = Math.random() * 2 - 1;
      output[i] = (white + lastOut * 0.5) * 0.5; // milder noise
      lastOut = output[i];
    }
    const noiseSource = offlineCtx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    // Filter sweeps down fast
    const filter = offlineCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(3000, 0); // less high freq piercing
    filter.frequency.exponentialRampToValueAtTime(150, 0.4);

    const noiseGain = offlineCtx.createGain();
    noiseGain.gain.setValueAtTime(1.5, 0); // less loud
    noiseGain.gain.exponentialRampToValueAtTime(0.01, 0.4);

    noiseSource.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(offlineCtx.destination);
    noiseSource.start(0);
    noiseSource.stop(0.6);

    // Layer 4: Distant tail (Reverb simulation)
    const tailGain = offlineCtx.createGain();
    tailGain.gain.setValueAtTime(0, 0);
    tailGain.gain.linearRampToValueAtTime(0.4, 0.05);
    tailGain.gain.exponentialRampToValueAtTime(0.001, Math.min(duration, 1.2));

    const tailFilter = offlineCtx.createBiquadFilter();
    tailFilter.type = "lowpass";
    tailFilter.frequency.value = 1000;

    noiseSource.connect(tailFilter);
    tailFilter.connect(tailGain);
    tailGain.connect(offlineCtx.destination);

    try {
      this.shootBuffer = await offlineCtx.startRendering();
    } catch (e) {
      console.error("Shoot OfflineRender errored:", e);
    }
  }

  private async generateHurtBuffer() {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const duration = 0.5;
    const offlineCtx = new OfflineAudioContext(
      1,
      sampleRate * duration,
      sampleRate,
    );

    // layer 1: punchy body hit thump
    const osc = offlineCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, 0);
    osc.frequency.exponentialRampToValueAtTime(40, 0.2);

    const oscGain = offlineCtx.createGain();
    oscGain.gain.setValueAtTime(1.5, 0);
    oscGain.gain.exponentialRampToValueAtTime(0.01, 0.2);

    osc.connect(oscGain);
    oscGain.connect(offlineCtx.destination);
    osc.start(0);
    osc.stop(0.2);

    // layer 2: crunch/flesh splat
    const noiseBuffer = offlineCtx.createBuffer(
      1,
      sampleRate * duration,
      sampleRate,
    );
    const p = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseBuffer.length; i++) {
      p[i] = Math.random() * 2 - 1;
    }
    const noiseSource = offlineCtx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const filter = offlineCtx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1000;
    filter.Q.value = 1.5;

    const noiseGain = offlineCtx.createGain();
    noiseGain.gain.setValueAtTime(1.5, 0);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, 0.15);

    noiseSource.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(offlineCtx.destination);

    noiseSource.start(0);
    noiseSource.stop(0.15);

    // layer 3: groan
    const vocalOsc = offlineCtx.createOscillator();
    // complex tone for voice
    vocalOsc.type = "sawtooth";
    vocalOsc.frequency.setValueAtTime(120, 0);
    vocalOsc.frequency.exponentialRampToValueAtTime(80, 0.3);

    const vocalFilter = offlineCtx.createBiquadFilter();
    vocalFilter.type = "lowpass";
    vocalFilter.frequency.setValueAtTime(800, 0);

    const vocalGain = offlineCtx.createGain();
    vocalGain.gain.setValueAtTime(0.0, 0);
    vocalGain.gain.linearRampToValueAtTime(0.8, 0.05);
    vocalGain.gain.exponentialRampToValueAtTime(0.01, 0.35);

    vocalOsc.connect(vocalFilter);
    vocalFilter.connect(vocalGain);
    vocalGain.connect(offlineCtx.destination);

    vocalOsc.start(0);
    vocalOsc.stop(0.4);

    try {
      this.hurtBuffer = await offlineCtx.startRendering();
    } catch (e) {
      console.error("Hurt OfflineRender errored:", e);
    }
  }

  private async generateReloadBuffer() {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const duration = 1.2;
    const offlineCtx = new OfflineAudioContext(
      1,
      sampleRate * duration,
      sampleRate,
    );

    // Helper for realistic gun mechanism sounds
    const createMechSound = (
      time: number,
      dur: number,
      freq: number,
      intensity: number,
      isPunchy = false,
    ) => {
      // Metallic ringing (bolt carrier group sliding, pins snapping)
      const osc = offlineCtx.createOscillator();
      osc.type = "square";
      osc.frequency.setValueAtTime(freq, time);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.4, time + dur * 0.8);

      const gain = offlineCtx.createGain();
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(intensity, time + dur * 0.1);
      if (isPunchy) {
        gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
      } else {
        gain.gain.linearRampToValueAtTime(0.001, time + dur);
      }

      const nBuffer = offlineCtx.createBuffer(
        1,
        sampleRate * dur * 2,
        sampleRate,
      );
      const ndata = nBuffer.getChannelData(0);
      for (let i = 0; i < ndata.length; i++) {
        ndata[i] = (Math.random() * 2 - 1) * intensity * 1.5;
      }
      const nsrc = offlineCtx.createBufferSource();
      nsrc.buffer = nBuffer;

      // Filter noise tighter to sound like sliding metal / latching
      const nfilter = offlineCtx.createBiquadFilter();
      nfilter.type = "highpass";
      nfilter.frequency.value = 2500;

      const nGain = offlineCtx.createGain();
      nGain.gain.setValueAtTime(0, time);
      nGain.gain.linearRampToValueAtTime(
        intensity * 1.5,
        time + Math.min(dur * 0.2, 0.05),
      );
      nGain.gain.exponentialRampToValueAtTime(
        0.001,
        time + dur * (isPunchy ? 1 : 1.5),
      );

      osc.connect(gain);
      gain.connect(offlineCtx.destination);
      osc.start(time);
      osc.stop(time + dur);

      nsrc.connect(nfilter);
      nfilter.connect(nGain);
      nGain.connect(offlineCtx.destination);
      nsrc.start(time);
      nsrc.stop(time + dur * 2);
    };

    // Realistic reload timeline sequence
    createMechSound(0.05, 0.08, 900, 0.4); // Mag eject catch press
    createMechSound(0.08, 0.15, 300, 0.4); // Mag slides out
    createMechSound(0.45, 0.1, 450, 0.6); // New mag slides in
    createMechSound(0.55, 0.12, 500, 1.2, true); // New mag clicks firmly in place
    createMechSound(0.85, 0.1, 1100, 0.6); // Bolt carrier pulled back
    createMechSound(0.95, 0.08, 1400, 1.0, true); // Bolt carrier snaps forward (chambered)

    try {
      this.reloadBuffer = await offlineCtx.startRendering();
    } catch (e) {
      console.error("Reload OfflineRender errored:", e);
    }
  }
}

export const audioSystem = new GameAudio();
