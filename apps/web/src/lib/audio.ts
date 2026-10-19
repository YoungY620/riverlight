type Tone = OscillatorType;

const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export class RiverlightAudio {
  private context: AudioContext | null = null;
  private musicBus: GainNode | null = null;
  private effectsBus: GainNode | null = null;
  private ambience: AudioBufferSourceNode | null = null;
  private music: AudioBufferSourceNode | null = null;
  private musicBuffer: AudioBuffer | null = null;
  private musicLoading: Promise<AudioBuffer> | null = null;
  private musicEnabled = true;

  get enabled() {
    return this.musicEnabled;
  }

  get playing() {
    return this.context?.state === "running";
  }

  async start() {
    if (!this.context) {
      this.context = new AudioContext();
      this.musicBus = this.context.createGain();
      this.effectsBus = this.context.createGain();
      this.musicBus.gain.value = this.musicEnabled ? 0.36 : 0;
      this.effectsBus.gain.value = 0.28;
      this.musicBus.connect(this.context.destination);
      this.effectsBus.connect(this.context.destination);
    }
    await this.context.resume();
    if (this.musicEnabled) {
      this.startAmbience();
      await this.startMusic();
    }
  }

  async setMusicEnabled(enabled: boolean) {
    this.musicEnabled = enabled;
    if (enabled) {
      await this.start();
    } else {
      this.stopMusic();
      this.stopAmbience();
    }
    if (this.musicBus && this.context) {
      this.musicBus.gain.setTargetAtTime(enabled ? 0.36 : 0, this.context.currentTime, 0.04);
    }
  }

  async suspend() {
    await this.context?.suspend();
  }

  playCard() {
    this.noiseBurst(0.035, 0.045, 1800);
    this.tone(740, 0.025, "square", 0.035);
  }

  playChip() {
    this.tone(1180, 0.035, "square", 0.05);
    this.tone(1760, 0.045, "triangle", 0.035, 0.025);
  }

  playTurn() {
    this.tone(523.25, 0.07, "square", 0.045);
    this.tone(783.99, 0.09, "triangle", 0.035, 0.055);
  }

  playWin() {
    [60, 64, 67, 72].forEach((note, index) => {
      this.tone(frequency(note), 0.16, "square", 0.045, index * 0.09);
    });
  }

  private async startMusic() {
    if (!this.context || !this.musicBus || this.music) return;
    if (!this.musicBuffer) {
      this.musicLoading ??= fetch("assets/music/riverlight.wav")
        .then((response) => {
          if (!response.ok) throw new Error("Music download failed");
          return response.arrayBuffer();
        })
        .then((bytes) => this.context?.decodeAudioData(bytes) ?? Promise.reject(new Error("Audio unavailable")));
      this.musicBuffer = await this.musicLoading;
    }
    if (!this.musicEnabled || this.music || !this.context || !this.musicBus) return;
    const source = this.context.createBufferSource();
    source.buffer = this.musicBuffer;
    source.loop = true;
    source.connect(this.musicBus);
    source.start();
    this.music = source;
  }

  private stopMusic() {
    if (!this.music) return;
    this.music.stop();
    this.music.disconnect();
    this.music = null;
  }

  private tone(
    hz: number,
    duration: number,
    type: Tone,
    volume: number,
    delay = 0,
    at?: number,
    destination?: GainNode,
  ) {
    if (!this.context) return;
    const start = at ?? this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(hz, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(destination ?? this.effectsBus ?? this.context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  private noiseBurst(duration: number, volume: number, cutoff: number, at?: number) {
    if (!this.context || !this.effectsBus) return;
    const sampleCount = Math.ceil(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, sampleCount, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < sampleCount; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / sampleCount);
    }
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    filter.type = "highpass";
    filter.frequency.value = cutoff;
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.effectsBus);
    source.start(at ?? this.context.currentTime);
  }

  private startAmbience() {
    if (this.ambience || !this.musicEnabled || !this.context || !this.musicBus) return;
    const seconds = 3;
    const buffer = this.context.createBuffer(1, this.context.sampleRate * seconds, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    let drift = 0;
    for (let index = 0; index < data.length; index += 1) {
      drift = drift * 0.985 + (Math.random() * 2 - 1) * 0.015;
      data[index] = drift;
    }
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.loop = true;
    filter.type = "lowpass";
    filter.frequency.value = 900;
    gain.gain.value = 0.05;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicBus);
    source.start();
    this.ambience = source;
  }

  private stopAmbience() {
    if (!this.ambience) return;
    this.ambience.stop();
    this.ambience.disconnect();
    this.ambience = null;
  }
}

export const riverlightAudio = new RiverlightAudio();
