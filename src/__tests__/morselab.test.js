import { MorseAudioEngine } from '../lib/audioEngine.js';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MORSE_MAP,
  REVERSE_MORSE_MAP,
  KOCH_SEQUENCE,
  MATRIX_CHARACTERS,
  sanitizeText,
  formatMorseDisplay,
  encodeTextToMorse,
  decodeMorseToText,
} from '../lib/morseCodec.js';
import {
  calculateMorseTiming,
  calculateStraightKeyThresholds,
} from '../lib/timing.js';
import {
  STORAGE_KEY,
  createDefaultLogbook,
  sanitizeLogbookSchema,
  computeIntegrityChecksum,
  computeLegacyV2Signature,
  loadLogbookFromStorage,
  saveLogbookToStorage,
  evaluateKochSession,
  applyDrillResultToLogbook,
} from '../lib/logbookStorage.js';

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    },
    clear: () => map.clear(),
  };
}

describe('ITU Morse Dictionary & Codec', () => {
  it('maintains a bijective mapping across all ITU characters', () => {
    const entries = Object.entries(MORSE_MAP);
    expect(entries.length).toBe(47);
    expect(Object.keys(REVERSE_MORSE_MAP).length).toBe(entries.length);

    for (const [char, code] of entries) {
      expect(REVERSE_MORSE_MAP[code]).toBe(char);
    }

    for (const ch of MATRIX_CHARACTERS) {
      expect(MORSE_MAP[ch]).toBeDefined();
    }
  });

  it('encodes plaintext and decodes Morse sequences accurately', () => {
    expect(encodeTextToMorse('CQ DX DE MORSELAB K')).toBe(
      '-.-. --.- / -.. -..- / -.. . / -- --- .-. ... . .-.. .- -... / -.-'
    );
    expect(
      decodeMorseToText(
        '-.-. --.- / -.. -..- / -.. . / -- --- .-. ... . .-.. .- -... / -.-'
      )
    ).toBe('CQ DX DE MORSELAB K');
  });

  it('supports round-trip encode and decode across alphanumeric and punctuation text', () => {
    const sample = 'PARIS 73? CQ/TEST @ 2026!';
    const encoded = encodeTextToMorse(sample);
    expect(decodeMorseToText(encoded)).toBe(sample);
  });

  it('normalizes display glyphs (· and —) back to ASCII during decoding', () => {
    const display = formatMorseDisplay('... --- ...');
    expect(display).toBe('··· ——— ···');
    expect(decodeMorseToText(display)).toBe('SOS');
  });

  it('handles invalid, control-character, and unsupported inputs safely', () => {
    expect(sanitizeText('HI\x00\x07\x7FTHERE', 50)).toBe('HITHERE');
    expect(sanitizeText(null)).toBe('');
    expect(encodeTextToMorse('   ')).toBe('');
    expect(encodeTextToMorse('HI ~#` THERE')).toBe('.... .. / - .... . .-. .');
    expect(decodeMorseToText('.... .. / ........')).toBe('HI ?');
  });
});

describe('PARIS & Farnsworth Timing Calculations', () => {
  it('computes standard PARIS intervals (1200 / WPM) with 1:3:3:7 ratios', () => {
    const timing = calculateMorseTiming(20, 20);
    expect(timing.ditMs).toBe(60);
    expect(timing.dahMs).toBe(180);
    expect(timing.intraGapMs).toBe(60);
    expect(timing.charGapMs).toBe(180);
    expect(timing.wordGapMs).toBe(420);
  });

  it('stretches inter-character and inter-word gaps when Farnsworth WPM is lower', () => {
    const timing = calculateMorseTiming(20, 10);
    expect(timing.ditMs).toBe(60);
    expect(timing.dahMs).toBe(180);
    expect(timing.charGapMs).toBe(360);
    expect(timing.wordGapMs).toBe(840);
  });

  it('clamps Farnsworth speed so it never exceeds character WPM', () => {
    const timing = calculateMorseTiming(15, 30);
    expect(timing.farnsworthWpm).toBe(15);
    expect(timing.charGapMs).toBe(240);
  });

  it('computes bounded straight-key thresholds', () => {
    const thresholds = calculateStraightKeyThresholds(18, 14);
    expect(thresholds.ditThresholdMs).toBeGreaterThanOrEqual(145);
    expect(thresholds.charPauseMs).toBeGreaterThan(thresholds.ditThresholdMs);
    expect(thresholds.wordPauseMs).toBeGreaterThan(thresholds.charPauseMs);
  });
});

