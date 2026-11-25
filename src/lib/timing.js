export function calculateMorseTiming(wpm = 18, farnsworthWpm = 18) {
  const cleanWpm = Math.min(45, Math.max(5, Number(wpm) || 18));
  const cleanFarnsworth = Math.min(
    cleanWpm,
    Math.max(5, Number(farnsworthWpm) || cleanWpm)
  );

  const ditMs = 1200 / cleanWpm;
  const dahMs = ditMs * 3;
  const intraGapMs = ditMs;

  const farnsworthUnitMs = 1200 / cleanFarnsworth;
  const extraScale = cleanFarnsworth < cleanWpm ? farnsworthUnitMs / ditMs : 1;
  const charGapMs = ditMs * 3 * extraScale;
  const wordGapMs = ditMs * 7 * extraScale;

  return {
    wpm: cleanWpm,
    farnsworthWpm: cleanFarnsworth,
    ditMs,
    dahMs,
    intraGapMs,
    charGapMs,
    wordGapMs,
  };
}

export function calculateStraightKeyThresholds(wpm = 18, farnsworthWpm = 14) {
  const { wpm: cleanWpm, farnsworthWpm: cleanFarnsworth } = calculateMorseTiming(
    wpm,
    farnsworthWpm
  );
  return {
    ditThresholdMs: Math.max(145, (1200 / cleanWpm) * 2.2),
    charPauseMs: Math.max(420, (1200 / cleanFarnsworth) * 3.8),
    wordPauseMs: Math.max(950, (1200 / cleanFarnsworth) * 7.5),
  };
}