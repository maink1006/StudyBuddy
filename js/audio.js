// Original synthesized ambience and UI chimes. No Minecraft audio files are bundled.
class StudyBuddyAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.musicEnabled = false;
    this.sfxEnabled = true;
    this.volume = 0.28;
    this.chords = [
      [261.63, 329.63, 392.00],
      [220.00, 261.63, 329.63],
      [174.61, 220.00, 261.63],
      [196.00, 246.94, 293.66]
    ];
  }

  async unlock() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return false;
    if (!this.context) {
      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.musicGain = this.context.createGain();
      this.sfxGain = this.context.createGain();
      this.master.gain.value = this.volume;
      this.musicGain.gain.value = 0.32;
      this.sfxGain.gain.value = 0.85;
      this.musicGain.connect(this.master);
      this.sfxGain.connect(this.master);
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') await this.context.resume();
    return true;
  }

  setOptions({ music, sfx, volume } = {}) {
    if (typeof music === 'boolean') this.musicEnabled = music;
    if (typeof sfx === 'boolean') this.sfxEnabled = sfx;
    if (typeof volume === 'number') this.volume = Math.max(0, Math.min(1, volume));
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.08);
    if (!this.musicEnabled) this.stopMusic();
  }

  tone(frequency, duration = 0.16, wave = 'sine', gain = 0.12, destination = 'sfx', delay = 0) {
    if (!this.context) return;
    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, start);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + 0.025);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope);
    envelope.connect(destination === 'music' ? this.musicGain : this.sfxGain);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  async playSfx(kind = 'click') {
    if (!this.sfxEnabled || !(await this.unlock())) return;
    const patterns = {
      click: [[560, 0.055, 'square', 0.035, 0]],
      task: [[660, 0.10, 'sine', 0.07, 0], [880, 0.14, 'sine', 0.06, 0.08]],
      reward: [[523.25, 0.18, 'triangle', 0.07, 0], [659.25, 0.18, 'triangle', 0.07, 0.12], [783.99, 0.28, 'triangle', 0.075, 0.24]],
      level: [[392, 0.16, 'triangle', 0.07, 0], [523.25, 0.16, 'triangle', 0.075, 0.12], [659.25, 0.20, 'triangle', 0.08, 0.24], [783.99, 0.34, 'triangle', 0.09, 0.36]],
      finish: [[392, 0.24, 'sine', 0.07, 0], [493.88, 0.24, 'sine', 0.07, 0.17], [587.33, 0.32, 'sine', 0.075, 0.34]]
    };
    (patterns[kind] || patterns.click).forEach(([f, d, w, g, delay]) => this.tone(f, d, w, g, 'sfx', delay));
  }

  async startMusic() {
    if (!(await this.unlock())) return;
    this.musicEnabled = true;
    if (this.musicTimer) return;
    this.playChord();
    this.musicTimer = window.setInterval(() => this.playChord(), 5200);
  }

  playChord() {
    if (!this.context || !this.musicEnabled) return;
    const chord = this.chords[this.musicStep % this.chords.length];
    chord.forEach((frequency, index) => {
      this.tone(frequency, 3.8, index === 0 ? 'triangle' : 'sine', index === 0 ? 0.025 : 0.018, 'music', index * 0.035);
    });
    const melody = [523.25, 587.33, 659.25, 587.33, 493.88, 440, 493.88, 523.25];
    this.tone(melody[this.musicStep % melody.length], 0.9, 'sine', 0.025, 'music', 0.5);
    this.musicStep += 1;
  }

  stopMusic() {
    this.musicEnabled = false;
    if (this.musicTimer) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
  }
}

window.studyBuddyAudio = new StudyBuddyAudio();