describe('Koch Progression & Logbook Schema Validation', () => {
  it('promotes Koch level only at >= 85% accuracy with plausible human timing', () => {
    expect(KOCH_SEQUENCE[0]).toBe('K');
    expect(KOCH_SEQUENCE[1]).toBe('M');

    const failRun = evaluateKochSession({
      score: 8,
      totalQuestions: 10,
      currentLevel: 2,
      plausibleTiming: true,
    });
    expect(failRun.accuracy).toBe(80);
    expect(failRun.canPromote).toBe(false);
    expect(failRun.promotedChar).toBeNull();

    const passRun = evaluateKochSession({
      score: 9,
      totalQuestions: 10,
      currentLevel: 2,
      plausibleTiming: true,
    });
    expect(passRun.accuracy).toBe(90);
    expect(passRun.canPromote).toBe(true);
    expect(passRun.promotedChar).toBe('R');

    const implausibleRun = evaluateKochSession({
      score: 10,
      totalQuestions: 10,
      currentLevel: 2,
      plausibleTiming: false,
    });
    expect(implausibleRun.canPromote).toBe(false);
  });

  it('caps Koch progression at maximum sequence length', () => {
    const maxRun = evaluateKochSession({
      score: 10,
      totalQuestions: 10,
      currentLevel: KOCH_SEQUENCE.length,
      plausibleTiming: true,
    });
    expect(maxRun.canPromote).toBe(false);
    expect(maxRun.promotedChar).toBeNull();
  });

  it('updates logbook stats, XP, streak, and level deterministically', () => {
    const initial = createDefaultLogbook();
    const next = applyDrillResultToLogbook(initial, {
      char: 'K',
      isCorrect: true,
      promoteLevel: true,
      todayDateStr: '2026-11-26',
    });
    expect(next.kochLevel).toBe(3);
    expect(next.xp).toBe(65);
    expect(next.streak).toBe(1);
    expect(next.stats.K).toEqual({ attempts: 1, correct: 1 });
  });

  it('rejects malformed logbooks and prototype pollution keys', () => {
    expect(sanitizeLogbookSchema(null)).toBeNull();
    expect(sanitizeLogbookSchema([])).toBeNull();
    expect(
      sanitizeLogbookSchema({
        kochLevel: 1,
        xp: 0,
        streak: 0,
        stats: {},
      })
    ).toBeNull();
    expect(
      sanitizeLogbookSchema({
        kochLevel: 2,
        xp: 10,
        streak: 1,
        stats: { K: { attempts: 3, correct: 5 } },
      })
    ).toBeNull();

    const polluted = JSON.parse(
      '{"kochLevel":2,"xp":0,"streak":0,"stats":{"__proto__":{"attempts":1,"correct":1}}}'
    );
    expect(sanitizeLogbookSchema(polluted)).toBeNull();
  });
});

