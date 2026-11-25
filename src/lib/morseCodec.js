export const MORSE_MAP = Object.freeze({
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

export const REVERSE_MORSE_MAP = Object.freeze(
  Object.entries(MORSE_MAP).reduce((acc, [char, code]) => {
    acc[code] = char;
    return acc;
  }, Object.create(null))
);

export const KOCH_SEQUENCE = Object.freeze([
  'K', 'M', 'R', 'S', 'U', 'A', 'P', 'T', 'L', 'O',
  'W', 'I', '.', 'N', 'J', 'E', 'F', '0', 'Y', ',',
  'V', 'G', '5', '/', 'Q', '9', 'Z', 'H', '3', '8',
  'B', '?', '4', '2', '7', 'C', '1', 'D', '6', 'X',
]);

export const MATRIX_CHARACTERS = Object.freeze([
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I',
  'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R',
  'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '0',
  '1', '2', '3', '4', '5', '6', '7', '8', '9',
]);

export const STRAIGHT_KEY_LEVELS = Object.freeze([
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

export const DAILY_INTERCEPTS = Object.freeze([
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

export const SOS_CHALLENGES = Object.freeze([
  'SOS',
  'MAYDAY',
  'WATER',
  'MEDIC',
  'NORTH',
  'RESCUE',
  'SHELTER',
  'BATTERY',
]);

export function sanitizeText(raw, maxLen = 500) {
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

export function formatMorseDisplay(rawMorse) {
  if (typeof rawMorse !== 'string' || !rawMorse) return '';
  return rawMorse.replace(/\./g, '·').replace(/-/g, '—');
}

export function encodeTextToMorse(text) {
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

export function decodeMorseToText(morse) {
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