import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  MORSE_MAP,
  REVERSE_MORSE_MAP,
  KOCH_SEQUENCE,
  MATRIX_CHARACTERS,
  STRAIGHT_KEY_LEVELS,
  DAILY_INTERCEPTS,
  SOS_CHALLENGES,
  sanitizeText,
  formatMorseDisplay,
  encodeTextToMorse,
  decodeMorseToText,
} from './lib/morseCodec.js';
import { calculateStraightKeyThresholds } from './lib/timing.js';
import { MorseAudioEngine } from './lib/audioEngine.js';
import {
  NOTICE_ACK_KEY,
  MIN_HUMAN_REACTION_MS,
  createDefaultLogbook,
  detectStorageAvailability,
  loadLogbookFromStorage,
  saveLogbookToStorage,
  purgeLogbookFromStorage,
  evaluateKochSession,
  applyDrillResultToLogbook,
} from './lib/logbookStorage.js';
import { TACTILE_BTN, HIGHLIGHTED_FIELD_LABEL } from './lib/uiStyles.js';
import {
  MorseLabLogo,
  CompletionCard,
  StationBootScreen,
  SystemFaultView,
  MorseLabErrorBoundary,
} from './components/StationChrome.jsx';
import {
  ManualView,
  TermsView,
  PrivacyView,
} from './components/DocumentationViews.jsx';

const TODAY_INTERCEPT_IDX =
  Math.floor(Date.now() / 86400000) % DAILY_INTERCEPTS.length;
