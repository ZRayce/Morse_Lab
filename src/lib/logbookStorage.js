import { KOCH_SEQUENCE, MORSE_MAP, sanitizeText } from './morseCodec.js';

export const STORAGE_KEY = 'morselab_logbook_v2';
export const NOTICE_ACK_KEY = 'morselab_notice_ack_v2';
export const MIN_HUMAN_REACTION_MS = 90;

const CHECKSUM_DOMAIN = 'MORSELAB-LOCAL-LOGBOOK-CHECKSUM-V2';
// Retained strictly for read-only backward migration of existing v2 records:
const LEGACY_V2_PREFIX = 'MORSELAB-CW-ARCHIVAL-INTEGRITY-2026-RMF';

export function computeNonCryptoChecksum(payload, domain = CHECKSUM_DOMAIN) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  const full = `${domain}::${payload}`;
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

export async function computeIntegrityChecksum(payload, { forceFallback = false } = {}) {
  if (
    !forceFallback &&
    typeof globalThis !== 'undefined' &&
    globalThis.crypto &&
    globalThis.crypto.subtle &&
    typeof TextEncoder !== 'undefined'
  ) {
    try {
      const enc = new TextEncoder();
      const digest = await globalThis.crypto.subtle.digest(
        'SHA-256',
        enc.encode(`${CHECKSUM_DOMAIN}::${payload}`)
      );
      const hex = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      return `sha256:${hex}`;
    } catch {
      // Fall back to deterministic non-cryptographic checksum
    }
  }
  return `fnv64:${computeNonCryptoChecksum(payload, CHECKSUM_DOMAIN)}`;
}

export async function computeLegacyV2Signature(payload) {
  if (
    typeof globalThis !== 'undefined' &&
    globalThis.crypto &&
    globalThis.crypto.subtle &&
    typeof TextEncoder !== 'undefined'
  ) {
    try {
      const enc = new TextEncoder();
      const key = await globalThis.crypto.subtle.importKey(
        'raw',
        enc.encode(LEGACY_V2_PREFIX),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const sig = await globalThis.crypto.subtle.sign(
        'HMAC',
        key,
        enc.encode(payload)
      );
      return Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      // Fall through to legacy non-crypto digest
    }
  }
  return computeNonCryptoChecksum(payload, LEGACY_V2_PREFIX);
}

export function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function createDefaultLogbook() {
  return {
    kochLevel: 2,
    xp: 0,
    streak: 0,
    lastActiveDate: '',
    stats: {},
  };
}

export function sanitizeLogbookSchema(raw) {
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
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return null;
      }
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

export function detectStorageAvailability(storage = globalThis?.localStorage) {
  try {
    if (!storage) return false;
    const probeKey = '__morselab_probe__';
    storage.setItem(probeKey, '1');
    storage.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
}

export async function saveLogbookToStorage(
  logbook,
  storage = globalThis?.localStorage,
  options = {}
) {
  if (!storage) return false;
  try {
    const serializedData = JSON.stringify(logbook);
    const checksum = await computeIntegrityChecksum(serializedData, options);
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ data: logbook, checksum })
    );
    return true;
  } catch {
    return false;
  }
}

export async function loadLogbookFromStorage(
  storage = globalThis?.localStorage,
  options = {}
) {
  if (!storage) {
    return { logbook: createDefaultLogbook(), recoveredFromCorruption: false };
  }

  let rawStr;
  try {
    rawStr = storage.getItem(STORAGE_KEY);
  } catch {
    return { logbook: createDefaultLogbook(), recoveredFromCorruption: false };
  }

  if (!rawStr) {
    return { logbook: createDefaultLogbook(), recoveredFromCorruption: false };
  }

  try {
    const parsed = JSON.parse(rawStr);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !parsed.data) {
      throw new Error('Malformed logbook envelope');
    }

    const serializedData = JSON.stringify(parsed.data);
    let validChecksum = false;
    let needsMigration = false;

    if (typeof parsed.checksum === 'string' && parsed.checksum.length > 0) {
      const useFallback =
        parsed.checksum.startsWith('fnv64:') || Boolean(options.forceFallback);
      const expected = await computeIntegrityChecksum(serializedData, {
        forceFallback: useFallback,
      });
      validChecksum = constantTimeEqual(parsed.checksum, expected);
    } else if (typeof parsed.sig === 'string' && parsed.sig.length > 0) {
      const legacyWebCrypto = await computeLegacyV2Signature(serializedData);
      const legacyFallback = computeNonCryptoChecksum(
        serializedData,
        LEGACY_V2_PREFIX
      );
      validChecksum =
        constantTimeEqual(parsed.sig, legacyWebCrypto) ||
        constantTimeEqual(parsed.sig, legacyFallback);
      needsMigration = validChecksum;
    }

    if (!validChecksum) {
      throw new Error('Logbook checksum mismatch');
    }

    const validated = sanitizeLogbookSchema(parsed.data);
    if (!validated) {
      throw new Error('Invalid logbook schema');
    }

    if (needsMigration) {
      await saveLogbookToStorage(validated, storage, options);
    }

    return { logbook: validated, recoveredFromCorruption: false };
  } catch {
    try {
      storage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore removal error
    }
    return { logbook: createDefaultLogbook(), recoveredFromCorruption: true };
  }
}

export function purgeLogbookFromStorage(storage = globalThis?.localStorage) {
  try {
    if (storage) {
      storage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore removal error
  }
}

export function evaluateKochSession({
  score,
  totalQuestions = 10,
  currentLevel = 2,
  plausibleTiming = true,
}) {
  const safeTotal = Math.max(1, Number(totalQuestions) || 10);
  const safeScore = Math.min(safeTotal, Math.max(0, Number(score) || 0));
  const accuracy = Math.round((safeScore / safeTotal) * 100);
  const canPromote =
    accuracy >= 85 &&
    currentLevel < KOCH_SEQUENCE.length &&
    Boolean(plausibleTiming);
  const promotedChar = canPromote ? KOCH_SEQUENCE[currentLevel] : null;
  const xpEarned = safeScore * 15 + (canPromote ? 50 : 0);

  return {
    accuracy,
    score: safeScore,
    canPromote,
    promotedChar,
    xpEarned,
  };
}

export function applyDrillResultToLogbook(
  prev,
  { char, isCorrect, promoteLevel = false, todayDateStr = '' }
) {
  const prevStat = prev.stats[char] || { attempts: 0, correct: 0 };
  const nextStats = Object.prototype.hasOwnProperty.call(MORSE_MAP, char)
    ? {
        ...prev.stats,
        [char]: {
          attempts: prevStat.attempts + 1,
          correct: prevStat.correct + (isCorrect ? 1 : 0),
        },
      }
    : { ...prev.stats };

  const nextLevel = promoteLevel
    ? Math.min(KOCH_SEQUENCE.length, prev.kochLevel + 1)
    : prev.kochLevel;
  const nextXp = Math.min(
    1000000,
    prev.xp + (isCorrect ? 15 : 2) + (promoteLevel ? 50 : 0)
  );
  const nextStreak =
    todayDateStr && prev.lastActiveDate === todayDateStr
      ? prev.streak
      : prev.streak + 1;

  return {
    kochLevel: nextLevel,
    xp: nextXp,
    streak: nextStreak,
    lastActiveDate: todayDateStr || prev.lastActiveDate,
    stats: nextStats,
  };
}