describe('Local Storage Integrity & Corruption Recovery', () => {
  let storage;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it('persists and loads logbooks with Web Crypto SHA-256 integrity checksum', async () => {
    const book = {
      kochLevel: 4,
      xp: 180,
      streak: 3,
      lastActiveDate: '2026-11-26',
      stats: { K: { attempts: 10, correct: 9 } },
    };

    const saved = await saveLogbookToStorage(book, storage);
    expect(saved).toBe(true);

    const { logbook, recoveredFromCorruption } = await loadLogbookFromStorage(
      storage
    );
    expect(recoveredFromCorruption).toBe(false);
    expect(logbook).toEqual(book);
  });

  it('supports non-cryptographic fallback checksum when Web Crypto is disabled', async () => {
    const book = {
      kochLevel: 3,
      xp: 90,
      streak: 2,
      lastActiveDate: '2026-11-26',
      stats: { M: { attempts: 5, correct: 5 } },
    };

    const fallbackChecksum = await computeIntegrityChecksum(
      JSON.stringify(book),
      { forceFallback: true }
    );
    expect(fallbackChecksum.startsWith('fnv64:')).toBe(true);

    await saveLogbookToStorage(book, storage, { forceFallback: true });
    const { logbook, recoveredFromCorruption } = await loadLogbookFromStorage(
      storage,
      { forceFallback: true }
    );
    expect(recoveredFromCorruption).toBe(false);
    expect(logbook).toEqual(book);
  });

  it('migrates legacy v2 HMAC-signed logbooks without losing user progress', async () => {
    const legacyBook = {
      kochLevel: 5,
      xp: 320,
      streak: 4,
      lastActiveDate: '2026-11-23',
      stats: { K: { attempts: 12, correct: 11 } },
    };
    const legacySig = await computeLegacyV2Signature(JSON.stringify(legacyBook));
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ data: legacyBook, sig: legacySig })
    );

    const { logbook, recoveredFromCorruption } = await loadLogbookFromStorage(
      storage
    );
    expect(recoveredFromCorruption).toBe(false);
    expect(logbook).toEqual(legacyBook);

    const migratedRaw = JSON.parse(storage.getItem(STORAGE_KEY));
    expect(migratedRaw.checksum).toBeDefined();
    expect(migratedRaw.sig).toBeUndefined();
  });

  it('safely resets corrupted JSON or mismatched checksums without crashing', async () => {
    storage.setItem(STORAGE_KEY, '{corrupted_json');
    const badJsonResult = await loadLogbookFromStorage(storage);
    expect(badJsonResult.recoveredFromCorruption).toBe(true);
    expect(badJsonResult.logbook).toEqual(createDefaultLogbook());
    expect(storage.getItem(STORAGE_KEY)).toBeNull();

    const book = createDefaultLogbook();
    await saveLogbookToStorage(book, storage);
    const envelope = JSON.parse(storage.getItem(STORAGE_KEY));
    envelope.data.xp = 999999;
    storage.setItem(STORAGE_KEY, JSON.stringify(envelope));

    const mismatchResult = await loadLogbookFromStorage(storage);
    expect(mismatchResult.recoveredFromCorruption).toBe(true);
    expect(mismatchResult.logbook).toEqual(createDefaultLogbook());
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe('MorseAudioEngine Lifecycle & Playback', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('handles unavailable AudioContext gracefully while notifying transmit state', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal('window', {});

    const engine = new MorseAudioEngine();
    const states = [];
    const blockedStates = [];
    engine.subscribe((s) => states.push(s));
    engine.subscribeBlocked((b) => blockedStates.push(b));

    const completed = await engine.playSequence('E', { wpm: 60, muted: false });

    expect(completed).toBe(true);
    expect(states).toContain(true);
    expect(states[states.length - 1]).toBe(false);
    expect(blockedStates).toEqual([]);
  });

  it('resumes suspended AudioContext and updates blocked state when blocked or running', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const resumeSpy = vi.fn(async function resume() {
      this.state = 'running';
    });

    const makeNode = () => ({
      type: 'sine',
      frequency: { setValueAtTime: vi.fn() },
      gain: {
        value: 0.22,
        cancelScheduledValues: vi.fn(),
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(function stop() {
        if (typeof this.onended === 'function') this.onended();
      }),
      onended: null,
    });

    const mockCtx = {
      state: 'suspended',
      currentTime: 1,
      destination: {},
      resume: resumeSpy,
      createOscillator: vi.fn(() => makeNode()),
      createGain: vi.fn(() => makeNode()),
    };

    vi.stubGlobal('window', {
      AudioContext: vi.fn(function AudioContext() {
        return mockCtx;
      }),
    });

    const engine = new MorseAudioEngine();
    const blockedStates = [];
    engine.subscribeBlocked((b) => blockedStates.push(b));

    await engine.startManualTone(680, false);
    expect(resumeSpy).toHaveBeenCalledTimes(1);
    expect(mockCtx.state).toBe('running');
    expect(engine.isAudioBlocked).toBe(false);
    expect(blockedStates).toEqual([]);
    expect(engine.isTransmitting).toBe(true);

    engine.stopManualTone();
    expect(engine.isTransmitting).toBe(false);
  });
});

it('cancels active sequence playback and clears pending timers on stopAll', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('window', {});

  const engine = new MorseAudioEngine();
  const { ditMs } = calculateMorseTiming(12, 12);
  const promise = engine.playSequence('SOS', { wpm: 12, muted: true });

  await vi.advanceTimersByTimeAsync(Math.max(20, Math.floor(ditMs / 2)));
  expect(engine.pendingTimers.size).toBeGreaterThan(0);

  engine.stopAll();
  expect(engine.pendingTimers.size).toBe(0);
  expect(engine.isTransmitting).toBe(false);

  const result = await promise;
  expect(result).toBe(false);
});

it('triggers 5-second watchdog automatically during manual tone', async () => {
    vi.useFakeTimers();
    const oscNode = {
      type: 'sine',
      frequency: { setValueAtTime: vi.fn() },
      gain: {
        value: 0.22,
        cancelScheduledValues: vi.fn(),
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null,
    };
    const mockCtx = {
      state: 'running',
      currentTime: 0,
      destination: {},
      resume: vi.fn(async () => {}),
      createOscillator: vi.fn(() => oscNode),
      createGain: vi.fn(() => oscNode),
    };
    vi.stubGlobal('window', {
      AudioContext: vi.fn(function AudioContext() {
        return mockCtx;
      }),
    });

    const engine = new MorseAudioEngine();
    await engine.startManualTone(700, false);
    expect(engine.isTransmitting).toBe(true);

    await vi.advanceTimersByTimeAsync(5000);
    expect(engine.isTransmitting).toBe(false);
  });