const TODAY_DATE_STR = new Date().toISOString().slice(0, 10);

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
// VIEW 01: BIDIRECTIONAL TRANSLATOR
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

        <div
          aria-live="polite"
          className="font-['IBM_Plex_Mono'] text-xs uppercase tracking-[0.12em]"
        >
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
              className={`min-h-[38px] px-3 py-1 bg-[#FAF9F6] hover:bg-[#141413] hover:text-[#FAF9F6] border border-[#141413] font-['IBM_Plex_Mono'] text-[11px] font-bold uppercase tracking-[0.12em] text-[#141413] ${TACTILE_BTN}`}
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
            className="w-full flex-1 bg-[#F4F3EE] border border-[#141413]/35 focus:border-[#1D4ED8] focus-visible:ring-2 focus-visible:ring-[#1D4ED8] focus:outline-none p-3.5 font-['IBM_Plex_Mono'] text-base sm:text-sm text-[#141413] uppercase resize-y"
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
            className="w-full bg-[#EAE8E1] border border-[#141413]/35 focus:border-[#1D4ED8] focus-visible:ring-2 focus-visible:ring-[#1D4ED8] focus:outline-none p-3.5 font-['IBM_Plex_Mono'] text-base sm:text-lg font-bold tracking-[0.16em] text-[#141413] resize-y"
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
// VIEW 02: KOCH DRILLS, STRAIGHT KEY, SIGNAL LAMP & CHALLENGES
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
  const transitionTimerRef = useRef(null);
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
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
      }
      audioEngine.stopAll();
    };
  }, [audioEngine]);

  const handleStartSession = useCallback(() => {
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
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

      transitionTimerRef.current = setTimeout(() => {
        transitionTimerRef.current = null;
        if (questionNum >= totalQuestions) {
          const summary = evaluateKochSession({
            score: nextScore,
            totalQuestions,
            currentLevel: logbook.kochLevel,
            plausibleTiming,
          });

          if (summary.canPromote) {
            onRecordResult(targetChar, isCorrect, true);
            audioEngine.playLevelUpFanfare(settings.muted);
          } else {
            audioEngine.playCompletionFanfare(settings.muted);
          }

          setCompletedSummary(summary);
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
            role="img"
            aria-label={isCarrierOn ? 'Signal lamp illuminated' : 'Signal lamp off'}
            className={`w-20 h-20 border-2 border-[#141413] transition-colors duration-75 ${
              isCarrierOn ? 'bg-[#B91C1C]' : 'bg-[#EAE8E1]'
            }`}
          />
          <div className="font-['IBM_Plex_Mono'] text-[11px] font-bold uppercase tracking-[0.14em] text-[#57564F] mt-3">
            {isCarrierOn ? 'CARRIER MARK ON' : 'OBSERVE FLASH CADENCE'}
          </div>
          <button
            type="button"
            onClick={() => triggerPrompt(targetChar)}
            className={`mt-3 min-h-[40px] px-4 py-1.5 bg-[#FAF9F6] hover:bg-[#141413] hover:text-[#FAF9F6] border border-[#141413] font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] ${TACTILE_BTN}`}
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

      <div aria-live="polite" className="min-h-[1px]">
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
      </div>

      <div>
        <div className="font-['IBM_Plex_Mono'] text-[11px] font-bold uppercase tracking-[0.12em] text-[#57564F] mb-2.5">
          ACTIVE KOCH POOL ({unlockedPool.length} SYMBOLS)
        </div>
        <div
          role="group"
          aria-label="Unlocked Koch characters"
          className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2"
        >
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

  const { ditThresholdMs, charPauseMs, wordPauseMs } =
    calculateStraightKeyThresholds(settings.wpm, settings.farnsworthWpm);

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
            className={`min-h-[40px] px-3 py-1.5 bg-[#F4F3EE] hover:bg-[#141413] hover:text-[#FAF9F6] border border-[#141413] font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.1em] ${TACTILE_BTN}`}
          >
            Hear Target
          </button>
          <button
            type="button"
            onClick={handleAdvanceLevel}
            className={`min-h-[40px] px-3 py-1.5 bg-[#FAF9F6] hover:bg-[#EAE8E1] border border-[#141413]/40 font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.1em] text-[#57564F] ${TACTILE_BTN}`}
          >
            Skip
          </button>
        </div>
      </div>

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

      <div className="bg-[#EAE8E1] border border-[#141413] p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-['IBM_Plex_Mono'] text-[11px] font-bold uppercase tracking-[0.12em] text-[#141413]">
            YOUR PAPER TAPE
          </span>
          <span className="font-['IBM_Plex_Mono'] text-base sm:text-lg font-bold tracking-[0.22em] text-[#1D4ED8]">
            {activeCode ? formatMorseDisplay(activeCode) : 'READY'}
          </span>
        </div>
        <div
          aria-live="polite"
          className="min-h-[44px] font-['IBM_Plex_Mono'] text-xl sm:text-2xl font-bold tracking-[0.18em] text-[#141413] break-all"
        >
          {decodedTape || (
            <span className="text-[#57564F]/55">TAP OR HOLD KEY BELOW...</span>
          )}
        </div>
      </div>

      <div aria-live="polite">
        {mismatchHint && (
          <div className="px-4 py-2.5 bg-[#B91C1C]/10 border border-[#B91C1C] font-['IBM_Plex_Mono'] text-xs font-bold text-[#B91C1C]">
            TAPE READS &ldquo;{decodedTape.trim() || 'EMPTY'}&rdquo; — CLEAR TAPE AND TRY &ldquo;{targetPhrase}&rdquo; AGAIN
          </div>
        )}
      </div>

      <button
        type="button"
        aria-pressed={isPressed}
        onPointerDown={(e) => handleKeyDownAction(e.isTrusted)}
        onPointerUp={handleKeyUpAction}
        onPointerLeave={handleKeyUpAction}
        onPointerCancel={handleKeyUpAction}
        onContextMenu={(e) => e.preventDefault()}
        style={{ WebkitTouchCallout: 'none' }}
        className={`w-full min-h-[112px] border-2 border-[#141413] font-['IBM_Plex_Mono'] text-sm font-bold uppercase tracking-[0.16em] transition-all duration-75 select-none touch-manipulation cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] focus-visible:ring-offset-1 ${
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
          aria-pressed={challengeType === 'daily'}
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
          aria-pressed={challengeType === 'sos'}
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
                className="w-full min-h-[44px] bg-[#F4F3EE] border border-[#141413] px-3.5 py-2 font-['IBM_Plex_Mono'] text-base sm:text-sm uppercase focus:border-[#1D4ED8] focus-visible:ring-2 focus-visible:ring-[#1D4ED8] focus:outline-none"
              />
            </div>

            <div aria-live="polite">
              {dailyError && (
                <div className="font-['IBM_Plex_Mono'] text-xs font-bold text-[#B91C1C]">
                  COPY MISMATCH · REPLAY INTERCEPT AND VERIFY WORD SPACING
                </div>
              )}
            </div>

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
              className="w-full min-h-[44px] bg-[#F4F3EE] border border-[#141413] px-3.5 py-2 font-['IBM_Plex_Mono'] text-base sm:text-sm uppercase focus:border-[#1D4ED8] focus-visible:ring-2 focus-visible:ring-[#1D4ED8] focus:outline-none"
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

      <div
        role="group"
        aria-label="Training modes"
        className="grid grid-cols-2 sm:grid-cols-4 gap-2"
      >
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={drillMode === m.id}
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
// VIEW 03: 36-CHARACTER MASTERY MATRIX & LOCAL LOGBOOK EXPORT
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

  useEffect(() => {
    if (!confirmPurge) return undefined;
    const timer = setTimeout(() => setConfirmPurge(false), 5000);
    return () => clearTimeout(timer);
  }, [confirmPurge]);

  const { totalAttempts, overallAccuracy, masteredCount } = useMemo(() => {
    let attempts = 0;
    let correct = 0;
    for (const s of Object.values(logbook.stats)) {
      attempts += s.attempts;
      correct += s.correct;
    }
    const accuracy = attempts > 0 ? Math.round((correct / attempts) * 100) : 0;
    const mastered = MATRIX_CHARACTERS.filter((ch) => {
      const s = logbook.stats[ch];
      return s && s.attempts >= 3 && s.correct / s.attempts >= 0.85;
    }).length;
    return {
      totalAttempts: attempts,
      overallAccuracy: accuracy,
      masteredCount: mastered,
    };
  }, [logbook.stats]);

  const handleExportJson = async () => {
    const payload = JSON.stringify(
      {
        application: 'MorseLab CW Telegraph Logbook',
        exportedAt: new Date().toISOString(),
        integrityMode: 'local-corruption-check-only',
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
      showBanner('Copied JSON logbook export to clipboard');
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
            <span className="text-[#B91C1C]">less than 60% Weak</span>
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
                aria-label={`Character ${ch}, Morse ${MORSE_MAP[ch]}, ${
                  pct !== null ? `${pct} percent accuracy` : 'untested'
                }`}
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
// MAIN APPLICATION WORKSPACE
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
  const [audioBlocked, setAudioBlocked] = useState(false);
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
  const [corruptionAlert, setCorruptionAlert] = useState(false);
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

  useEffect(() => {
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

  useEffect(() => {
    const unsubCarrier = audioEngine.subscribe((state) => setIsCarrierOn(state));
    const unsubBlocked = audioEngine.subscribeBlocked((blocked) =>
      setAudioBlocked(blocked)
    );
    const onVisChange = () => {
      if (document.hidden) {
        audioEngine.stopAll();
      }
    };
    document.addEventListener('visibilitychange', onVisChange);
    return () => {
      unsubCarrier();
      unsubBlocked();
      document.removeEventListener('visibilitychange', onVisChange);
    };
  }, [audioEngine]);

  useEffect(() => {
    let cancelled = false;
    async function initLogbook() {
      if (!storageAvailable) return;
      const { logbook: loaded, recoveredFromCorruption } =
        await loadLogbookFromStorage(window.localStorage);
      if (!cancelled) {
        setLogbook(loaded);
        if (recoveredFromCorruption) {
          setCorruptionAlert(true);
        }
      }
    }
    initLogbook();
    return () => {
      cancelled = true;
    };
  }, [storageAvailable]);

  const persistLogbook = useCallback(
    async (nextBook) => {
      if (!storageAvailable) return;
      await saveLogbookToStorage(nextBook, window.localStorage);
    },
    [storageAvailable]
  );

  const handleRecordResult = useCallback(
    (char, isCorrect, promoteLevel) => {
      setLogbook((prev) => {
        const updated = applyDrillResultToLogbook(prev, {
          char,
          isCorrect,
          promoteLevel,
          todayDateStr: TODAY_DATE_STR,
        });
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
    purgeLogbookFromStorage(window.localStorage);
    setCorruptionAlert(false);
    setLogbook(createDefaultLogbook());
  }, []);

  const selectTab = useCallback(
    (tabId) => {
      audioEngine.stopAll();
      setActiveTab(tabId);
      if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [audioEngine]
  );

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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-[#141413] focus:text-[#FAF9F6] focus:font-['IBM_Plex_Mono'] focus:text-xs focus:font-bold focus:uppercase"
      >
        Skip to main content
      </a>

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
        <header className="bg-[#FAF9F6] border-b border-[#141413]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => selectTab('translate')}
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

            <nav
              aria-label="Primary Workspace"
              className="flex items-center gap-1.5 sm:gap-2"
            >
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-current={activeTab === item.id ? 'page' : undefined}
                  onClick={() => selectTab(item.id)}
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

            <div className="flex items-center gap-2.5">
              <div
                role="status"
                aria-label={isCarrierOn ? 'Carrier Active' : 'Carrier Standby'}
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
                aria-controls="morselab-audio-drawer"
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

          {audioDrawerOpen && (
            <div
              id="morselab-audio-drawer"
              className="border-t border-[#141413] bg-[#EAE8E1]"
            >
              <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 space-y-4">
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
                          aria-pressed={isActive}
                          onClick={() =>
                            setSettings((s) => ({
                              ...s,
                              wpm: preset.wpm,
                              farnsworthWpm: preset.farnsworthWpm,
                            }))
                          }
                          className={`min-h-[38px] px-3 py-1 border border-[#141413] font-['IBM_Plex_Mono'] text-[11px] font-bold uppercase tracking-[0.08em] ${TACTILE_BTN} ${
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

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
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
                        className={`w-9 h-9 shrink-0 bg-[#F4F3EE] hover:bg-[#141413] hover:text-[#FAF9F6] border border-[#141413] font-['IBM_Plex_Mono'] text-sm font-bold ${TACTILE_BTN}`}
                      >
                        −
                      </button>
                      <input
                        id="ctrl-wpm"
                        type="range"
                        min={8}
                        max={40}
                        value={settings.wpm}
                        aria-valuetext={`${settings.wpm} words per minute`}
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
                        className={`w-9 h-9 shrink-0 bg-[#F4F3EE] hover:bg-[#141413] hover:text-[#FAF9F6] border border-[#141413] font-['IBM_Plex_Mono'] text-sm font-bold ${TACTILE_BTN}`}
                      >
                        +
                      </button>
                    </div>
                  </div>

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
                        className={`w-9 h-9 shrink-0 bg-[#F4F3EE] hover:bg-[#141413] hover:text-[#FAF9F6] border border-[#141413] font-['IBM_Plex_Mono'] text-sm font-bold ${TACTILE_BTN}`}
                      >
                        −
                      </button>
                      <input
                        id="ctrl-farnsworth"
                        type="range"
                        min={5}
                        max={settings.wpm}
                        value={settings.farnsworthWpm}
                        aria-valuetext={`${settings.farnsworthWpm} Farnsworth words per minute`}
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
                        className={`w-9 h-9 shrink-0 bg-[#F4F3EE] hover:bg-[#141413] hover:text-[#FAF9F6] border border-[#141413] font-['IBM_Plex_Mono'] text-sm font-bold ${TACTILE_BTN}`}
                      >
                        +
                      </button>
                    </div>
                  </div>

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
                        className={`w-9 h-9 shrink-0 bg-[#F4F3EE] hover:bg-[#141413] hover:text-[#FAF9F6] border border-[#141413] font-['IBM_Plex_Mono'] text-sm font-bold ${TACTILE_BTN}`}
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
                        aria-valuetext={`${settings.freq} Hertz`}
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
                        className={`w-9 h-9 shrink-0 bg-[#F4F3EE] hover:bg-[#141413] hover:text-[#FAF9F6] border border-[#141413] font-['IBM_Plex_Mono'] text-sm font-bold ${TACTILE_BTN}`}
                      >
                        +
                      </button>
                    </div>
                  </div>

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
                      className={`w-full min-h-[40px] px-3 py-1.5 bg-[#141413] hover:bg-[#1D4ED8] text-[#FAF9F6] font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.1em] ${TACTILE_BTN}`}
                    >
                      Test Tone (HI)
                    </button>
                    <button
                      type="button"
                      aria-pressed={settings.muted}
                      onClick={() => {
                        if (!settings.muted) audioEngine.stopAll();
                        setSettings((s) => ({ ...s, muted: !s.muted }));
                      }}
                      className={`w-full min-h-[40px] px-3 py-1.5 border border-[#141413] font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.1em] ${TACTILE_BTN} ${
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

        {audioBlocked && !settings.muted && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-4">
            <div
              role="status"
              aria-live="polite"
              className="bg-[#EAE8E1] border border-[#141413] px-4 py-3 flex flex-wrap items-center justify-between gap-2"
            >
              <span className="font-['IBM_Plex_Mono'] text-xs text-[#141413] font-bold">
                AUDIO NOTICE · BROWSER SUSPENDED AUDIO PLAYBACK — TAP ENABLE SOUND TO UNLOCK SIDETONE
              </span>
              <button
                type="button"
                onClick={() => audioEngine.ensureContext()}
                className={`min-h-[36px] px-3 py-1 bg-[#141413] text-[#FAF9F6] font-['IBM_Plex_Mono'] text-xs font-bold uppercase ${TACTILE_BTN}`}
              >
                Enable Sound
              </button>
            </div>
          </div>
        )}

        {corruptionAlert && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-4">
            <div
              role="status"
              aria-live="polite"
              className="bg-[#B91C1C]/10 border border-[#B91C1C] px-4 py-3 flex flex-wrap items-center justify-between gap-2"
            >
              <span className="font-['IBM_Plex_Mono'] text-xs text-[#B91C1C] font-bold">
                STORAGE NOTICE · CORRUPTED OR INVALID LOCAL LOGBOOK DATA WAS RESET TO DEFAULTS
              </span>
              <button
                type="button"
                onClick={() => setCorruptionAlert(false)}
                className={`font-['IBM_Plex_Mono'] text-xs font-bold uppercase underline text-[#B91C1C] ${TACTILE_BTN}`}
              >
                Acknowledge
              </button>
            </div>
          </div>
        )}

        <main id="main-content" className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
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
          {activeTab === 'manual' && (
            <ManualView onBack={() => selectTab('translate')} />
          )}
          {activeTab === 'terms' && (
            <TermsView onBack={() => selectTab('translate')} />
          )}
          {activeTab === 'privacy' && (
            <PrivacyView onBack={() => selectTab('translate')} />
          )}
        </main>
      </div>

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
              aria-current={activeTab === 'manual' ? 'page' : undefined}
              onClick={() => selectTab('manual')}
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
              aria-current={activeTab === 'terms' ? 'page' : undefined}
              onClick={() => selectTab('terms')}
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
              aria-current={activeTab === 'privacy' ? 'page' : undefined}
              onClick={() => selectTab('privacy')}
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