import {
  Component,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';

// ============================================================================
// 1. IMMUTABLE ITU-R M.1677-1 MORSE DICTIONARY & KOCH CURRICULUM
// ============================================================================

const MORSE_MAP = Object.freeze({
  A: '.-',
  B: '-...',
  C: '-.-.',
  D: '-..',
  E: '.',
  F: '..-.',
  G: '--.',
  H: '....',
  I: '..',
  J: '.---',
  K: '-.-',
  L: '.-..',
  M: '--',
  N: '-.',
  O: '---',
  P: '.--.',
  Q: '--.-',
  R: '.-.',
  S: '...',
  T: '-',
  U: '..-',
  V: '...-',
  W: '.--',
  X: '-..-',
  Y: '-.--',
  Z: '--..',
  0: '-----',
  1: '.----',
  2: '..---',
  3: '...--',
  4: '....-',
  5: '.....',
  6: '-....',
  7: '--...',
  8: '---..',
  9: '----.',
  '.': '.-.-.-',
  ',': '--..--',
  '?': '..--..',
  '/': '-..-.',
  '-': '-....-',
  '(': '-.--.',
  ')': '-.--.-',
  '@': '.--.-.',
  '=': '-...-',
  '+': '.-.-.',
  '!': '-.-.--',
});

const REVERSE_MORSE_MAP = Object.freeze(
  Object.entries(MORSE_MAP).reduce((acc, [char, code]) => {
    acc[code] = char;
    return acc;
  }, Object.create(null))
);

const KOCH_SEQUENCE = Object.freeze([
  'K', 'M', 'R', 'S', 'U', 'A', 'P', 'T', 'L', 'O',
  'W', 'I', '.', 'N', 'J', 'E', 'F', '0', 'Y', ',',
  'V', 'G', '5', '/', 'Q', '9', 'Z', 'H', '3', '8',
  'B', '?', '4', '2', '7', 'C', '1', 'D', '6', 'X',
]);

const MATRIX_CHARACTERS = Object.freeze([
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I',
  'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R',
  'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '0',
  '1', '2', '3', '4', '5', '6', '7', '8', '9',
]);

const STRAIGHT_KEY_LEVELS = Object.freeze([
  { target: 'E', hint: 'One quick tap (1 Dit)' },
  { target: 'T', hint: 'One steady hold (1 Dah)' },
  { target: 'I', hint: 'Two quick taps' },
  { target: 'A', hint: 'One quick tap, then one steady hold' },
  { target: 'N', hint: 'One steady hold, then one quick tap' },
  { target: 'M', hint: 'Two steady holds' },
  { target: 'S', hint: 'Three quick taps' },
  { target: 'O', hint: 'Three steady holds' },
  { target: 'HI', hint: 'Four taps (H), brief pause, two taps (I)' },
  { target: '73', hint: 'Amateur radio shorthand for Best Regards' },
]);

const DAILY_INTERCEPTS = Object.freeze([
  {
    id: 'INT-01',
    band: '7.030 MHz · 40m CW',
    origin: 'NORTH ATLANTIC WEATHER STATION',
    text: 'BAROMETER FALLING GALE WARNING',
  },
  {
    id: 'INT-02',
    band: '14.055 MHz · 20m CW',
    origin: 'MARITIME RELAY VFF',
    text: 'ALL VESSELS REPORT POSITION 1800 UTC',
  },
  {
    id: 'INT-03',
    band: '3.550 MHz · 80m CW',
    origin: 'ARCTIC RESEARCH OUTPOST',
    text: 'ANTENNA ICING CLEARED SIGNAL NOMINAL',
  },
  {
    id: 'INT-04',
    band: '10.116 MHz · 30m CW',
    origin: 'COASTAL BEACON ZLO',
    text: 'VISIBILITY TEN MILES SEA CALM',
  },
  {
    id: 'INT-05',
    band: '7.040 MHz · 40m CW',
    origin: 'TRANSCONTINENTAL TELEGRAPH',
    text: 'PARIS STANDARD TIMING VERIFIED',
  },
]);

const SOS_CHALLENGES = Object.freeze([
  'SOS',
  'MAYDAY',
  'WATER',
  'MEDIC',
  'NORTH',
  'RESCUE',
  'SHELTER',
  'BATTERY',
]);

const WELCOME_TAPE_STEPS = Object.freeze([
  { id: 'W-1', char: 'W', morse: '.--' },
  { id: 'E-2', char: 'E', morse: '.' },
  { id: 'L-3', char: 'L', morse: '.-..' },
  { id: 'C-4', char: 'C', morse: '-.-.' },
  { id: 'O-5', char: 'O', morse: '---' },
  { id: 'M-6', char: 'M', morse: '--' },
  { id: 'E-7', char: 'E', morse: '.' },
]);

const VERNIER_TICKS = Object.freeze(
  Array.from({ length: 41 }, (_, idx) => ({
    idx,
    freq: 600 + idx * 4,
    isMajor: idx % 10 === 0,
    isMedium: idx % 5 === 0,
  }))
);

const TODAY_INTERCEPT_IDX =
  Math.floor(Date.now() / 86400000) % DAILY_INTERCEPTS.length;
const TODAY_DATE_STR = new Date().toISOString().slice(0, 10);

const STORAGE_KEY = 'morselab_logbook_v2';
const NOTICE_ACK_KEY = 'morselab_notice_ack_v2';
const INTEGRITY_SALT = 'MORSELAB-CW-ARCHIVAL-INTEGRITY-2026-RMF';
const MIN_HUMAN_REACTION_MS = 90;

const TACTILE_BTN =
  'transition-all duration-100 active:translate-y-[1px] active:scale-[0.98] select-none touch-manipulation cursor-pointer';

const HIGHLIGHTED_FIELD_LABEL =
  "inline-block font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#141413] bg-[#EAE8E1] border border-[#141413] px-2.5 py-1";

// ============================================================================
// 2. SECURITY, SANITIZATION & CRYPTOGRAPHIC STORAGE ENGINE
// ============================================================================

function sanitizeText(raw, maxLen = 500) {
  if (typeof raw !== 'string') return '';
  let out = '';
  const limit = Math.min(raw.length, maxLen);
  for (let i = 0; i < limit; i += 1) {
    const code = raw.charCodeAt(i);
    if (code >= 32 && code !== 127) {
      out += raw[i];
    }
  }
  return out;
}

function formatMorseDisplay(rawMorse) {
  if (typeof rawMorse !== 'string' || !rawMorse) return '';
  return rawMorse.replace(/\./g, '·').replace(/-/g, '—');
}

function encodeTextToMorse(text) {
  const clean = sanitizeText(text, 600).toUpperCase().trim();
  if (!clean) return '';
  const words = clean.split(/\s+/);
  return words
    .map((word) =>
      word
        .split('')
        .map((ch) =>
          Object.prototype.hasOwnProperty.call(MORSE_MAP, ch)
            ? MORSE_MAP[ch]
            : ''
        )
        .filter(Boolean)
        .join(' ')
    )
    .filter(Boolean)
    .join(' / ');
}

function decodeMorseToText(morse) {
  const clean = sanitizeText(morse, 2400).trim();
  if (!clean) return '';
  const words = clean.split(/\s*\/\s*|\s{3,}/);
  return words
    .map((word) =>
      word
        .trim()
        .split(/\s+/)
        .map((token) => {
          const normalized = token.replace(/·/g, '.').replace(/—/g, '-');
          return Object.prototype.hasOwnProperty.call(
            REVERSE_MORSE_MAP,
            normalized
          )
            ? REVERSE_MORSE_MAP[normalized]
            : '?';
        })
        .join('')
    )
    .join(' ');
}

function fallbackKeyedDigest(payload) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  const full = `${INTEGRITY_SALT}::${payload}`;
  for (let i = 0; i < full.length; i += 1) {
    const ch = full.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (
    (h2 >>> 0).toString(16).padStart(8, '0') +
    (h1 >>> 0).toString(16).padStart(8, '0')
  );
}

async function computeHmacSignature(payload) {
  try {
    if (
      typeof window !== 'undefined' &&
      window.crypto &&
      window.crypto.subtle &&
      typeof TextEncoder !== 'undefined'
    ) {
      const enc = new TextEncoder();
      const key = await window.crypto.subtle.importKey(
        'raw',
        enc.encode(INTEGRITY_SALT),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const sig = await window.crypto.subtle.sign(
        'HMAC',
        key,
        enc.encode(payload)
      );
      return Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    // Fallback used in non-HTTPS local preview environments
  }
  return fallbackKeyedDigest(payload);
}

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function createDefaultLogbook() {
  return {
    kochLevel: 2,
    xp: 0,
    streak: 0,
    lastActiveDate: '',
    stats: {},
  };
}

function sanitizeLogbookSchema(raw) {
  const base = createDefaultLogbook();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const kochLevel = Number(raw.kochLevel);
  const xp = Number(raw.xp);
  const streak = Number(raw.streak);

  if (
    !Number.isInteger(kochLevel) ||
    kochLevel < 2 ||
    kochLevel > KOCH_SEQUENCE.length
  ) {
    return null;
  }
  if (!Number.isInteger(xp) || xp < 0 || xp > 1000000) return null;
  if (!Number.isInteger(streak) || streak < 0 || streak > 3650) return null;

  base.kochLevel = kochLevel;
  base.xp = xp;
  base.streak = streak;
  base.lastActiveDate =
    typeof raw.lastActiveDate === 'string'
      ? sanitizeText(raw.lastActiveDate, 20)
      : '';

  if (raw.stats && typeof raw.stats === 'object' && !Array.isArray(raw.stats)) {
    const cleanStats = {};
    for (const key of Object.keys(raw.stats)) {
      if (
        key === '__proto__' ||
        key === 'constructor' ||
        key === 'prototype'
      ) {
        return null;
      }
      if (!Object.prototype.hasOwnProperty.call(MORSE_MAP, key)) continue;
      const entry = raw.stats[key];
      if (!entry || typeof entry !== 'object') return null;
      const attempts = Number(entry.attempts);
      const correct = Number(entry.correct);
      if (
        !Number.isInteger(attempts) ||
        !Number.isInteger(correct) ||
        attempts < 0 ||
        correct < 0 ||
        correct > attempts ||
        attempts > 100000
      ) {
        return null;
      }
      cleanStats[key] = { attempts, correct };
    }
    base.stats = cleanStats;
  }

  return base;
}

function detectStorageAvailability() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const probeKey = '__morselab_probe__';
    window.localStorage.setItem(probeKey, '1');
    window.localStorage.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
}

async function copyTextSafe(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to execCommand fallback
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

// ============================================================================
// 3. CLICK-FREE WEB AUDIO API CONTINUOUS-WAVE SIDETONE ENGINE
// ============================================================================

class MorseAudioEngine {
  constructor() {
    this.ctx = null;
    this.activeOsc = null;
    this.activeGain = null;
    this.playbackId = 0;
    this.watchdogTimer = null;
    this.listeners = new Set();
    this.isTransmitting = false;
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
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
        // Ignore resume failure prior to user gesture
      }
    }
    return this.ctx;
  }

  stopAll() {
    this.playbackId += 1;
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    if (this.activeOsc && this.ctx) {
      try {
        const now = this.ctx.currentTime;
        if (this.activeGain) {
          this.activeGain.gain.cancelScheduledValues(now);
          this.activeGain.gain.setValueAtTime(
            Math.max(0.0001, this.activeGain.gain.value),
            now
          );
          this.activeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.005);
        }
        this.activeOsc.stop(now + 0.008);
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

    const cleanWpm = Math.min(45, Math.max(5, Number(wpm) || 18));
    const cleanFarnsworth = Math.min(
      cleanWpm,
      Math.max(5, Number(farnsworthWpm) || cleanWpm)
    );
    const safeFreq = Math.min(1200, Math.max(300, Number(freq) || 680));

    const ditMs = 1200 / cleanWpm;
    const dahMs = ditMs * 3;
    const intraGapMs = ditMs;

    const farnsworthUnitMs = 1200 / cleanFarnsworth;
    const extraScale =
      cleanFarnsworth < cleanWpm ? farnsworthUnitMs / ditMs : 1;
    const charGapMs = ditMs * 3 * extraScale;
    const wordGapMs = ditMs * 7 * extraScale;

    const ctx = muted ? null : await this.ensureContext();
    const words = raw.split(/\s+/);

    const sleep = (ms) =>
      new Promise((resolve) => {
        setTimeout(resolve, ms);
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
      osc.start(start);
      osc.stop(start + durSec + 0.005);
      offset += durSec + 0.035;
    }
  }

  playBootChime(muted = false) {
    // CW "ML" (-- .-..) sidetone chime at 680 Hz
    this.playToneBurst(
      [
        [680, 0.14, 0.14],
        [680, 0.14, 0.14],
        [680, 0.055, 0.14],
        [680, 0.14, 0.14],
        [680, 0.055, 0.14],
        [680, 0.055, 0.14],
      ],
      muted
    );
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

// ============================================================================
// 4. BRAND GEOMETRIC MARK & COMPLETION CARD
// ============================================================================

function MorseLabLogo({ size = 28 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect
        x="0.75"
        y="0.75"
        width="30.5"
        height="30.5"
        fill="#FAF9F6"
        stroke="#141413"
        strokeWidth="1.5"
      />
      <path
        d="M6.5 23V9H9.3L13.2 16.4L17.1 9H19.9V23H17.3V13.6L13.9 20H12.5L9.1 13.6V23H6.5Z"
        fill="#141413"
      />
      <rect x="21.5" y="13.2" width="5.5" height="2.4" fill="#141413" />
      <rect x="22.8" y="19.2" width="3.4" height="3.4" fill="#1D4ED8" />
    </svg>
  );
}

function CompletionCard({
  title,
  subtitle,
  metrics,
  promotedChar,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}) {
  return (
    <div className="bg-[#FAF9F6] border border-[#141413] border-t-4 border-t-[#15803D] p-6 sm:p-8">
      <div className="font-['IBM_Plex_Mono'] text-[11px] uppercase tracking-[0.16em] text-[#15803D] font-bold">
        {promotedChar ? 'PROMOTION UNLOCKED' : 'TRANSMISSION COMPLETE'}
      </div>
      <h3 className="font-['Newsreader'] text-2xl sm:text-3xl font-semibold text-[#141413] mt-1">
        {title}
      </h3>
      <p className="font-['IBM_Plex_Sans'] text-sm text-[#57564F] mt-1.5 max-w-xl">
        {subtitle}
      </p>

      {promotedChar && (
        <div className="mt-4 bg-[#EAE8E1] border border-[#141413] px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <div className="font-['IBM_Plex_Mono'] text-[11px] font-bold uppercase tracking-[0.12em] text-[#57564F]">
              NEW KOCH CHARACTER ADDED TO MATRIX
            </div>
            <div className="font-['IBM_Plex_Mono'] text-lg sm:text-xl font-bold tracking-[0.2em] text-[#141413] mt-0.5">
              {promotedChar} · {formatMorseDisplay(MORSE_MAP[promotedChar] || '')}
            </div>
          </div>
          <span className="font-['IBM_Plex_Mono'] text-xs uppercase tracking-[0.12em] text-[#15803D] font-bold border border-[#15803D] px-2.5 py-1 bg-[#FAF9F6]">
            UNLOCKED
          </span>
        </div>
      )}

      {Array.isArray(metrics) && metrics.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5">
          {metrics.map((m) => (
            <div
              key={m.label}
              className="bg-[#F4F3EE] border border-[#141413]/25 px-3.5 py-3"
            >
              <div className="font-['IBM_Plex_Mono'] text-[10px] font-bold uppercase tracking-[0.12em] text-[#57564F]">
                {m.label}
              </div>
              <div className="font-['IBM_Plex_Mono'] text-lg font-bold text-[#141413] tabular-nums mt-0.5">
                {m.value}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mt-6">
        <button
          type="button"
          onClick={onPrimary}
          className={`min-h-[44px] px-5 py-2.5 bg-[#141413] hover:bg-[#1D4ED8] text-[#FAF9F6] font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] ${TACTILE_BTN}`}
        >
          {primaryLabel}
        </button>
        {secondaryLabel && onSecondary && (
          <button
            type="button"
            onClick={onSecondary}
            className={`min-h-[44px] px-5 py-2.5 bg-[#FAF9F6] hover:bg-[#EAE8E1] text-[#141413] border border-[#141413] font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] ${TACTILE_BTN}`}
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 5. STATION CALIBRATION BOOT SCREEN & SYSTEM FAULT / OFFLINE RECOVERY
// ============================================================================

function StationBootScreen({ onComplete }) {
  const [progress, setProgress] = useState(0);
  const completedRef = useRef(false);

  const finishBoot = useCallback(() => {
    if (!completedRef.current) {
      completedRef.current = true;
      onComplete();
    }
  }, [onComplete]);

  useEffect(() => {
    let rafId = 0;
    let startTime = null;
    let holdTimeout = null;
    const duration = 2600;

    const step = (timestamp) => {
      if (startTime === null) {
        startTime = timestamp;
      }
      const elapsed = timestamp - startTime;
      const ratio = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - ratio, 2.6);
      const pct = Math.round(eased * 100);
      setProgress(pct);

      if (ratio < 1) {
        rafId = window.requestAnimationFrame(step);
      } else {
        holdTimeout = window.setTimeout(() => {
          finishBoot();
        }, 450);
      }
    };

    rafId = window.requestAnimationFrame(step);

    return () => {
      window.cancelAnimationFrame(rafId);
      if (holdTimeout !== null) {
        window.clearTimeout(holdTimeout);
      }
    };
  }, [finishBoot]);

  const totalLetters = WELCOME_TAPE_STEPS.length;
  const activeLetterIndex = Math.min(
    totalLetters - 1,
    Math.floor((progress / 100) * totalLetters)
  );
  const isLocked = progress >= 98;
  const currentFreq = (612 + (progress / 100) * 68).toFixed(1);
  const needlePercent = (7.5 + (progress / 100) * 42.5).toFixed(2);

  return (
    <div
      className="min-h-[100dvh] bg-[#F4F3EE] text-[#141413] flex items-center justify-center p-4 sm:p-8 select-none"
      role="status"
      aria-live="polite"
      aria-label="MorseLab Station Calibration"
    >
      <div className="w-full max-w-2xl bg-[#FAF9F6] border-2 border-[#141413]">
        {/* Radio Instrument Nameplate Header */}
        <div className="flex items-center justify-between px-5 sm:px-7 py-4 border-b border-[#141413] bg-[#FAF9F6]">
          <div className="flex items-center gap-3">
            <MorseLabLogo size={28} />
            <div>
              <div className="font-['IBM_Plex_Mono'] text-xs font-bold tracking-[0.2em] uppercase text-[#141413]">
                MORSELAB
              </div>
              <div className="font-['IBM_Plex_Mono'] text-[10px] tracking-[0.14em] uppercase text-[#57564F]">
                CW TELEGRAPH STATION
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-['IBM_Plex_Mono'] text-xs tabular-nums font-bold text-[#141413]">
              {String(progress).padStart(3, '0')}%
            </span>
            <span
              className={`inline-block w-3 h-3 border border-[#141413] transition-colors duration-100 ${
                isLocked
                  ? 'bg-[#15803D]'
                  : progress % 14 < 7
                    ? 'bg-[#B91C1C]'
                    : 'bg-[#EAE8E1]'
              }`}
              title={isLocked ? 'Carrier Locked' : 'Tuning Carrier'}
            />
          </div>
        </div>

        {/* 01. Vernier Frequency Zero-Beat Scale */}
        <div className="px-5 sm:px-7 py-6 border-b border-[#141413] bg-[#F4F3EE]">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
            <span className="font-['IBM_Plex_Mono'] text-[11px] font-bold uppercase tracking-[0.14em] text-[#57564F]">
              CARRIER ZERO-BEAT ALIGNMENT
            </span>
            <span
              className={`font-['IBM_Plex_Mono'] text-[11px] uppercase tracking-[0.12em] font-bold tabular-nums ${
                isLocked ? 'text-[#15803D]' : 'text-[#1D4ED8]'
              }`}
            >
              {isLocked ? 'LOCKED · 680.0 HZ' : `TUNING · ${currentFreq} HZ`}
            </span>
          </div>

          <div className="relative bg-[#FAF9F6] border border-[#141413] px-3.5 pt-6 pb-3.5 overflow-hidden">
            <div
              className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[1px] bg-[#141413]/30 pointer-events-none"
              aria-hidden="true"
            />
            <div
              className="absolute top-1.5 left-1/2 -translate-x-1/2 font-['IBM_Plex_Mono'] text-[9px] tracking-[0.12em] uppercase text-[#57564F]"
              aria-hidden="true"
            >
              REF 680
            </div>

            <div
              className="absolute top-0 bottom-0 w-[2px] bg-[#1D4ED8] pointer-events-none"
              style={{ left: `${needlePercent}%` }}
              aria-hidden="true"
            >
              <div className="w-2.5 h-1.5 bg-[#1D4ED8] -translate-x-[4px]" />
            </div>

            <div className="flex items-end justify-between h-9 pt-2">
              {VERNIER_TICKS.map((tick) => (
                <div key={tick.idx} className="flex flex-col items-center">
                  <div
                    className={`w-[1px] bg-[#141413] ${
                      tick.isMajor
                        ? 'h-4'
                        : tick.isMedium
                          ? 'h-2.5 opacity-70'
                          : 'h-1.5 opacity-35'
                    }`}
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mt-2 font-['IBM_Plex_Mono'] text-[10px] tabular-nums text-[#57564F]">
              <span>600</span>
              <span>640</span>
              <span className="font-bold text-[#141413]">680 HZ</span>
              <span>720</span>
              <span>760</span>
            </div>
          </div>
        </div>

        {/* 02. Perforated Paper-Tape WELCOME Greeting */}
        <div className="px-5 sm:px-7 py-6 bg-[#EAE8E1]">
          <div className="flex items-center justify-between mb-3">
            <span className="font-['IBM_Plex_Mono'] text-[11px] font-bold uppercase tracking-[0.14em] text-[#57564F]">
              STATION GREETING TAPE
            </span>
            <span className="font-['IBM_Plex_Mono'] text-[10px] font-bold uppercase tracking-[0.12em] text-[#57564F]">
              {isLocked ? 'READY' : 'KEYING'}
            </span>
          </div>

          <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5">
            {WELCOME_TAPE_STEPS.map((item, idx) => {
              const threshold = Math.round(((idx + 1) / totalLetters) * 96);
              const isDone = progress >= threshold;
              const isCurrent = !isDone && idx === activeLetterIndex;
              return (
                <div
                  key={item.id}
                  className={`border px-1.5 sm:px-2.5 py-3 text-center transition-colors ${
                    isDone
                      ? 'bg-[#FAF9F6] border-[#141413]'
                      : isCurrent
                        ? 'bg-[#FAF9F6] border-[#1D4ED8]'
                        : 'bg-[#F4F3EE]/60 border-[#141413]/20 opacity-50'
                  }`}
                >
                  <div className="font-['IBM_Plex_Mono'] text-base sm:text-lg font-bold text-[#141413]">
                    {item.char}
                  </div>
                  <div
                    className={`font-['IBM_Plex_Mono'] text-xs sm:text-sm font-bold tracking-[0.12em] mt-1.5 ${
                      isDone
                        ? 'text-[#15803D]'
                        : isCurrent
                          ? 'text-[#1D4ED8]'
                          : 'text-[#57564F]'
                    }`}
                  >
                    {formatMorseDisplay(item.morse)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function SystemFaultView({
  mode = 'maintenance',
  errorDetail = '',
  onRetry,
  onResetStorage,
  audioEngine,
}) {
  const isOffline = mode === 'offline';
  const isCrash = mode === 'crash';

  const statusTag = isOffline
    ? 'STATUS 503 · NETWORK CONNECTION OFFLINE'
    : isCrash
      ? 'STATUS 500 · RUNTIME FAULT ISOLATED'
      : 'STATUS 503 · SCHEDULED STATION MAINTENANCE';

  const headline = isOffline
    ? 'Signal Link Interrupted — No Internet Connection'
    : isCrash
      ? 'Station Runtime Fault Detected'
      : 'Station Off-Air for Scheduled Maintenance';

  const description = isOffline
    ? 'Your device is currently offline. Reconnect to Wi-Fi or mobile data to load MorseLab typography assets and resume normal operation.'
    : isCrash
      ? 'An unexpected client-side exception occurred. Your signed training logbook remains safely isolated in browser storage.'
      : 'MorseLab is undergoing scheduled calibration and repository updates. Practice operations will resume shortly.';

  const morseBanner = 'QRT · — — · —  · — ·  —';

  const handleAuditionBeacon = () => {
    if (audioEngine && typeof audioEngine.playSequence === 'function') {
      audioEngine.playSequence('QRT', { wpm: 16, farnsworthWpm: 16, freq: 680 });
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#F4F3EE] text-[#141413] flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-xl bg-[#FAF9F6] border-2 border-[#141413] border-t-4 border-t-[#B91C1C] p-6 sm:p-8">
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#141413]/20">
          <div className="flex items-center gap-2.5">
            <MorseLabLogo size={24} />
            <span className="font-['IBM_Plex_Mono'] text-xs font-bold tracking-[0.18em] uppercase">
              MORSELAB
            </span>
          </div>
          <span className="font-['IBM_Plex_Mono'] text-[11px] font-bold uppercase tracking-[0.12em] text-[#B91C1C]">
            {statusTag}
          </span>
        </div>

        <h1 className="font-['Newsreader'] text-2xl sm:text-3xl font-semibold text-[#141413] mt-5">
          {headline}
        </h1>
        <p className="font-['IBM_Plex_Sans'] text-sm text-[#57564F] leading-relaxed mt-2">
          {description}
        </p>

        <div className="mt-4 bg-[#EAE8E1] border border-[#141413] px-4 py-3 flex items-center justify-between">
          <span className="font-['IBM_Plex_Mono'] text-sm sm:text-base font-bold tracking-[0.18em] text-[#141413]">
            {morseBanner}
          </span>
          <button
            type="button"
            onClick={handleAuditionBeacon}
            className={`min-h-[36px] px-3 py-1 bg-[#FAF9F6] hover:bg-[#141413] hover:text-[#FAF9F6] border border-[#141413] font-['IBM_Plex_Mono'] text-[11px] font-bold uppercase tracking-[0.12em] ${TACTILE_BTN}`}
          >
            Audition Beacon
          </button>
        </div>

        {errorDetail && (
          <pre className="mt-4 bg-[#F4F3EE] border border-[#141413]/30 p-3 font-['IBM_Plex_Mono'] text-xs text-[#B91C1C] overflow-x-auto whitespace-pre-wrap">
            {sanitizeText(errorDetail, 260)}
          </pre>
        )}

        <div className="flex flex-wrap items-center gap-3 mt-6">
          <button
            type="button"
            onClick={onRetry}
            className={`min-h-[44px] px-5 py-2.5 bg-[#141413] hover:bg-[#1D4ED8] text-[#FAF9F6] font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] ${TACTILE_BTN}`}
          >
            {isOffline ? 'Retry Connection' : 'Re-Initialize Station'}
          </button>
          {isCrash && onResetStorage && (
            <button
              type="button"
              onClick={onResetStorage}
              className={`min-h-[44px] px-4 py-2.5 bg-[#FAF9F6] hover:bg-[#B91C1C] hover:text-[#FAF9F6] hover:border-[#B91C1C] text-[#141413] border border-[#141413] font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] ${TACTILE_BTN}`}
            >
              Reset Local Storage &amp; Reboot
            </button>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-[#141413]/20 font-['IBM_Plex_Mono'] text-[11px] text-[#57564F] flex flex-wrap items-center justify-between gap-2">
          <span>OPERATOR SUPPORT: RAYCE MANUEL E. FILLON</span>
          <a
            href="mailto:zerorayce@gmail.com"
            className="text-[#1D4ED8] underline"
          >
            ZERORAYCE@GMAIL.COM
          </a>
        </div>
      </div>
    </div>
  );
}

class MorseLabErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage:
        error && error.message
          ? String(error.message)
          : 'Unexpected module fault',
    };
  }

  handleRecover = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  handleHardReset = () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage access errors
    }
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <SystemFaultView
          mode="crash"
          errorDetail={this.state.errorMessage}
          onRetry={this.handleRecover}
          onResetStorage={this.handleHardReset}
          audioEngine={this.props.audioEngine}
        />
      );
    }
    return this.props.children;
  }
}

// ============================================================================
// 6. VIEW 01: BIDIRECTIONAL TRANSLATOR
// ============================================================================

function TranslateView({ audioEngine, settings, showBanner }) {
  const [plainInput, setPlainInput] = useState('CQ DX DE MORSELAB K');
  const [morseInput, setMorseInput] = useState(() =>
    encodeTextToMorse('CQ DX DE MORSELAB K')
  );
  const [activeSymbol, setActiveSymbol] = useState(null);

  const handlePlainChange = (e) => {
    const val = sanitizeText(e.target.value, 500);
    setPlainInput(val);
    setMorseInput(encodeTextToMorse(val));
  };

  const handleMorseChange = (e) => {
    const val = sanitizeText(e.target.value, 2000);
    setMorseInput(val);
    setPlainInput(decodeMorseToText(val));
  };

  const handleTransmit = () => {
    const textToSend = plainInput.trim() || decodeMorseToText(morseInput);
    if (!textToSend) return;
    audioEngine.playSequence(textToSend, {
      wpm: settings.wpm,
      farnsworthWpm: settings.farnsworthWpm,
      freq: settings.freq,
      muted: settings.muted,
      onSymbol: (sym) => setActiveSymbol(sym),
    });
  };

  const handleStop = () => {
    audioEngine.stopAll();
    setActiveSymbol(null);
  };

  const handleCopyMorse = async () => {
    if (!morseInput.trim()) return;
    const ok = await copyTextSafe(morseInput.trim());
    if (ok) {
      showBanner('Copied Morse transmission to clipboard');
    }
  };

  const handleClear = () => {
    handleStop();
    setPlainInput('');
    setMorseInput('');
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-3 border-b border-[#141413]">
        <div>
          <div className="font-['IBM_Plex_Mono'] text-[11px] font-bold uppercase tracking-[0.14em] text-[#57564F]">
            01 · TRANSCEIVER CONSOLE
          </div>
          <h2 className="font-['Newsreader'] text-2xl sm:text-3xl font-semibold text-[#141413] mt-0.5">
            Bidirectional Morse Translator
          </h2>
        </div>

        <div className="font-['IBM_Plex_Mono'] text-xs uppercase tracking-[0.12em]">
          {activeSymbol ? (
            <span className="text-[#1D4ED8] font-bold">
              KEYING: {activeSymbol.char} · {formatMorseDisplay(activeSymbol.code)}
            </span>
          ) : (
            <span className="text-[#57564F]">
              {plainInput.length} / 500 CHARS
            </span>
          )}
        </div>
      </div>

      {/* Dual Input / Output Consoles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-[#FAF9F6] border border-[#141413] p-4 sm:p-5 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <label
              htmlFor="morselab-plain-input"
              className={HIGHLIGHTED_FIELD_LABEL}
            >
              Plaintext Message
            </label>
            <button
              type="button"
              onClick={handleClear}
              className={`min-h-[34px] px-3 py-1 bg-[#FAF9F6] hover:bg-[#141413] hover:text-[#FAF9F6] border border-[#141413] font-['IBM_Plex_Mono'] text-[11px] font-bold uppercase tracking-[0.12em] text-[#141413] ${TACTILE_BTN}`}
            >
              Clear
            </button>
          </div>
          <textarea
            id="morselab-plain-input"
            rows={5}
            value={plainInput}
            onChange={handlePlainChange}
            placeholder="Type message to encode into International Morse..."
            className="w-full flex-1 bg-[#F4F3EE] border border-[#141413]/35 focus:border-[#1D4ED8] focus:outline-none p-3.5 font-['IBM_Plex_Mono'] text-base sm:text-sm text-[#141413] uppercase resize-y"
          />
        </div>

        <div className="bg-[#FAF9F6] border border-[#141413] p-4 sm:p-5 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <label
              htmlFor="morselab-morse-input"
              className={HIGHLIGHTED_FIELD_LABEL}
            >
              International Morse Tape
            </label>
            <span className="font-['IBM_Plex_Mono'] text-[10px] font-semibold uppercase tracking-[0.1em] text-[#57564F]">
              SPACE = LETTER · / = WORD
            </span>
          </div>
          <textarea
            id="morselab-morse-input"
            rows={3}
            value={morseInput}
            onChange={handleMorseChange}
            placeholder="Enter dots (.) and dashes (-) separated by spaces..."
            className="w-full bg-[#EAE8E1] border border-[#141413]/35 focus:border-[#1D4ED8] focus:outline-none p-3.5 font-['IBM_Plex_Mono'] text-base sm:text-lg font-bold tracking-[0.16em] text-[#141413] resize-y"
          />
          {morseInput.trim() && (
            <div className="mt-3 pt-2.5 border-t border-[#141413]/15">
              <div className="font-['IBM_Plex_Mono'] text-[10px] font-bold uppercase tracking-[0.12em] text-[#141413] mb-1">
                VISUAL SIGNAL READOUT
              </div>
              <div className="font-['IBM_Plex_Mono'] text-lg sm:text-xl font-bold tracking-[0.22em] text-[#141413] break-words leading-relaxed">
                {formatMorseDisplay(morseInput)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleTransmit}
          className={`min-h-[44px] px-5 py-2.5 bg-[#141413] hover:bg-[#1D4ED8] text-[#FAF9F6] font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] ${TACTILE_BTN}`}
        >
          Transmit Audio
        </button>
        <button
          type="button"
          onClick={handleStop}
          className={`min-h-[44px] px-5 py-2.5 bg-[#FAF9F6] hover:bg-[#B91C1C] hover:text-[#FAF9F6] hover:border-[#B91C1C] text-[#141413] border border-[#141413] font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] ${TACTILE_BTN}`}
        >
          Stop
        </button>
        <button
          type="button"
          onClick={handleCopyMorse}
          className={`min-h-[44px] px-5 py-2.5 bg-[#FAF9F6] hover:bg-[#EAE8E1] text-[#141413] border border-[#141413] font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] ${TACTILE_BTN}`}
        >
          Copy Morse
        </button>
      </div>
    </section>
  );
}

// ============================================================================
// 7. VIEW 02: KOCH DRILLS, STRAIGHT KEY, SIGNAL LAMP & CHALLENGES
// ============================================================================

function DrillSessionRunner({
  mode,
  logbook,
  settings,
  audioEngine,
  isCarrierOn,
  onRecordResult,
}) {
  const unlockedPool = useMemo(
    () => KOCH_SEQUENCE.slice(0, logbook.kochLevel),
    [logbook.kochLevel]
  );

  const pickNextChar = useCallback(() => {
    const idx = Math.floor(Math.random() * unlockedPool.length);
    return unlockedPool[idx] || 'K';
  }, [unlockedPool]);

  const [hasStarted, setHasStarted] = useState(false);
  const [targetChar, setTargetChar] = useState(() => unlockedPool[0] || 'K');
  const [questionNum, setQuestionNum] = useState(1);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [completedSummary, setCompletedSummary] = useState(null);

  const promptReadyAtRef = useRef(0);
  const submittingRef = useRef(false);
  const totalQuestions = 10;

  const triggerPrompt = useCallback(
    async (ch) => {
      promptReadyAtRef.current = 0;
      await audioEngine.playSequence(ch, {
        wpm: settings.wpm,
        farnsworthWpm: settings.farnsworthWpm,
        freq: settings.freq,
        muted: mode === 'lamp' ? true : settings.muted,
      });
      promptReadyAtRef.current = performance.now();
    },
    [
      audioEngine,
      mode,
      settings.farnsworthWpm,
      settings.freq,
      settings.muted,
      settings.wpm,
    ]
  );

  useEffect(() => {
    return () => {
      audioEngine.stopAll();
    };
  }, [audioEngine]);

  const handleStartSession = useCallback(() => {
    const first = pickNextChar();
    setTargetChar(first);
    setQuestionNum(1);
    setScore(0);
    setFeedback(null);
    setCompletedSummary(null);
    submittingRef.current = false;
    setHasStarted(true);
    triggerPrompt(first);
  }, [pickNextChar, triggerPrompt]);

  const handleGuess = useCallback(
    (rawGuess, isTrusted = true) => {
      if (!hasStarted || !isTrusted || submittingRef.current || completedSummary) {
        return;
      }
      const guess = sanitizeText(rawGuess, 2).toUpperCase();
      if (!guess || !unlockedPool.includes(guess)) return;

      const elapsed =
        promptReadyAtRef.current > 0
          ? performance.now() - promptReadyAtRef.current
          : MIN_HUMAN_REACTION_MS;
      const plausibleTiming = elapsed >= MIN_HUMAN_REACTION_MS;

      submittingRef.current = true;
      const isCorrect = guess === targetChar;
      const nextScore = isCorrect ? score + 1 : score;

      if (isCorrect) {
        setScore(nextScore);
        audioEngine.playSuccessPing(settings.muted);
        setFeedback({
          type: 'ok',
          text: `CORRECT · ${targetChar} (${formatMorseDisplay(MORSE_MAP[targetChar])})`,
        });
      } else {
        audioEngine.playErrorThud(settings.muted);
        setFeedback({
          type: 'err',
          text: `MISSED · SENT ${targetChar} (${formatMorseDisplay(MORSE_MAP[targetChar])})`,
        });
      }

      if (plausibleTiming) {
        onRecordResult(targetChar, isCorrect, false);
      }

      setTimeout(() => {
        if (questionNum >= totalQuestions) {
          const accuracy = Math.round((nextScore / totalQuestions) * 100);
          const canPromote =
            accuracy >= 85 &&
            logbook.kochLevel < KOCH_SEQUENCE.length &&
            plausibleTiming;
          const promotedChar = canPromote
            ? KOCH_SEQUENCE[logbook.kochLevel]
            : null;

          if (canPromote) {
            onRecordResult(targetChar, isCorrect, true);
            audioEngine.playLevelUpFanfare(settings.muted);
          } else {
            audioEngine.playCompletionFanfare(settings.muted);
          }

          setCompletedSummary({
            accuracy,
            score: nextScore,
            promotedChar,
            xpEarned: nextScore * 15 + (canPromote ? 50 : 0),
          });
          submittingRef.current = false;
        } else {
          const next = pickNextChar();
          setQuestionNum((q) => q + 1);
          setTargetChar(next);
          setFeedback(null);
          submittingRef.current = false;
          triggerPrompt(next);
        }
      }, 650);
    },
    [
      audioEngine,
      completedSummary,
      hasStarted,
      logbook.kochLevel,
      onRecordResult,
      pickNextChar,
      questionNum,
      score,
      settings.muted,
      targetChar,
      triggerPrompt,
      unlockedPool,
    ]
  );

  useEffect(() => {
    const onKeyDown = (e) => {
      if (!e.isTrusted) return;
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (!hasStarted) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleStartSession();
        }
        return;
      }

      const key = e.key.toUpperCase();
      if (unlockedPool.includes(key)) {
        e.preventDefault();
        handleGuess(key, e.isTrusted);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleGuess, handleStartSession, hasStarted, unlockedPool]);

  if (!hasStarted) {
    return (
      <div className="bg-[#FAF9F6] border border-[#141413] p-6 sm:p-8 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#141413]/20">
          <span className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#141413]">
            {mode === 'lamp'
              ? 'OPTICAL SIGNAL LAMP · READY'
              : 'EAR TRAINING · READY'}
          </span>
          <span className="font-['IBM_Plex_Mono'] text-xs text-[#57564F]">
            {unlockedPool.length} ACTIVE SYMBOLS · {settings.wpm} WPM
          </span>
        </div>

        <div>
          <h3 className="font-['Newsreader'] text-2xl font-semibold text-[#141413]">
            {mode === 'lamp'
              ? 'Decode 10 Visual Signal Lamp Flashes'
              : 'Copy 10 Continuous-Wave Audio Characters'}
          </h3>
          <p className="font-['IBM_Plex_Sans'] text-sm text-[#57564F] mt-1.5 max-w-xl">
            {mode === 'lamp'
              ? 'Watch the carrier lamp pulse dits and dahs, then tap or type the matching character. Score 85% or higher to unlock the next Koch letter.'
              : 'Listen to each character sidetone and tap or type the letter you hear. Score 85% or higher across 10 characters to unlock the next Koch symbol.'}
          </p>
        </div>

        <div className="bg-[#F4F3EE] border border-[#141413]/25 px-4 py-3">
          <div className="inline-block font-['IBM_Plex_Mono'] text-[10px] font-bold uppercase tracking-[0.12em] text-[#141413] bg-[#EAE8E1] border border-[#141413] px-2 py-0.5">
            CURRENT KOCH POOL
          </div>
          <div className="font-['IBM_Plex_Mono'] text-sm font-bold tracking-[0.16em] text-[#141413] mt-1.5">
            {unlockedPool.join(' · ')}
          </div>
        </div>

        <button
          type="button"
          onClick={handleStartSession}
          className={`min-h-[48px] px-6 py-3 bg-[#141413] hover:bg-[#1D4ED8] text-[#FAF9F6] font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.14em] ${TACTILE_BTN}`}
        >
          {mode === 'lamp'
            ? 'Start Session & Flash Lamp'
            : 'Start Session & Play Tone'}
        </button>
      </div>
    );
  }

  if (completedSummary) {
    return (
      <CompletionCard
        title={
          completedSummary.promotedChar
            ? `Koch Level ${logbook.kochLevel} Cleared`
            : `${mode === 'lamp' ? 'Optical Signal Lamp' : 'Ear Training'} Drill Complete`
        }
        subtitle={
          completedSummary.promotedChar
            ? 'Accuracy exceeded 85%. The next character in the Koch sequence has been added to your active matrix.'
            : 'Reach 85% accuracy or higher across 10 characters to unlock the next Koch symbol.'
        }
        promotedChar={completedSummary.promotedChar}
        metrics={[
          { label: 'SCORE', value: `${completedSummary.score} / ${totalQuestions}` },
          { label: 'ACCURACY', value: `${completedSummary.accuracy}%` },
          { label: 'XP GAINED', value: `+${completedSummary.xpEarned}` },
        ]}
        primaryLabel="Start Next Drill"
        onPrimary={handleStartSession}
      />
    );
  }

  return (
    <div className="bg-[#FAF9F6] border border-[#141413] p-5 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#141413]/20">
        <span className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#141413]">
          {mode === 'lamp'
            ? 'OPTICAL SIGNAL LAMP · VISUAL DECODE'
            : 'EAR TRAINING · AUDIO COPY'}
        </span>
        <span className="font-['IBM_Plex_Mono'] text-xs text-[#57564F] tabular-nums">
          CHARACTER {questionNum} OF {totalQuestions} · SCORE {score}
        </span>
      </div>

      {mode === 'lamp' ? (
        <div className="flex flex-col items-center justify-center py-6 bg-[#F4F3EE] border border-[#141413]">
          <div
            className={`w-20 h-20 border-2 border-[#141413] transition-colors duration-75 ${
              isCarrierOn ? 'bg-[#B91C1C]' : 'bg-[#EAE8E1]'
            }`}
            aria-label={isCarrierOn ? 'Signal lamp illuminated' : 'Signal lamp off'}
          />
          <div className="font-['IBM_Plex_Mono'] text-[11px] font-bold uppercase tracking-[0.14em] text-[#57564F] mt-3">
            {isCarrierOn ? 'CARRIER MARK ON' : 'OBSERVE FLASH CADENCE'}
          </div>
          <button
            type="button"
            onClick={() => triggerPrompt(targetChar)}
            className={`mt-3 min-h-[38px] px-4 py-1.5 bg-[#FAF9F6] hover:bg-[#141413] hover:text-[#FAF9F6] border border-[#141413] font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] ${TACTILE_BTN}`}
          >
            Flash Again
          </button>
        </div>
      ) : (
        <div className="bg-[#EAE8E1] border border-[#141413] px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#141413]">
            SELECT OR TYPE THE MATCHING CHARACTER
          </div>
          <button
            type="button"
            onClick={() => triggerPrompt(targetChar)}
            className={`min-h-[40px] px-4 py-2 bg-[#FAF9F6] hover:bg-[#141413] hover:text-[#FAF9F6] border border-[#141413] font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] ${TACTILE_BTN}`}
          >
            Replay Tone
          </button>
        </div>
      )}

      {feedback && (
        <div
          className={`px-4 py-2.5 border font-['IBM_Plex_Mono'] text-sm font-bold tracking-[0.12em] ${
            feedback.type === 'ok'
              ? 'bg-[#15803D]/10 border-[#15803D] text-[#15803D]'
              : 'bg-[#B91C1C]/10 border-[#B91C1C] text-[#B91C1C]'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Unlocked Character Keypad */}
      <div>
        <div className="font-['IBM_Plex_Mono'] text-[11px] font-bold uppercase tracking-[0.12em] text-[#57564F] mb-2.5">
          ACTIVE KOCH POOL ({unlockedPool.length} SYMBOLS)
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
          {unlockedPool.map((ch) => (
            <button
              key={ch}
              type="button"
              onClick={(e) => handleGuess(ch, e.isTrusted)}
              className={`min-h-[48px] px-2 py-2 bg-[#F4F3EE] hover:bg-[#141413] hover:text-[#FAF9F6] border border-[#141413] font-['IBM_Plex_Mono'] text-base font-bold text-[#141413] ${TACTILE_BTN}`}
            >
              {ch}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StraightKeyView({ audioEngine, settings, onAwardXp }) {
  const [isPressed, setIsPressed] = useState(false);
  const [activeCode, setActiveCode] = useState('');
  const [decodedTape, setDecodedTape] = useState('');
  const [levelIdx, setLevelIdx] = useState(0);
  const [completedPhrase, setCompletedPhrase] = useState(null);
  const [mismatchHint, setMismatchHint] = useState(false);

  const pressStartRef = useRef(0);
  const activeCodeRef = useRef('');
  const charTimerRef = useRef(null);
  const wordTimerRef = useRef(null);

  const currentChallenge =
    STRAIGHT_KEY_LEVELS[levelIdx % STRAIGHT_KEY_LEVELS.length];
  const targetPhrase = currentChallenge.target;

  const ditThresholdMs = Math.max(145, (1200 / settings.wpm) * 2.2);
  const charPauseMs = Math.max(420, (1200 / settings.farnsworthWpm) * 3.8);
  const wordPauseMs = Math.max(950, (1200 / settings.farnsworthWpm) * 7.5);

  const clearTimers = useCallback(() => {
    if (charTimerRef.current) {
      clearTimeout(charTimerRef.current);
      charTimerRef.current = null;
    }
    if (wordTimerRef.current) {
      clearTimeout(wordTimerRef.current);
      wordTimerRef.current = null;
    }
  }, []);

  const commitCharacter = useCallback(() => {
    const code = activeCodeRef.current;
    if (!code) return;
    const decoded = Object.prototype.hasOwnProperty.call(REVERSE_MORSE_MAP, code)
      ? REVERSE_MORSE_MAP[code]
      : '?';
    activeCodeRef.current = '';
    setActiveCode('');
    setDecodedTape((prev) => prev + decoded);
  }, []);

  const handleKeyDownAction = useCallback(
    (isTrusted = true) => {
      if (!isTrusted || pressStartRef.current !== 0) return;
      clearTimers();
      setMismatchHint(false);
      pressStartRef.current = performance.now();
      setIsPressed(true);
      audioEngine.startManualTone(settings.freq, settings.muted);
    },
    [audioEngine, clearTimers, settings.freq, settings.muted]
  );

  const handleKeyUpAction = useCallback(() => {
    if (pressStartRef.current === 0) return;
    const heldMs = performance.now() - pressStartRef.current;
    pressStartRef.current = 0;
    setIsPressed(false);
    audioEngine.stopManualTone();

    const element = heldMs < ditThresholdMs ? '.' : '-';
    const nextCode = activeCodeRef.current + element;
    activeCodeRef.current = nextCode;
    setActiveCode(nextCode);

    charTimerRef.current = setTimeout(() => {
      commitCharacter();
      wordTimerRef.current = setTimeout(() => {
        setDecodedTape((prev) => (prev && !prev.endsWith(' ') ? `${prev} ` : prev));
      }, wordPauseMs - charPauseMs);
    }, charPauseMs);
  }, [
    audioEngine,
    charPauseMs,
    commitCharacter,
    ditThresholdMs,
    wordPauseMs,
  ]);

  useEffect(() => {
    const onWinKeyDown = (e) => {
      if (!e.isTrusted || e.repeat) return;
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        handleKeyDownAction(true);
      }
    };
    const onWinKeyUp = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleKeyUpAction();
      }
    };
    const onBlur = () => {
      if (pressStartRef.current !== 0) {
        handleKeyUpAction();
      }
    };

    window.addEventListener('keydown', onWinKeyDown);
    window.addEventListener('keyup', onWinKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onWinKeyDown);
      window.removeEventListener('keyup', onWinKeyUp);
      window.removeEventListener('blur', onBlur);
      clearTimers();
      audioEngine.stopManualTone();
    };
  }, [audioEngine, clearTimers, handleKeyDownAction, handleKeyUpAction]);

  const handleCheckTarget = () => {
    const cleaned = decodedTape.trim().toUpperCase();
    if (cleaned === targetPhrase) {
      audioEngine.playCompletionFanfare(settings.muted);
      onAwardXp(25);
      setCompletedPhrase(targetPhrase);
      setMismatchHint(false);
    } else {
      audioEngine.playErrorThud(settings.muted);
      setMismatchHint(true);
    }
  };

  const handleAdvanceLevel = () => {
    clearTimers();
    setLevelIdx((i) => (i + 1) % STRAIGHT_KEY_LEVELS.length);
    setDecodedTape('');
    activeCodeRef.current = '';
    setActiveCode('');
    setCompletedPhrase(null);
    setMismatchHint(false);
  };

  if (completedPhrase) {
    return (
      <CompletionCard
        title={`Straight-Key "${completedPhrase}" Verified`}
        subtitle="Your manual dit-to-dah rhythm decoded cleanly on the paper tape."
        metrics={[
          { label: 'STAGE', value: `${levelIdx + 1} / ${STRAIGHT_KEY_LEVELS.length}` },
          {
            label: 'MORSE',
            value: formatMorseDisplay(encodeTextToMorse(completedPhrase)),
          },
          { label: 'XP GAINED', value: '+25' },
        ]}
        primaryLabel="Next Keying Challenge"
        onPrimary={handleAdvanceLevel}
      />
    );
  }

  return (
    <div className="bg-[#FAF9F6] border border-[#141413] p-5 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#141413]/20">
        <div>
          <span className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#141413]">
            MANUAL STRAIGHT-KEY · STAGE {levelIdx + 1} OF{' '}
            {STRAIGHT_KEY_LEVELS.length}
          </span>
          <div className="font-['IBM_Plex_Sans'] text-xs text-[#57564F] mt-0.5">
            Quick tap = Dit (·) · Steady hold = Dah (—)
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              audioEngine.playSequence(targetPhrase, {
                wpm: Math.min(16, settings.wpm),
                farnsworthWpm: Math.min(14, settings.farnsworthWpm),
                freq: settings.freq,
                muted: settings.muted,
              })
            }
            className={`min-h-[38px] px-3 py-1.5 bg-[#F4F3EE] hover:bg-[#141413] hover:text-[#FAF9F6] border border-[#141413] font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.1em] ${TACTILE_BTN}`}
          >
            Hear Target
          </button>
          <button
            type="button"
            onClick={handleAdvanceLevel}
            className={`min-h-[38px] px-3 py-1.5 bg-[#FAF9F6] hover:bg-[#EAE8E1] border border-[#141413]/40 font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.1em] text-[#57564F] ${TACTILE_BTN}`}
          >
            Skip
          </button>
        </div>
      </div>

      {/* Beginner-Friendly Target Pattern Card */}
      <div className="bg-[#F4F3EE] border border-[#141413] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="font-['IBM_Plex_Mono'] text-[10px] font-bold uppercase tracking-[0.12em] text-[#141413]">
            TARGET TO KEY
          </div>
          <div className="font-['IBM_Plex_Mono'] text-2xl sm:text-3xl font-bold tracking-[0.2em] text-[#141413] mt-0.5">
            {targetPhrase}{' '}
            <span className="text-[#1D4ED8]">
              {formatMorseDisplay(encodeTextToMorse(targetPhrase))}
            </span>
          </div>
        </div>
        <div className="font-['IBM_Plex_Sans'] text-xs sm:text-sm text-[#141413] bg-[#FAF9F6] border border-[#141413]/30 px-3.5 py-2">
          {currentChallenge.hint}
        </div>
      </div>

      {/* Live Paper Tape Output */}
      <div className="bg-[#EAE8E1] border border-[#141413] p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-['IBM_Plex_Mono'] text-[11px] font-bold uppercase tracking-[0.12em] text-[#141413]">
            YOUR PAPER TAPE
          </span>
          <span className="font-['IBM_Plex_Mono'] text-base sm:text-lg font-bold tracking-[0.22em] text-[#1D4ED8]">
            {activeCode ? formatMorseDisplay(activeCode) : 'READY'}
          </span>
        </div>
        <div className="min-h-[44px] font-['IBM_Plex_Mono'] text-xl sm:text-2xl font-bold tracking-[0.18em] text-[#141413] break-all">
          {decodedTape || (
            <span className="text-[#57564F]/55">TAP OR HOLD KEY BELOW...</span>
          )}
        </div>
      </div>

      {mismatchHint && (
        <div className="px-4 py-2.5 bg-[#B91C1C]/10 border border-[#B91C1C] font-['IBM_Plex_Mono'] text-xs font-bold text-[#B91C1C]">
          TAPE READS &ldquo;{decodedTape.trim() || 'EMPTY'}&rdquo; — CLEAR TAPE AND TRY &ldquo;{targetPhrase}&rdquo; AGAIN
        </div>
      )}

      {/* Tactile Key Contact Pad */}
      <button
        type="button"
        onPointerDown={(e) => handleKeyDownAction(e.isTrusted)}
        onPointerUp={handleKeyUpAction}
        onPointerLeave={handleKeyUpAction}
        onPointerCancel={handleKeyUpAction}
        onContextMenu={(e) => e.preventDefault()}
        style={{ WebkitTouchCallout: 'none' }}
        className={`w-full min-h-[112px] border-2 border-[#141413] font-['IBM_Plex_Mono'] text-sm font-bold uppercase tracking-[0.16em] transition-all duration-75 select-none touch-manipulation cursor-pointer ${
          isPressed
            ? 'bg-[#B91C1C] text-[#FAF9F6] translate-y-[2px]'
            : 'bg-[#F4F3EE] hover:bg-[#EAE8E1] text-[#141413]'
        }`}
      >
        {isPressed
          ? 'CARRIER CLOSED · TRANSMITTING'
          : 'PRESS & HOLD KEY (OR HOLD SPACEBAR)'}
      </button>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleCheckTarget}
          className={`min-h-[44px] px-5 py-2.5 bg-[#141413] hover:bg-[#1D4ED8] text-[#FAF9F6] font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] ${TACTILE_BTN}`}
        >
          Verify &ldquo;{targetPhrase}&rdquo;
        </button>
        <button
          type="button"
          onClick={() => {
            clearTimers();
            activeCodeRef.current = '';
            setActiveCode('');
            setDecodedTape('');
            setMismatchHint(false);
          }}
          className={`min-h-[44px] px-4 py-2.5 bg-[#FAF9F6] hover:bg-[#EAE8E1] text-[#141413] border border-[#141413] font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] ${TACTILE_BTN}`}
        >
          Clear Tape
        </button>
      </div>
    </div>
  );
}

function ChallengesSubView({ audioEngine, settings, onAwardXp }) {
  const [challengeType, setChallengeType] = useState('daily');
  const daily = DAILY_INTERCEPTS[TODAY_INTERCEPT_IDX];
  const [dailyGuess, setDailyGuess] = useState('');
  const [dailySolved, setDailySolved] = useState(false);
  const [dailyError, setDailyError] = useState(false);

  const [sosIdx, setSosIdx] = useState(0);
  const [sosInput, setSosInput] = useState('');
  const [sosStreak, setSosStreak] = useState(0);
  const [sosCompleted, setSosCompleted] = useState(false);

  const sosWord = SOS_CHALLENGES[sosIdx % SOS_CHALLENGES.length];

  const handleDailySubmit = (e) => {
    e.preventDefault();
    const clean = sanitizeText(dailyGuess, 120).toUpperCase().trim();
    if (clean === daily.text) {
      setDailySolved(true);
      setDailyError(false);
      onAwardXp(60);
      audioEngine.playCompletionFanfare(settings.muted);
    } else {
      setDailyError(true);
      audioEngine.playErrorThud(settings.muted);
    }
  };

  const handleSosSubmit = (e) => {
    e.preventDefault();
    const clean = sanitizeText(sosInput, 40).toUpperCase().trim();
    if (clean === sosWord) {
      const nextStreak = sosStreak + 1;
      setSosStreak(nextStreak);
      setSosInput('');
      onAwardXp(20);
      if (nextStreak >= 5) {
        setSosCompleted(true);
        audioEngine.playLevelUpFanfare(settings.muted);
      } else {
        audioEngine.playSuccessPing(settings.muted);
        setSosIdx((i) => i + 1);
      }
    } else {
      setSosStreak(0);
      setSosInput('');
      audioEngine.playErrorThud(settings.muted);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setChallengeType('daily')}
          className={`min-h-[40px] px-4 py-2 border border-[#141413] font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] ${TACTILE_BTN} ${
            challengeType === 'daily'
              ? 'bg-[#141413] text-[#FAF9F6]'
              : 'bg-[#FAF9F6] hover:bg-[#EAE8E1] text-[#141413]'
          }`}
        >
          Daily Intercept ({TODAY_DATE_STR})
        </button>
        <button
          type="button"
          onClick={() => setChallengeType('sos')}
          className={`min-h-[40px] px-4 py-2 border border-[#141413] font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] ${TACTILE_BTN} ${
            challengeType === 'sos'
              ? 'bg-[#141413] text-[#FAF9F6]'
              : 'bg-[#FAF9F6] hover:bg-[#EAE8E1] text-[#141413]'
          }`}
        >
          SOS Survival Streak
        </button>
      </div>

      {challengeType === 'daily' ? (
        dailySolved ? (
          <CompletionCard
            title={`Intercept ${daily.id} Decoded`}
            subtitle={`Origin: ${daily.origin} (${daily.band})`}
            metrics={[
              { label: 'STATION', value: daily.id },
              { label: 'BAND', value: daily.band },
              { label: 'XP GAINED', value: '+60' },
            ]}
            primaryLabel="Replay Intercept Audio"
            onPrimary={() =>
              audioEngine.playSequence(daily.text, {
                wpm: settings.wpm,
                farnsworthWpm: settings.farnsworthWpm,
                freq: settings.freq,
                muted: settings.muted,
              })
            }
          />
        ) : (
          <form
            onSubmit={handleDailySubmit}
            className="bg-[#FAF9F6] border border-[#141413] p-5 sm:p-6 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#141413]/20">
              <span className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#141413]">
                {daily.id} · {daily.origin}
              </span>
              <span className="font-['IBM_Plex_Mono'] text-xs font-bold text-[#1D4ED8]">
                {daily.band}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  audioEngine.playSequence(daily.text, {
                    wpm: settings.wpm,
                    farnsworthWpm: settings.farnsworthWpm,
                    freq: settings.freq,
                    muted: settings.muted,
                  })
                }
                className={`min-h-[44px] px-4 py-2 bg-[#141413] hover:bg-[#1D4ED8] text-[#FAF9F6] font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] ${TACTILE_BTN}`}
              >
                Play Intercept Transmission
              </button>
              <button
                type="button"
                onClick={() => audioEngine.stopAll()}
                className={`min-h-[44px] px-4 py-2 bg-[#FAF9F6] hover:bg-[#EAE8E1] border border-[#141413] font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] ${TACTILE_BTN}`}
              >
                Stop
              </button>
            </div>

            <div>
              <label
                htmlFor="daily-intercept-guess"
                className={`${HIGHLIGHTED_FIELD_LABEL} mb-2`}
              >
                Decoded Plaintext Copy
              </label>
              <input
                id="daily-intercept-guess"
                type="text"
                value={dailyGuess}
                onChange={(e) => {
                  setDailyGuess(e.target.value);
                  setDailyError(false);
                }}
                placeholder="Type copied message..."
                className="w-full min-h-[44px] bg-[#F4F3EE] border border-[#141413] px-3.5 py-2 font-['IBM_Plex_Mono'] text-base sm:text-sm uppercase focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>

            {dailyError && (
              <div className="font-['IBM_Plex_Mono'] text-xs font-bold text-[#B91C1C]">
                COPY MISMATCH · REPLAY INTERCEPT AND VERIFY WORD SPACING
              </div>
            )}

            <button
              type="submit"
              className={`min-h-[44px] px-5 py-2.5 bg-[#141413] hover:bg-[#1D4ED8] text-[#FAF9F6] font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] ${TACTILE_BTN}`}
            >
              Submit Intercept Log
            </button>
          </form>
        )
      ) : sosCompleted ? (
        <CompletionCard
          title="5-Call Emergency Beacon Streak Cleared"
          subtitle="Five consecutive distress callsigns copied without error."
          metrics={[
            { label: 'STREAK', value: '5 / 5' },
            { label: 'SPEED', value: `${settings.wpm} WPM` },
            { label: 'XP GAINED', value: '+100' },
          ]}
          primaryLabel="Run Another SOS Streak"
          onPrimary={() => {
            setSosStreak(0);
            setSosCompleted(false);
            setSosIdx((i) => i + 1);
          }}
        />
      ) : (
        <form
          onSubmit={handleSosSubmit}
          className="bg-[#FAF9F6] border border-[#141413] p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center justify-between pb-3 border-b border-[#141413]/20">
            <span className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#B91C1C]">
              EMERGENCY CALLSIGN DRILL · 5 CONSECUTIVE TO CLEAR
            </span>
            <span className="font-['IBM_Plex_Mono'] text-xs font-bold tabular-nums">
              STREAK: {sosStreak} / 5
            </span>
          </div>

          <button
            type="button"
            onClick={() =>
              audioEngine.playSequence(sosWord, {
                wpm: settings.wpm,
                farnsworthWpm: settings.farnsworthWpm,
                freq: settings.freq,
                muted: settings.muted,
              })
            }
            className={`min-h-[44px] px-4 py-2 bg-[#B91C1C] hover:bg-[#141413] text-[#FAF9F6] font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] ${TACTILE_BTN}`}
          >
            Key Distress Callsign
          </button>

          <div>
            <label
              htmlFor="sos-callsign-input"
              className={`${HIGHLIGHTED_FIELD_LABEL} mb-2`}
            >
              Enter Copied Callsign
            </label>
            <input
              id="sos-callsign-input"
              type="text"
              value={sosInput}
              onChange={(e) => setSosInput(e.target.value)}
              placeholder="e.g. SOS"
              className="w-full min-h-[44px] bg-[#F4F3EE] border border-[#141413] px-3.5 py-2 font-['IBM_Plex_Mono'] text-base sm:text-sm uppercase focus:border-[#1D4ED8] focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className={`min-h-[44px] px-5 py-2.5 bg-[#141413] hover:bg-[#1D4ED8] text-[#FAF9F6] font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] ${TACTILE_BTN}`}
          >
            Verify Callsign
          </button>
        </form>
      )}
    </div>
  );
}

function TrainView({
  logbook,
  settings,
  audioEngine,
  isCarrierOn,
  onRecordResult,
  onAwardXp,
}) {
  const [drillMode, setDrillMode] = useState('ear');

  const modes = [
    { id: 'ear', label: 'Ear Training' },
    { id: 'key', label: 'Straight Key' },
    { id: 'lamp', label: 'Signal Lamp' },
    { id: 'challenges', label: 'Challenges' },
  ];

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-3 border-b border-[#141413]">
        <div>
          <div className="font-['IBM_Plex_Mono'] text-[11px] font-bold uppercase tracking-[0.14em] text-[#57564F]">
            02 · KOCH CURRICULUM &amp; DRILLS
          </div>
          <h2 className="font-['Newsreader'] text-2xl sm:text-3xl font-semibold text-[#141413] mt-0.5">
            Continuous-Wave Operator Training
          </h2>
        </div>
        <div className="font-['IBM_Plex_Mono'] text-xs font-bold text-[#1D4ED8] tabular-nums">
          KOCH LEVEL {logbook.kochLevel} / {KOCH_SEQUENCE.length} · {logbook.xp} XP
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              audioEngine.stopAll();
              setDrillMode(m.id);
            }}
            className={`min-h-[44px] px-3 py-2.5 border border-[#141413] font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] ${TACTILE_BTN} ${
              drillMode === m.id
                ? 'bg-[#141413] text-[#FAF9F6]'
                : 'bg-[#FAF9F6] hover:bg-[#EAE8E1] text-[#141413]'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {(drillMode === 'ear' || drillMode === 'lamp') && (
        <DrillSessionRunner
          key={drillMode}
          mode={drillMode}
          logbook={logbook}
          settings={settings}
          audioEngine={audioEngine}
          isCarrierOn={isCarrierOn}
          onRecordResult={onRecordResult}
        />
      )}
      {drillMode === 'key' && (
        <StraightKeyView
          audioEngine={audioEngine}
          settings={settings}
          onAwardXp={onAwardXp}
        />
      )}
      {drillMode === 'challenges' && (
        <ChallengesSubView
          audioEngine={audioEngine}
          settings={settings}
          onAwardXp={onAwardXp}
        />
      )}
    </section>
  );
}

// ============================================================================
// 8. VIEW 03: 36-CHARACTER MASTERY MATRIX & SIGNED LOGBOOK EXPORT
// ============================================================================

function LogbookView({
  logbook,
  settings,
  audioEngine,
  onPurgeLogbook,
  showBanner,
}) {
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [auditioningChar, setAuditioningChar] = useState(null);

  const totalAttempts = Object.values(logbook.stats).reduce(
    (sum, s) => sum + s.attempts,
    0
  );
  const totalCorrect = Object.values(logbook.stats).reduce(
    (sum, s) => sum + s.correct,
    0
  );
  const overallAccuracy =
    totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

  const masteredCount = MATRIX_CHARACTERS.filter((ch) => {
    const s = logbook.stats[ch];
    return s && s.attempts >= 3 && s.correct / s.attempts >= 0.85;
  }).length;

  const handleExportJson = async () => {
    const payload = JSON.stringify(
      {
        application: 'MorseLab CW Telegraph Logbook',
        exportedAt: new Date().toISOString(),
        author: 'Rayce Manuel E. Fillon',
        contact: 'zerorayce@gmail.com',
        linkedin: 'https://www.linkedin.com/in/raycefillon',
        logbook,
      },
      null,
      2
    );
    const ok = await copyTextSafe(payload);
    if (ok) {
      showBanner('Copied signed JSON logbook to clipboard');
    }
  };

  const handleTileAudition = (ch) => {
    setAuditioningChar(ch);
    audioEngine.playSequence(ch, {
      wpm: settings.wpm,
      farnsworthWpm: settings.farnsworthWpm,
      freq: settings.freq,
      muted: settings.muted,
      onSymbol: (sym) => {
        if (!sym) setAuditioningChar(null);
      },
    });
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-3 border-b border-[#141413]">
        <div>
          <div className="font-['IBM_Plex_Mono'] text-[11px] font-bold uppercase tracking-[0.14em] text-[#57564F]">
            03 · OPERATOR LOGBOOK
          </div>
          <h2 className="font-['Newsreader'] text-2xl sm:text-3xl font-semibold text-[#141413] mt-0.5">
            Performance Ledger &amp; Character Matrix
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportJson}
            className={`min-h-[40px] px-3.5 py-2 bg-[#FAF9F6] hover:bg-[#EAE8E1] border border-[#141413] font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] ${TACTILE_BTN}`}
          >
            Export JSON
          </button>
          {!confirmPurge ? (
            <button
              type="button"
              onClick={() => setConfirmPurge(true)}
              className={`min-h-[40px] px-3.5 py-2 bg-[#FAF9F6] hover:bg-[#B91C1C] hover:text-[#FAF9F6] hover:border-[#B91C1C] border border-[#141413] font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] ${TACTILE_BTN}`}
            >
              Purge Logbook
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                onPurgeLogbook();
                setConfirmPurge(false);
                showBanner('Local training logbook permanently cleared');
              }}
              className={`min-h-[40px] px-3.5 py-2 bg-[#B91C1C] text-[#FAF9F6] border border-[#141413] font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] ${TACTILE_BTN}`}
            >
              Confirm Permanent Reset
            </button>
          )}
        </div>
      </div>

      {/* Summary Telemetry Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#FAF9F6] border border-[#141413] p-4">
          <div className="font-['IBM_Plex_Mono'] text-[10px] font-bold uppercase tracking-[0.12em] text-[#57564F]">
            KOCH RANK
          </div>
          <div className="font-['IBM_Plex_Mono'] text-xl sm:text-2xl font-bold text-[#141413] tabular-nums mt-1">
            LVL {logbook.kochLevel} / {KOCH_SEQUENCE.length}
          </div>
        </div>
        <div className="bg-[#FAF9F6] border border-[#141413] p-4">
          <div className="font-['IBM_Plex_Mono'] text-[10px] font-bold uppercase tracking-[0.12em] text-[#57564F]">
            TOTAL EXPERIENCE
          </div>
          <div className="font-['IBM_Plex_Mono'] text-xl sm:text-2xl font-bold text-[#1D4ED8] tabular-nums mt-1">
            {logbook.xp} XP
          </div>
        </div>
        <div className="bg-[#FAF9F6] border border-[#141413] p-4">
          <div className="font-['IBM_Plex_Mono'] text-[10px] font-bold uppercase tracking-[0.12em] text-[#57564F]">
            OVERALL ACCURACY
          </div>
          <div className="font-['IBM_Plex_Mono'] text-xl sm:text-2xl font-bold text-[#141413] tabular-nums mt-1">
            {totalAttempts > 0 ? `${overallAccuracy}%` : '--'}
          </div>
        </div>
        <div className="bg-[#FAF9F6] border border-[#141413] p-4">
          <div className="font-['IBM_Plex_Mono'] text-[10px] font-bold uppercase tracking-[0.12em] text-[#57564F]">
            MASTERED SYMBOLS
          </div>
          <div className="font-['IBM_Plex_Mono'] text-xl sm:text-2xl font-bold text-[#15803D] tabular-nums mt-1">
            {masteredCount} / {MATRIX_CHARACTERS.length}
          </div>
        </div>
      </div>

      {/* 36-Character Mastery Matrix */}
      <div className="bg-[#FAF9F6] border border-[#141413] p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-2 mb-5">
          <div>
            <h3 className="font-['Newsreader'] text-xl sm:text-2xl font-semibold text-[#141413]">
              36-Character Mastery Matrix
            </h3>
            <p className="font-['IBM_Plex_Sans'] text-xs sm:text-sm text-[#57564F] mt-0.5">
              Tap or click any character card to audition its International Morse sidetone pattern.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 font-['IBM_Plex_Mono'] text-[11px] tabular-nums">
            <span className="text-[#57564F]">Untested</span>
            <span className="text-[#B91C1C]">&lt;60% Weak</span>
            <span className="text-[#1D4ED8]">60–84% Developing</span>
            <span className="text-[#15803D]">85%+ Mastered</span>
          </div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-9 gap-2.5">
          {MATRIX_CHARACTERS.map((ch) => {
            const stat = logbook.stats[ch];
            const pct =
              stat && stat.attempts > 0
                ? Math.round((stat.correct / stat.attempts) * 100)
                : null;
            const isAuditioning = auditioningChar === ch;

            let barColor = 'bg-[#141413]/15';
            let pctColor = 'text-[#57564F]';
            if (pct !== null) {
              if (pct >= 85) {
                barColor = 'bg-[#15803D]';
                pctColor = 'text-[#15803D] font-bold';
              } else if (pct >= 60) {
                barColor = 'bg-[#1D4ED8]';
                pctColor = 'text-[#1D4ED8] font-bold';
              } else {
                barColor = 'bg-[#B91C1C]';
                pctColor = 'text-[#B91C1C] font-bold';
              }
            }

            return (
              <button
                key={ch}
                type="button"
                onClick={() => handleTileAudition(ch)}
                className={`p-3 border text-left flex flex-col justify-between min-h-[86px] ${TACTILE_BTN} ${
                  isAuditioning
                    ? 'bg-[#EAE8E1] border-[#1D4ED8] ring-1 ring-[#1D4ED8]'
                    : 'bg-[#F4F3EE] hover:bg-[#EAE8E1] border-[#141413]/30 hover:border-[#141413]'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-['IBM_Plex_Mono'] text-lg font-bold text-[#141413]">
                    {ch}
                  </span>
                  <span
                    className={`font-['IBM_Plex_Mono'] text-[11px] tabular-nums ${pctColor}`}
                  >
                    {pct !== null ? `${pct}%` : '--'}
                  </span>
                </div>

                {/* High-Visibility Morse Code Glyphs */}
                <div className="font-['IBM_Plex_Mono'] text-lg sm:text-xl font-bold tracking-[0.18em] text-[#141413] my-1.5 leading-none">
                  {formatMorseDisplay(MORSE_MAP[ch])}
                </div>

                <div className="w-full h-1 bg-[#141413]/10">
                  <div
                    className={`h-full ${barColor}`}
                    style={{ width: `${pct !== null ? pct : 0}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// 9. EDITORIAL DOCUMENTATION: OPERATOR MANUAL, TERMS OF SERVICE & PRIVACY
// ============================================================================

function DocumentShell({ sectionTag, title, updatedDate, onBack, children }) {
  return (
    <article className="bg-[#FAF9F6] border border-[#141413] p-6 sm:p-10 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#141413]">
        <div>
          <div className="font-['IBM_Plex_Mono'] text-[11px] font-bold uppercase tracking-[0.14em] text-[#57564F]">
            {sectionTag} · {updatedDate}
          </div>
          <h2 className="font-['Newsreader'] text-2xl sm:text-3xl font-semibold text-[#141413] mt-1">
            {title}
          </h2>
        </div>
        <button
          type="button"
          onClick={onBack}
          className={`min-h-[40px] px-4 py-2 bg-[#F4F3EE] hover:bg-[#141413] hover:text-[#FAF9F6] border border-[#141413] font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] ${TACTILE_BTN}`}
        >
          Return to Station
        </button>
      </div>

      <div className="space-y-6 font-['IBM_Plex_Sans'] text-sm sm:text-[15px] text-[#141413] leading-relaxed">
        {children}
      </div>

      <div className="pt-5 border-t border-[#141413]/20 flex flex-wrap items-center justify-between gap-3">
        <span className="font-['IBM_Plex_Mono'] text-[11px] uppercase tracking-[0.12em] text-[#57564F]">
          MORSELAB ARCHIVAL MANUAL · RAYCE MANUEL E. FILLON
        </span>
        <button
          type="button"
          onClick={onBack}
          className={`min-h-[40px] px-4 py-2 bg-[#141413] hover:bg-[#1D4ED8] text-[#FAF9F6] font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] ${TACTILE_BTN}`}
        >
          Return to Station
        </button>
      </div>
    </article>
  );
}

function ManualView({ onBack }) {
  return (
    <DocumentShell
      sectionTag="DOCUMENTATION 01 · OPERATOR MANUAL"
      title="Continuous-Wave Telegraphy & Station Manual"
      updatedDate="REVISION NOV 2026"
      onBack={onBack}
    >
      <section className="space-y-2">
        <h3 className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#1D4ED8]">
          01 · BIDIRECTIONAL TRANSLATOR &amp; TAPE SYNTAX
        </h3>
        <p className="text-[#57564F]">
          In <strong className="text-[#141413]">01. Translate</strong>, typing into{' '}
          <strong className="text-[#141413]">Plaintext Message</strong> encodes letters (<code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">A–Z</code>), numerals (<code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">0–9</code>), and standard ITU punctuation into International Morse code in real time. Typing or pasting dots (<code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">.</code>) and dashes (<code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">-</code>) into{' '}
          <strong className="text-[#141413]">International Morse Tape</strong> decodes back to plaintext—separate individual letters with a single space and separate words with a forward slash (<code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">/</code>). Clicking <strong className="text-[#141413]">Copy Morse</strong> copies clean ASCII dots and dashes to your clipboard.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#1D4ED8]">
          02 · PARIS STANDARD TIMING &amp; FARNSWORTH SPACING
        </h3>
        <p className="text-[#57564F]">
          MorseLab computes all audio sidetones and optical lamp intervals from the international{' '}
          <strong className="text-[#141413]">PARIS</strong> standard (50 dot-units per standard word). One basic unit (1 Dit) equals{' '}
          <code className="font-['IBM_Plex_Mono'] bg-[#EAE8E1] px-1.5 py-0.5 text-xs text-[#141413]">
            1200 / WPM
          </code>{' '}
          milliseconds. Open the <strong className="text-[#141413]">Audio</strong> drawer in the top navigation bar to choose a quick preset or adjust Character Speed (8–40 WPM), Letter Pause (Farnsworth Spacing), Sidetone Pitch (400–1000 Hz), or Mute state.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 font-['IBM_Plex_Mono'] text-xs">
          <div className="bg-[#F4F3EE] border border-[#141413]/30 p-3">
            <div className="font-bold text-[#141413]">DIT (·)</div>
            <div className="text-[#57564F] mt-0.5">1 Unit</div>
          </div>
          <div className="bg-[#F4F3EE] border border-[#141413]/30 p-3">
            <div className="font-bold text-[#141413]">DAH (—)</div>
            <div className="text-[#57564F] mt-0.5">3 Units</div>
          </div>
          <div className="bg-[#F4F3EE] border border-[#141413]/30 p-3">
            <div className="font-bold text-[#141413]">LETTER GAP</div>
            <div className="text-[#57564F] mt-0.5">3 Units (Scaled)</div>
          </div>
          <div className="bg-[#F4F3EE] border border-[#141413]/30 p-3">
            <div className="font-bold text-[#141413]">WORD GAP</div>
            <div className="text-[#57564F] mt-0.5">7 Units (Scaled)</div>
          </div>
        </div>
        <p className="text-[#57564F] pt-1">
          Setting <strong className="text-[#141413]">Character Speed</strong> to 18–20 WPM while lowering{' '}
          <strong className="text-[#141413]">Letter Pause</strong> to 10–14 WPM preserves authentic character sound shapes while giving you extra pause time between letters—preventing the habit of counting dots.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#1D4ED8]">
          03 · KOCH CURRICULUM &amp; TRAINING MODES
        </h3>
        <ul className="list-disc pl-5 space-y-1.5 text-[#57564F]">
          <li>
            <strong className="text-[#141413]">Koch Progression:</strong> Training begins with two distinct characters (<code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">K</code> and <code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">M</code>). Scoring 85% or higher across a 10-character drill unlocks the next symbol in the 40-character Koch sequence.
          </li>
          <li>
            <strong className="text-[#141413]">Ear Training &amp; Signal Lamp:</strong> Click <strong>Start Session</strong> when ready, then identify audio sidetones or visual carrier flashes using your physical keyboard (<code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">A–Z</code>, <code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">0–9</code>) or the on-screen character keypad.
          </li>
          <li>
            <strong className="text-[#141413]">Manual Straight Key:</strong> Progress through 10 guided stages—starting with single-element letters (<code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">E</code>, <code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">T</code>, <code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">I</code>, <code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">A</code>)—by tapping for a Dit and holding for a Dah with the Spacebar or touch contact pad.
          </li>
          <li>
            <strong className="text-[#141413]">Daily Intercepts &amp; SOS Survival:</strong> Decode daily simulated HF weather/maritime broadcasts or clear a 5-callsign emergency beacon streak.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#1D4ED8]">
          04 · LOGBOOK MATRIX &amp; SESSION SAFETY
        </h3>
        <p className="text-[#57564F]">
          In <strong className="text-[#141413]">03. Logbook</strong>, tap any tile in the 36-Character Mastery Matrix to audition its sidetone pattern or review accuracy thresholds (<code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">&lt;60%</code> Weak, <code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">60–84%</code> Developing, <code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">85%+</code> Mastered). During initial station calibration, MorseLab automatically aligns the 680 Hz reference carrier before opening the transceiver console. Switching browser tabs automatically stops active audio transmissions.
        </p>
      </section>
    </DocumentShell>
  );
}

function TermsView({ onBack }) {
  return (
    <DocumentShell
      sectionTag="DOCUMENTATION 02 · LEGAL"
      title="Terms of Service & Operational Conditions"
      updatedDate="EFFECTIVE NOVEMBER 2026"
      onBack={onBack}
    >
      <section className="space-y-1.5">
        <h3 className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#141413]">
          01 · ACCEPTANCE OF TERMS &amp; ELIGIBILITY
        </h3>
        <p className="text-[#57564F]">
          By accessing or using MorseLab (&ldquo;the Service&rdquo;), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the Service. You represent that you are at least 13 years of age (or the minimum age of digital consent in your jurisdiction) or are using the Service under the supervision of a parent or legal guardian. MorseLab is provided free of charge as an educational Continuous-Wave (CW) telegraphy simulator created and maintained by <strong className="text-[#141413]">Rayce Manuel E. Fillon</strong>.
        </p>
      </section>

      <section className="bg-[#B91C1C]/10 border border-[#B91C1C] p-4 space-y-1.5">
        <h3 className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#B91C1C]">
          02 · LIFE-SAFETY, MARITIME &amp; AVIATION EMERGENCY DISCLAIMER
        </h3>
        <p className="text-[#141413] text-xs sm:text-sm">
          MorseLab is strictly a software-based educational simulator and training utility. It is <strong>NOT</strong> certified radio equipment, maritime distress hardware, aviation avionics, or an emergency signaling device. Never rely on this software for real-world maritime, aviation, wilderness, medical, or life-safety distress communications (<code className="font-['IBM_Plex_Mono']">SOS</code> / <code className="font-['IBM_Plex_Mono']">MAYDAY</code>). Always use type-approved GMDSS, EPIRB, PLB, or licensed emergency transceivers during actual emergencies.
        </p>
      </section>

      <section className="space-y-1.5">
        <h3 className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#141413]">
          03 · NO RADIO FREQUENCY TRANSMISSION OR LICENSING GRANT
        </h3>
        <p className="text-[#57564F]">
          MorseLab generates local audio sidetones and visual display pulses solely within your web browser; it does not transmit electromagnetic radio-frequency (RF) signals. Using MorseLab does not grant amateur or commercial radio operating privileges. If you operate physical radio transmitters, you are solely responsible for obtaining the required government authorization and callsign (such as from the National Telecommunications Commission in the Philippines or the FCC in the United States) and complying with applicable spectrum laws.
        </p>
      </section>

      <section className="space-y-1.5">
        <h3 className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#141413]">
          04 · AUDITORY &amp; PHOTOSENSITIVE SAFETY NOTICE
        </h3>
        <p className="text-[#57564F]">
          Continuous-wave sidetones generate pure sine-wave audio tones between 300 Hz and 1200 Hz. Maintain safe speaker and headphone volume levels to avoid hearing fatigue or discomfort. The Optical Signal Lamp training mode emits high-contrast flashing visual pulses; discontinue use immediately and consult a physician if you experience eye strain, dizziness, or have a history of photosensitive sensitivity.
        </p>
      </section>

      <section className="space-y-1.5">
        <h3 className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#141413]">
          05 · CLIENT-SIDE INTEGRITY &amp; ACCEPTABLE USE
        </h3>
        <p className="text-[#57564F]">
          Local training records are protected by keyed HMAC-SHA256 integrity signatures, trusted user-gesture verification (<code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">event.isTrusted</code>), and physiological reaction-time bounds. You agree not to reverse-engineer security controls, inject automated scripts or synthetic events to falsify logbook records, or use the Service in any unlawful manner.
        </p>
      </section>

      <section className="space-y-1.5">
        <h3 className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#141413]">
          06 · INTELLECTUAL PROPERTY, THIRD-PARTY LINKS &amp; SERVICE CHANGES
        </h3>
        <p className="text-[#57564F]">
          All original source code, audio synthesis routines, cryptographic storage guards, and archival Swiss interface layouts are © 2026 Rayce Manuel E. Fillon. International Morse Code character mappings follow public ITU-R M.1677-1 standards. The Service may contain links to external sites (such as LinkedIn or GitHub) and relies on third-party static hosting and font delivery networks; the developer is not responsible for the availability, security, or content of external services. The developer reserves the right to modify, suspend, or discontinue the Service at any time without prior notice.
        </p>
      </section>

      <section className="space-y-1.5">
        <h3 className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#141413]">
          07 · DISCLAIMER OF WARRANTIES &amp; LIMITATION OF LIABILITY
        </h3>
        <p className="text-[#57564F]">
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, MORSELAB IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. IN NO EVENT SHALL RAYCE MANUEL E. FILLON BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF DATA (INCLUDING BROWSER LOCAL STORAGE RESETS), ARISING OUT OF YOUR USE OF OR INABILITY TO USE THE SERVICE. BECAUSE THE SERVICE IS PROVIDED FREE OF CHARGE, THE DEVELOPER&apos;S TOTAL AGGREGATE LIABILITY FOR ANY CLAIM SHALL NOT EXCEED PHP 0.00 (USD 0.00).
        </p>
      </section>

      <section className="space-y-1.5">
        <h3 className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#141413]">
          08 · INDEMNIFICATION
        </h3>
        <p className="text-[#57564F]">
          You agree to indemnify, defend, and hold harmless Rayce Manuel E. Fillon from and against any claims, liabilities, damages, losses, and reasonable expenses arising out of your misuse of the Service, your violation of these Terms, or your violation of any applicable telecommunications, safety, or third-party rights.
        </p>
      </section>

      <section className="space-y-1.5">
        <h3 className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#141413]">
          09 · GOVERNING LAW, SEVERABILITY &amp; CONTACT
        </h3>
        <p className="text-[#57564F]">
          These Terms are governed by and construed in accordance with the laws of the <strong className="text-[#141413]">Republic of the Philippines</strong>, without regard to conflict-of-law principles, and any disputes shall be subject to the exclusive jurisdiction of the proper courts of <strong className="text-[#141413]">Cebu City, Philippines</strong> (without prejudice to mandatory consumer protections where applicable). If any provision of these Terms is held unenforceable, the remaining provisions remain in full force. Legal notices or inquiries may be sent to{' '}
          <a href="mailto:zerorayce@gmail.com" className="text-[#1D4ED8] underline">
            zerorayce@gmail.com
          </a>{' '}
          or via{' '}
          <a
            href="https://www.linkedin.com/in/raycefillon"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#1D4ED8] underline"
          >
            linkedin.com/in/raycefillon
          </a>
          .
        </p>
      </section>
    </DocumentShell>
  );
}

function PrivacyView({ onBack }) {
  return (
    <DocumentShell
      sectionTag="DOCUMENTATION 03 · PRIVACY"
      title="Privacy Policy & Local-First Data Disclosure"
      updatedDate="EFFECTIVE NOVEMBER 2026"
      onBack={onBack}
    >
      <section className="space-y-1.5">
        <h3 className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#141413]">
          01 · OPERATOR IDENTITY &amp; PRIVACY COMMITMENT
        </h3>
        <p className="text-[#57564F]">
          MorseLab is developed and operated by <strong className="text-[#141413]">Rayce Manuel E. Fillon</strong>. In alignment with the principles of transparency, legitimate purpose, and proportionality under the <strong className="text-[#141413]">Philippine Data Privacy Act of 2012 (Republic Act No. 10173)</strong> and international privacy standards, MorseLab is engineered with a zero-backend, local-first architecture: we do not require user accounts, do not collect names, emails, or keystroke logs on developer servers, and never sell, rent, or monetize user data.
        </p>
      </section>

      <section className="space-y-1.5">
        <h3 className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#141413]">
          02 · STRICTLY NECESSARY BROWSER STORAGE (NO TRACKING COOKIES)
        </h3>
        <p className="text-[#57564F]">
          MorseLab does not set advertising cookies, cross-site tracking identifiers, or behavioral analytics scripts. To save your practice progress locally on your own device, the application writes only two strictly functional records to your browser&apos;s <code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">localStorage</code>:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-[#57564F]">
          <li>
            <code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">morselab_logbook_v2</code> — Stores your Koch curriculum level, experience points (XP), daily practice streak, per-character accuracy counts, and a local HMAC-SHA256 integrity digest.
          </li>
          <li>
            <code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">morselab_notice_ack_v2</code> — Stores a simple boolean flag (<code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">1</code>) if you dismiss the footer storage notice.
          </li>
        </ul>
        <p className="text-[#57564F]">
          If you access MorseLab in Private/Incognito browsing or a restricted mobile WebView where <code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">localStorage</code> is blocked, MorseLab automatically operates in temporary in-memory session mode without writing to disk.
        </p>
      </section>

      <section className="space-y-1.5">
        <h3 className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#141413]">
          03 · THIRD-PARTY HOSTING &amp; GOOGLE FONTS NETWORK DISCLOSURE
        </h3>
        <p className="text-[#57564F]">
          While the developer collects zero personal data on proprietary servers, standard web delivery involves two third-party infrastructure connections made directly by your browser:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-[#57564F]">
          <li>
            <strong className="text-[#141413]">Static Web Hosting:</strong> The static HTML, CSS, and JavaScript bundle is delivered via third-party cloud hosting infrastructure, which automatically processes standard HTTP request metadata (such as your IP address, browser User-Agent, and timestamp) strictly to route the application files to your device and maintain network security.
          </li>
          <li>
            <strong className="text-[#141413]">Google Fonts Typography:</strong> When online, your browser connects to Google Fonts (<code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">fonts.googleapis.com</code> and <code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">fonts.gstatic.com</code>) to load the <code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">Newsreader</code>, <code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">IBM Plex Sans</code>, and <code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">IBM Plex Mono</code> typefaces. As part of standard HTTP delivery, Google receives your IP address and browser headers to serve the font stylesheets.
          </li>
        </ul>
      </section>

      <section className="space-y-1.5">
        <h3 className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#141413]">
          04 · CHILDREN&apos;S PRIVACY
        </h3>
        <p className="text-[#57564F]">
          MorseLab does not knowingly collect, solicit, or store personal information from children under 13 years of age (or under 16 in the European Economic Area). Because all practice progress remains exclusively on the user&apos;s local device, no child&apos;s personal data is transmitted to the developer.
        </p>
      </section>

      <section className="space-y-1.5">
        <h3 className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#141413]">
          05 · DATA SUBJECT RIGHTS, PORTABILITY &amp; PERMANENT ERASURE
        </h3>
        <p className="text-[#57564F]">
          Under RA 10173, GDPR, and similar privacy laws, you retain full control over your local records. Because your logbook resides exclusively inside your browser, you can exercise your rights of access, data portability, and erasure directly at any time: open <strong className="text-[#141413]">03. Logbook</strong> and click <strong className="text-[#141413]">Export JSON</strong> to download a complete copy of your records, or click <strong className="text-[#141413]">Purge Logbook</strong> (or clear your browser site data) to permanently delete all stored entries.
        </p>
      </section>

      <section className="space-y-1.5">
        <h3 className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#141413]">
          06 · POLICY UPDATES &amp; PRIVACY CONTACT
        </h3>
        <p className="text-[#57564F]">
          This Privacy Policy may be updated from time to time to reflect technical or regulatory changes, with the revision date shown at the top of this page. For privacy inquiries or security disclosures, contact{' '}
          <strong className="text-[#141413]">Rayce Manuel E. Fillon</strong> at{' '}
          <a href="mailto:zerorayce@gmail.com" className="text-[#1D4ED8] underline">
            zerorayce@gmail.com
          </a>{' '}
          or{' '}
          <a
            href="https://www.linkedin.com/in/raycefillon"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#1D4ED8] underline"
          >
            linkedin.com/in/raycefillon
          </a>
          .
        </p>
      </section>
    </DocumentShell>
  );
}

// ============================================================================
// 10. MAIN APPLICATION WORKSPACE
// ============================================================================

function MorseLabWorkspace({ audioEngine }) {
  const [bootDone, setBootDone] = useState(false);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine !== false : true
  );
  const [maintenanceMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return (
      params.get('maintenance') === '1' ||
      import.meta.env.VITE_MAINTENANCE_MODE === 'true'
    );
  });

  const [activeTab, setActiveTab] = useState('translate');
  const [audioDrawerOpen, setAudioDrawerOpen] = useState(false);
  const [isCarrierOn, setIsCarrierOn] = useState(false);
  const [bannerMessage, setBannerMessage] = useState('');
  const [bannerKey, setBannerKey] = useState(0);

  const [settings, setSettings] = useState({
    wpm: 18,
    farnsworthWpm: 14,
    freq: 680,
    muted: false,
  });

  const [logbook, setLogbook] = useState(createDefaultLogbook);
  const [storageAvailable] = useState(detectStorageAvailability);
  const [tamperAlert, setTamperAlert] = useState(false);
  const [noticeDismissed, setNoticeDismissed] = useState(() => {
    try {
      return window.localStorage.getItem(NOTICE_ACK_KEY) === '1';
    } catch {
      return false;
    }
  });

  const bannerTimerRef = useRef(null);

  const showBanner = useCallback((msg) => {
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = null;
    }
    setBannerMessage(msg);
    setBannerKey((k) => k + 1);
    bannerTimerRef.current = setTimeout(() => {
      setBannerMessage('');
      bannerTimerRef.current = null;
    }, 4000);
  }, []);

  const dismissBanner = useCallback(() => {
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = null;
    }
    setBannerMessage('');
  }, []);

  useEffect(() => {
    return () => {
      if (bannerTimerRef.current) {
        clearTimeout(bannerTimerRef.current);
      }
    };
  }, []);

  // Load Google Fonts & Dynamic SVG Favicon
  useEffect(() => {
    const fontHref =
      'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=Newsreader:opsz,wght@6..72,600;6..72,700&display=swap';
    if (!document.querySelector(`link[href="${fontHref}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = fontHref;
      document.head.appendChild(link);
    }

    const svgFavicon = encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect x="1" y="1" width="30" height="30" fill="#FAF9F6" stroke="#141413" stroke-width="2"/><path d="M6.5 23V9H9.3L13.2 16.4L17.1 9H19.9V23H17.3V13.6L13.9 20H12.5L9.1 13.6V23H6.5Z" fill="#141413"/><rect x="21.5" y="13.2" width="5.5" height="2.4" fill="#141413"/><rect x="22.8" y="19.2" width="3.4" height="3.4" fill="#1D4ED8"/></svg>`
    );
    let iconLink = document.querySelector("link[rel~='icon']");
    if (!iconLink) {
      iconLink = document.createElement('link');
      iconLink.rel = 'icon';
      document.head.appendChild(iconLink);
    }
    iconLink.href = `data:image/svg+xml,${svgFavicon}`;
  }, []);

  // Online / Offline Connectivity Monitor
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      audioEngine.stopAll();
      setIsOnline(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [audioEngine]);

  // Subscribe to Carrier State & Tab Visibility Safety
  useEffect(() => {
    const unsub = audioEngine.subscribe((state) => setIsCarrierOn(state));
    const onVisChange = () => {
      if (document.hidden) {
        audioEngine.stopAll();
      }
    };
    document.addEventListener('visibilitychange', onVisChange);
    return () => {
      unsub();
      document.removeEventListener('visibilitychange', onVisChange);
    };
  }, [audioEngine]);

  // Load & Verify HMAC-Signed Logbook
  useEffect(() => {
    let cancelled = false;
    async function loadLogbook() {
      if (!storageAvailable) return;
      try {
        const rawStr = window.localStorage.getItem(STORAGE_KEY);
        if (!rawStr) return;
        const parsed = JSON.parse(rawStr);
        if (!parsed || typeof parsed !== 'object' || !parsed.data || !parsed.sig) {
          throw new Error('Malformed envelope');
        }
        const expectedSig = await computeHmacSignature(
          JSON.stringify(parsed.data)
        );
        if (!constantTimeEqual(parsed.sig, expectedSig)) {
          throw new Error('Signature mismatch');
        }
        const validated = sanitizeLogbookSchema(parsed.data);
        if (!validated) {
          throw new Error('Invalid schema');
        }
        if (!cancelled) {
          setLogbook(validated);
        }
      } catch {
        try {
          window.localStorage.removeItem(STORAGE_KEY);
        } catch {
          // Ignore removal failure
        }
        if (!cancelled) {
          setLogbook(createDefaultLogbook());
          setTamperAlert(true);
        }
      }
    }
    loadLogbook();
    return () => {
      cancelled = true;
    };
  }, [storageAvailable]);

  const persistLogbook = useCallback(
    async (nextBook) => {
      setLogbook(nextBook);
      if (!storageAvailable) return;
      try {
        const sig = await computeHmacSignature(JSON.stringify(nextBook));
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ data: nextBook, sig })
        );
      } catch {
        // Keep in-memory state if quota is exceeded
      }
    },
    [storageAvailable]
  );

  const handleRecordResult = useCallback(
    (char, isCorrect, promoteLevel) => {
      setLogbook((prev) => {
        const prevStat = prev.stats[char] || { attempts: 0, correct: 0 };
        const nextStats = {
          ...prev.stats,
          [char]: {
            attempts: prevStat.attempts + 1,
            correct: prevStat.correct + (isCorrect ? 1 : 0),
          },
        };
        const nextLevel = promoteLevel
          ? Math.min(KOCH_SEQUENCE.length, prev.kochLevel + 1)
          : prev.kochLevel;
        const nextXp = prev.xp + (isCorrect ? 15 : 2) + (promoteLevel ? 50 : 0);
        const nextStreak =
          prev.lastActiveDate === TODAY_DATE_STR ? prev.streak : prev.streak + 1;

        const updated = {
          kochLevel: nextLevel,
          xp: nextXp,
          streak: nextStreak,
          lastActiveDate: TODAY_DATE_STR,
          stats: nextStats,
        };
        persistLogbook(updated);
        return updated;
      });
    },
    [persistLogbook]
  );

  const handleAwardXp = useCallback(
    (amount) => {
      setLogbook((prev) => {
        const updated = {
          ...prev,
          xp: Math.min(1000000, prev.xp + amount),
          streak:
            prev.lastActiveDate === TODAY_DATE_STR
              ? prev.streak
              : prev.streak + 1,
          lastActiveDate: TODAY_DATE_STR,
        };
        persistLogbook(updated);
        return updated;
      });
    },
    [persistLogbook]
  );

  const handlePurgeLogbook = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage error
    }
    setTamperAlert(false);
    setLogbook(createDefaultLogbook());
  }, []);

  if (!isOnline) {
    return (
      <SystemFaultView
        mode="offline"
        onRetry={() => setIsOnline(navigator.onLine !== false)}
        audioEngine={audioEngine}
      />
    );
  }

  if (maintenanceMode) {
    return (
      <SystemFaultView
        mode="maintenance"
        onRetry={() => {
          window.location.href = window.location.pathname;
        }}
        audioEngine={audioEngine}
      />
    );
  }

  if (!bootDone) {
    return <StationBootScreen onComplete={() => setBootDone(true)} />;
  }

  const navItems = [
    { id: 'translate', label: '01. Translate' },
    { id: 'train', label: '02. Train' },
    { id: 'logbook', label: '03. Logbook' },
  ];

  return (
    <div className="min-h-[100dvh] bg-[#F4F3EE] text-[#141413] flex flex-col justify-between">
      {/* Top Auto-Dismissing Clipboard Banner (4 Seconds) */}
      {bannerMessage && (
        <div
          key={bannerKey}
          role="status"
          aria-live="polite"
          className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-lg bg-[#141413] text-[#FAF9F6] border border-[#141413]"
        >
          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <span className="font-['IBM_Plex_Mono'] text-xs uppercase tracking-[0.1em]">
              {bannerMessage}
            </span>
            <button
              type="button"
              onClick={dismissBanner}
              className={`font-['IBM_Plex_Mono'] text-[11px] font-bold uppercase tracking-[0.12em] text-[#FAF9F6]/80 hover:text-[#FAF9F6] border border-[#FAF9F6]/30 px-2 py-0.5 shrink-0 ${TACTILE_BTN}`}
            >
              Dismiss
            </button>
          </div>
          <div className="h-[3px] w-full bg-[#FAF9F6]/15 overflow-hidden">
            <div
              className="h-full bg-[#1D4ED8]"
              style={{
                animation: 'morselabCountdown 4s linear forwards',
              }}
            />
          </div>
          <style>{`
            @keyframes morselabCountdown {
              from { width: 100%; }
              to { width: 0%; }
            }
          `}</style>
        </div>
      )}

      <div>
        {/* Primary Header */}
        <header className="bg-[#FAF9F6] border-b border-[#141413]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('translate')}
              className={`flex items-center gap-3 text-left ${TACTILE_BTN}`}
            >
              <MorseLabLogo size={28} />
              <div>
                <div className="font-['IBM_Plex_Mono'] text-sm font-bold tracking-[0.18em] uppercase text-[#141413]">
                  MORSELAB
                </div>
                <div className="font-['IBM_Plex_Mono'] text-[10px] tracking-[0.12em] uppercase text-[#57564F]">
                  CW TELEGRAPH MANUAL
                </div>
              </div>
            </button>

            {/* Primary Navigation */}
            <nav
              aria-label="Primary Workspace"
              className="flex items-center gap-1.5 sm:gap-2"
            >
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`min-h-[40px] px-3 sm:px-4 py-2 border font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.1em] ${TACTILE_BTN} ${
                    activeTab === item.id
                      ? 'bg-[#141413] text-[#FAF9F6] border-[#141413]'
                      : 'bg-[#FAF9F6] hover:bg-[#EAE8E1] text-[#141413] border-[#141413]/30'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            {/* Carrier LED & Collapsible Audio Drawer Button */}
            <div className="flex items-center gap-2.5">
              <div
                className="flex items-center gap-2 px-2.5 py-1.5 border border-[#141413]/30 bg-[#F4F3EE]"
                title={isCarrierOn ? 'Carrier Active' : 'Carrier Standby'}
              >
                <span
                  className={`inline-block w-2.5 h-2.5 border border-[#141413] ${
                    isCarrierOn ? 'bg-[#B91C1C]' : 'bg-[#EAE8E1]'
                  }`}
                />
                <span className="font-['IBM_Plex_Mono'] text-[10px] uppercase tracking-[0.12em] text-[#57564F] hidden sm:inline">
                  {settings.wpm} WPM · {settings.freq}HZ
                </span>
              </div>

              <button
                type="button"
                onClick={() => setAudioDrawerOpen((o) => !o)}
                aria-expanded={audioDrawerOpen}
                className={`min-h-[40px] px-3 py-2 border border-[#141413] font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.1em] ${TACTILE_BTN} ${
                  audioDrawerOpen
                    ? 'bg-[#1D4ED8] text-[#FAF9F6] border-[#1D4ED8]'
                    : 'bg-[#FAF9F6] hover:bg-[#EAE8E1] text-[#141413]'
                }`}
              >
                Audio
              </button>
            </div>
          </div>

          {/* Collapsible Audio & Timing Settings Drawer */}
          {audioDrawerOpen && (
            <div className="border-t border-[#141413] bg-[#EAE8E1]">
              <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 space-y-4">
                {/* Quick Skill-Level Presets */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#141413]/20">
                  <span className="font-['IBM_Plex_Mono'] text-[11px] font-bold uppercase tracking-[0.12em] text-[#141413]">
                    QUICK SPEED PRESETS:
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      { label: 'Beginner (15 / 8 WPM)', wpm: 15, farnsworthWpm: 8 },
                      { label: 'Standard (18 / 14 WPM)', wpm: 18, farnsworthWpm: 14 },
                      { label: 'Fast CW (25 / 25 WPM)', wpm: 25, farnsworthWpm: 25 },
                    ].map((preset) => {
                      const isActive =
                        settings.wpm === preset.wpm &&
                        settings.farnsworthWpm === preset.farnsworthWpm;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() =>
                            setSettings((s) => ({
                              ...s,
                              wpm: preset.wpm,
                              farnsworthWpm: preset.farnsworthWpm,
                            }))
                          }
                          className={`min-h-[34px] px-3 py-1 border border-[#141413] font-['IBM_Plex_Mono'] text-[11px] font-bold uppercase tracking-[0.08em] ${TACTILE_BTN} ${
                            isActive
                              ? 'bg-[#141413] text-[#FAF9F6]'
                              : 'bg-[#FAF9F6] hover:bg-[#1D4ED8] hover:text-[#FAF9F6] text-[#141413]'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tactile Controls with Step Buttons & Plain-Language Hints */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
                  {/* 01. Character Speed */}
                  <div className="bg-[#FAF9F6] border border-[#141413] p-3 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-baseline font-['IBM_Plex_Mono'] text-[11px] font-bold uppercase tracking-[0.08em] text-[#141413]">
                        <label htmlFor="ctrl-wpm">Character Speed</label>
                        <span className="text-[#1D4ED8] tabular-nums">
                          {settings.wpm} WPM
                        </span>
                      </div>
                      <p className="font-['IBM_Plex_Sans'] text-[11px] text-[#57564F] mt-0.5">
                        Dot &amp; dash playback speed
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-2.5">
                      <button
                        type="button"
                        aria-label="Decrease character speed"
                        onClick={() =>
                          setSettings((s) => {
                            const nextWpm = Math.max(8, s.wpm - 1);
                            return {
                              ...s,
                              wpm: nextWpm,
                              farnsworthWpm: Math.min(s.farnsworthWpm, nextWpm),
                            };
                          })
                        }
                        className={`w-8 h-8 shrink-0 bg-[#F4F3EE] hover:bg-[#141413] hover:text-[#FAF9F6] border border-[#141413] font-['IBM_Plex_Mono'] text-sm font-bold ${TACTILE_BTN}`}
                      >
                        −
                      </button>
                      <input
                        id="ctrl-wpm"
                        type="range"
                        min={8}
                        max={40}
                        value={settings.wpm}
                        onChange={(e) => {
                          const nextWpm = Number(e.target.value);
                          setSettings((s) => ({
                            ...s,
                            wpm: nextWpm,
                            farnsworthWpm: Math.min(s.farnsworthWpm, nextWpm),
                          }));
                        }}
                        className="w-full accent-[#1D4ED8] cursor-pointer"
                      />
                      <button
                        type="button"
                        aria-label="Increase character speed"
                        onClick={() =>
                          setSettings((s) => ({
                            ...s,
                            wpm: Math.min(40, s.wpm + 1),
                          }))
                        }
                        className={`w-8 h-8 shrink-0 bg-[#F4F3EE] hover:bg-[#141413] hover:text-[#FAF9F6] border border-[#141413] font-['IBM_Plex_Mono'] text-sm font-bold ${TACTILE_BTN}`}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* 02. Letter Pause (Farnsworth) */}
                  <div className="bg-[#FAF9F6] border border-[#141413] p-3 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-baseline font-['IBM_Plex_Mono'] text-[11px] font-bold uppercase tracking-[0.08em] text-[#141413]">
                        <label htmlFor="ctrl-farnsworth">Letter Pause</label>
                        <span className="text-[#1D4ED8] tabular-nums">
                          {settings.farnsworthWpm} WPM
                        </span>
                      </div>
                      <p className="font-['IBM_Plex_Sans'] text-[11px] text-[#57564F] mt-0.5">
                        Gap between letters (lower = longer)
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-2.5">
                      <button
                        type="button"
                        aria-label="Increase pause between letters"
                        onClick={() =>
                          setSettings((s) => ({
                            ...s,
                            farnsworthWpm: Math.max(5, s.farnsworthWpm - 1),
                          }))
                        }
                        className={`w-8 h-8 shrink-0 bg-[#F4F3EE] hover:bg-[#141413] hover:text-[#FAF9F6] border border-[#141413] font-['IBM_Plex_Mono'] text-sm font-bold ${TACTILE_BTN}`}
                      >
                        −
                      </button>
                      <input
                        id="ctrl-farnsworth"
                        type="range"
                        min={5}
                        max={settings.wpm}
                        value={settings.farnsworthWpm}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            farnsworthWpm: Number(e.target.value),
                          }))
                        }
                        className="w-full accent-[#1D4ED8] cursor-pointer"
                      />
                      <button
                        type="button"
                        aria-label="Decrease pause between letters"
                        onClick={() =>
                          setSettings((s) => ({
                            ...s,
                            farnsworthWpm: Math.min(s.wpm, s.farnsworthWpm + 1),
                          }))
                        }
                        className={`w-8 h-8 shrink-0 bg-[#F4F3EE] hover:bg-[#141413] hover:text-[#FAF9F6] border border-[#141413] font-['IBM_Plex_Mono'] text-sm font-bold ${TACTILE_BTN}`}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* 03. Sidetone Pitch */}
                  <div className="bg-[#FAF9F6] border border-[#141413] p-3 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-baseline font-['IBM_Plex_Mono'] text-[11px] font-bold uppercase tracking-[0.08em] text-[#141413]">
                        <label htmlFor="ctrl-freq">Sidetone Pitch</label>
                        <span className="text-[#1D4ED8] tabular-nums">
                          {settings.freq} HZ
                        </span>
                      </div>
                      <p className="font-['IBM_Plex_Sans'] text-[11px] text-[#57564F] mt-0.5">
                        Audio tone frequency (680 Hz std)
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-2.5">
                      <button
                        type="button"
                        aria-label="Lower sidetone pitch"
                        onClick={() =>
                          setSettings((s) => ({
                            ...s,
                            freq: Math.max(400, s.freq - 20),
                          }))
                        }
                        className={`w-8 h-8 shrink-0 bg-[#F4F3EE] hover:bg-[#141413] hover:text-[#FAF9F6] border border-[#141413] font-['IBM_Plex_Mono'] text-sm font-bold ${TACTILE_BTN}`}
                      >
                        −
                      </button>
                      <input
                        id="ctrl-freq"
                        type="range"
                        min={400}
                        max={1000}
                        step={20}
                        value={settings.freq}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            freq: Number(e.target.value),
                          }))
                        }
                        className="w-full accent-[#1D4ED8] cursor-pointer"
                      />
                      <button
                        type="button"
                        aria-label="Raise sidetone pitch"
                        onClick={() =>
                          setSettings((s) => ({
                            ...s,
                            freq: Math.min(1000, s.freq + 20),
                          }))
                        }
                        className={`w-8 h-8 shrink-0 bg-[#F4F3EE] hover:bg-[#141413] hover:text-[#FAF9F6] border border-[#141413] font-['IBM_Plex_Mono'] text-sm font-bold ${TACTILE_BTN}`}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* 04. Audition & Mute Controls */}
                  <div className="bg-[#FAF9F6] border border-[#141413] p-3 flex flex-col justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        audioEngine.playSequence('HI', {
                          wpm: settings.wpm,
                          farnsworthWpm: settings.farnsworthWpm,
                          freq: settings.freq,
                          muted: false,
                        })
                      }
                      className={`w-full min-h-[38px] px-3 py-1.5 bg-[#141413] hover:bg-[#1D4ED8] text-[#FAF9F6] font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.1em] ${TACTILE_BTN}`}
                    >
                      Test Tone (HI)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!settings.muted) audioEngine.stopAll();
                        setSettings((s) => ({ ...s, muted: !s.muted }));
                      }}
                      className={`w-full min-h-[38px] px-3 py-1.5 border border-[#141413] font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.1em] ${TACTILE_BTN} ${
                        settings.muted
                          ? 'bg-[#B91C1C] text-[#FAF9F6]'
                          : 'bg-[#F4F3EE] hover:bg-[#141413] hover:text-[#FAF9F6] text-[#141413]'
                      }`}
                    >
                      {settings.muted ? 'Sidetone Muted' : 'Sidetone Active'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </header>

        {/* Tamper Quarantine Notice (Triggers ONLY if stored logbook signature fails) */}
        {tamperAlert && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-4">
            <div className="bg-[#B91C1C]/10 border border-[#B91C1C] px-4 py-3 flex flex-wrap items-center justify-between gap-2">
              <span className="font-['IBM_Plex_Mono'] text-xs text-[#B91C1C] font-bold">
                SECURITY NOTICE · TAMPERED OR CORRUPTED LOCAL STORAGE QUARANTINED AND RESET
              </span>
              <button
                type="button"
                onClick={() => setTamperAlert(false)}
                className={`font-['IBM_Plex_Mono'] text-xs font-bold uppercase underline text-[#B91C1C] ${TACTILE_BTN}`}
              >
                Acknowledge
              </button>
            </div>
          </div>
        )}

        {/* Main Workspace Container */}
        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          {activeTab === 'translate' && (
            <TranslateView
              audioEngine={audioEngine}
              settings={settings}
              showBanner={showBanner}
            />
          )}
          {activeTab === 'train' && (
            <TrainView
              logbook={logbook}
              settings={settings}
              audioEngine={audioEngine}
              isCarrierOn={isCarrierOn}
              onRecordResult={handleRecordResult}
              onAwardXp={handleAwardXp}
            />
          )}
          {activeTab === 'logbook' && (
            <LogbookView
              logbook={logbook}
              settings={settings}
              audioEngine={audioEngine}
              onPurgeLogbook={handlePurgeLogbook}
              showBanner={showBanner}
            />
          )}
        </main>
      </div>

      {/* Footer Colophon & Legal Documentation Navigation */}
      <footer className="border-t border-[#141413] bg-[#FAF9F6]">
        {!noticeDismissed && (
          <div className="border-b border-[#141413]/20 bg-[#EAE8E1]">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2">
              <span className="font-['IBM_Plex_Sans'] text-xs text-[#57564F]">
                {storageAvailable
                  ? 'MorseLab uses essential localStorage solely to save your Koch logbook on this device. Zero tracking cookies or external analytics.'
                  : 'Browser storage is restricted in this session; logbook progress is running in temporary memory.'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setNoticeDismissed(true);
                  try {
                    window.localStorage.setItem(NOTICE_ACK_KEY, '1');
                  } catch {
                    // Ignore storage error
                  }
                }}
                className={`font-['IBM_Plex_Mono'] text-[11px] font-bold uppercase tracking-[0.12em] text-[#141413] underline ${TACTILE_BTN}`}
              >
                Dismiss Notice
              </button>
            </div>
          </div>
        )}

        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <MorseLabLogo size={22} />
            <div className="font-['IBM_Plex_Mono'] text-[11px] uppercase tracking-[0.1em] text-[#57564F] flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[#141413] font-bold">
                RAYCE MANUEL E. FILLON
              </span>
              <span>·</span>
              <a
                href="mailto:zerorayce@gmail.com"
                className="hover:text-[#1D4ED8] underline"
              >
                ZERORAYCE@GMAIL.COM
              </a>
              <span>·</span>
              <a
                href="https://www.linkedin.com/in/raycefillon"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#1D4ED8] underline"
              >
                LINKEDIN
              </a>
            </div>
          </div>

          <nav
            aria-label="Documentation and Legal"
            className="flex flex-wrap items-center gap-4 font-['IBM_Plex_Mono'] text-[11px] uppercase tracking-[0.12em]"
          >
            <button
              type="button"
              onClick={() => setActiveTab('manual')}
              className={`${TACTILE_BTN} ${
                activeTab === 'manual'
                  ? 'text-[#1D4ED8] font-bold underline'
                  : 'text-[#141413] hover:text-[#1D4ED8]'
              }`}
            >
              Operator Manual
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('terms')}
              className={`${TACTILE_BTN} ${
                activeTab === 'terms'
                  ? 'text-[#1D4ED8] font-bold underline'
                  : 'text-[#141413] hover:text-[#1D4ED8]'
              }`}
            >
              Terms of Service
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('privacy')}
              className={`${TACTILE_BTN} ${
                activeTab === 'privacy'
                  ? 'text-[#1D4ED8] font-bold underline'
                  : 'text-[#141413] hover:text-[#1D4ED8]'
              }`}
            >
              Privacy Policy
            </button>
          </nav>
        </div>

        {/* Render Active Documentation Sheet Below Footer Bar When Selected */}
        {(activeTab === 'manual' ||
          activeTab === 'terms' ||
          activeTab === 'privacy') && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-10">
            {activeTab === 'manual' && (
              <ManualView onBack={() => setActiveTab('translate')} />
            )}
            {activeTab === 'terms' && (
              <TermsView onBack={() => setActiveTab('translate')} />
            )}
            {activeTab === 'privacy' && (
              <PrivacyView onBack={() => setActiveTab('translate')} />
            )}
          </div>
        )}
      </footer>
    </div>
  );
}

export default function App() {
  const [audioEngine] = useState(() => new MorseAudioEngine());

  return (
    <MorseLabErrorBoundary audioEngine={audioEngine}>
      <MorseLabWorkspace audioEngine={audioEngine} />
    </MorseLabErrorBoundary>
  );
}