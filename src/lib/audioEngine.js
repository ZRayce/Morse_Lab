import { MORSE_MAP, sanitizeText } from './morseCodec.js';
import { calculateMorseTiming } from './timing.js';

export class MorseAudioEngine {
  constructor() {
    this.ctx = null;
    this.activeOsc = null;
    this.activeGain = null;
    this.playbackId = 0;
    this.watchdogTimer = null;
    this.listeners = new Set();
    this.blockedListeners = new Set();
    this.isTransmitting = false;
    this.isAudioBlocked = false;
    this.pendingTimers = new Set();
    this.pendingSleepResolvers = new Set();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  subscribeBlocked(fn) {
    this.blockedListeners.add(fn);
    return () => this.blockedListeners.delete(fn);
  }

  notify(state) {
    this.isTransmitting = state;
    this.listeners.forEach((fn) => {
      try {
        fn(state);
      } catch {
        // Ignore subscriber error
      }
    });
  }

  notifyBlocked(blocked) {
    if (this.isAudioBlocked === blocked) return;
    this.isAudioBlocked = blocked;
    this.blockedListeners.forEach((fn) => {
      try {
        fn(blocked);
      } catch {
        // Ignore subscriber error
      }
    });
  }

  async ensureContext() {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended' || this.ctx.state === 'interrupted') {
      try {
        await this.ctx.resume();
      } catch {
        // Browser blocked audio context before user gesture
      }
    }
    const blocked = this.ctx.state !== 'running';
    this.notifyBlocked(blocked);
    return this.ctx;
  }

  stopAll() {
    this.playbackId += 1;
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    for (const timerId of this.pendingTimers) {
      clearTimeout(timerId);
    }
    this.pendingTimers.clear();
    for (const resolveSleep of this.pendingSleepResolvers) {
        resolveSleep();
    }
    this.pendingSleepResolvers.clear();
    
    if (this.activeOsc && this.ctx) {
      try {
        const now = this.ctx.currentTime;
        const oscRef = this.activeOsc;
        const gainRef = this.activeGain;
        if (gainRef) {
          gainRef.gain.cancelScheduledValues(now);
          gainRef.gain.setValueAtTime(
            Math.max(0.0001, gainRef.gain.value),
            now
          );
          gainRef.gain.exponentialRampToValueAtTime(0.0001, now + 0.005);
        }
        oscRef.onended = () => {
          try {
            oscRef.disconnect();
            if (gainRef) gainRef.disconnect();
          } catch {
            // Already disconnected
          }
        };
        oscRef.stop(now + 0.008);
      } catch {
        // Oscillator already stopped
      }
    }
    this.activeOsc = null;
    this.activeGain = null;
    this.notify(false);
  }

  async startManualTone(freq = 680, muted = false) {
    this.stopAll();
    if (muted) {
      this.notify(true);
      return;
    }
    const ctx = await this.ensureContext();
    if (!ctx) {
      this.notify(true);
      return;
    }
    const safeFreq = Math.min(1200, Math.max(300, Number(freq) || 680));
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(safeFreq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.005);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {
        // Already disconnected
      }
    };
    osc.start(now);
    this.activeOsc = osc;
    this.activeGain = gain;
    this.notify(true);

    this.watchdogTimer = setTimeout(() => {
      this.stopAll();
    }, 5000);
  }

  stopManualTone() {
    this.stopAll();
  }

  async playSequence(
    textOrMorse,
    { wpm = 18, farnsworthWpm = 18, freq = 680, muted = false, onSymbol } = {}
  ) {
    this.stopAll();
    const currentRun = this.playbackId;
    const raw = sanitizeText(textOrMorse, 600).toUpperCase().trim();
    if (!raw) return false;

    const { ditMs, dahMs, intraGapMs, charGapMs, wordGapMs } =
      calculateMorseTiming(wpm, farnsworthWpm);
    const safeFreq = Math.min(1200, Math.max(300, Number(freq) || 680));

    const ctx = muted ? null : await this.ensureContext();
    const words = raw.split(/\s+/);

    const sleep = (ms) =>
        new Promise((resolve) => {
            let settled = false;
            const done = () => {
                if (settled) return;
                settled = true;
                clearTimeout(id);
                this.pendingTimers.delete(id);
                this.pendingSleepResolvers.delete(done);
                resolve();
            };
            const id = setTimeout(done, ms);
            this.pendingTimers.add(id);
            this.pendingSleepResolvers.add(done);
        });
        
    for (let wIdx = 0; wIdx < words.length; wIdx += 1) {
      if (this.playbackId !== currentRun) return false;
      const word = words[wIdx];

      for (let cIdx = 0; cIdx < word.length; cIdx += 1) {
        if (this.playbackId !== currentRun) return false;
        const ch = word[cIdx];
        const code = Object.prototype.hasOwnProperty.call(MORSE_MAP, ch)
          ? MORSE_MAP[ch]
          : null;
        if (!code) continue;

        if (typeof onSymbol === 'function') {
          onSymbol({ char: ch, code, wordIndex: wIdx, charIndex: cIdx });
        }

        for (let sIdx = 0; sIdx < code.length; sIdx += 1) {
          if (this.playbackId !== currentRun) return false;
          const sym = code[sIdx];
          const toneMs = sym === '-' ? dahMs : ditMs;

          this.notify(true);
          if (ctx && !muted) {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(safeFreq, now);
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(0.22, now + 0.005);
            const stopAt = now + toneMs / 1000;
            gain.gain.setValueAtTime(
              0.22,
              Math.max(now + 0.006, stopAt - 0.005)
            );
            gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.onended = () => {
              try {
                osc.disconnect();
                gain.disconnect();
              } catch {
                // Already disconnected
              }
            };
            osc.start(now);
            osc.stop(stopAt + 0.004);
          }

          await sleep(toneMs);
          if (this.playbackId !== currentRun) return false;
          this.notify(false);

          if (sIdx < code.length - 1) {
            await sleep(intraGapMs);
          }
        }

        if (cIdx < word.length - 1) {
          await sleep(charGapMs);
        }
      }

      if (wIdx < words.length - 1) {
        await sleep(wordGapMs);
      }
    }

    if (this.playbackId === currentRun) {
      if (typeof onSymbol === 'function') onSymbol(null);
      this.notify(false);
      return true;
    }
    return false;
  }

  async playToneBurst(notes, muted = false) {
    if (muted) return;
    const ctx = await this.ensureContext();
    if (!ctx) return;
    let offset = 0;
    for (const [freq, durSec, gainPeak = 0.16] of notes) {
      const start = ctx.currentTime + offset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(
        Math.min(0.25, gainPeak),
        start + 0.005
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, start + durSec);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {
          // Already disconnected
        }
      };
      osc.start(start);
      osc.stop(start + durSec + 0.005);
      offset += durSec + 0.035;
    }
  }

  playSuccessPing(muted = false) {
    this.playToneBurst(
      [
        [660, 0.07, 0.14],
        [880, 0.11, 0.16],
      ],
      muted
    );
  }

  playErrorThud(muted = false) {
    this.playToneBurst([[220, 0.16, 0.16]], muted);
  }

  playCompletionFanfare(muted = false) {
    this.playToneBurst(
      [
        [523.25, 0.09, 0.15],
        [659.25, 0.09, 0.15],
        [783.99, 0.16, 0.18],
      ],
      muted
    );
  }

  playLevelUpFanfare(muted = false) {
    this.playToneBurst(
      [
        [523.25, 0.08, 0.15],
        [659.25, 0.08, 0.15],
        [783.99, 0.08, 0.16],
        [1046.5, 0.22, 0.2],
      ],
      muted
    );
  }
}

Object.freeze(MorseAudioEngine.prototype);