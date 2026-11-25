import { Component, useState, useEffect, useRef, useCallback } from 'react';
import {
  MORSE_MAP,
  formatMorseDisplay,
  sanitizeText,
} from '../lib/morseCodec.js';
import { STORAGE_KEY } from '../lib/logbookStorage.js';
import { TACTILE_BTN } from '../lib/uiStyles.js';

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

export function MorseLabLogo({ size = 28 }) {
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

export function CompletionCard({
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
    <div
      role="status"
      aria-live="polite"
      className="bg-[#FAF9F6] border border-[#141413] border-t-4 border-t-[#15803D] p-6 sm:p-8"
    >
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

export function StationBootScreen({ onComplete }) {
  const [progress, setProgress] = useState(0);
  const completedRef = useRef(false);

  const finishBoot = useCallback(() => {
    if (!completedRef.current) {
      completedRef.current = true;
      onComplete();
    }
  }, [onComplete]);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      const progressTimer = window.setTimeout(() => {
        setProgress(100);
      }, 0);
      const quickTimer = window.setTimeout(finishBoot, 150);
      return () => {
        window.clearTimeout(progressTimer);
        window.clearTimeout(quickTimer);
      };
    }

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

export function SystemFaultView({
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
      ? 'An unexpected client-side exception occurred. Your local training logbook remains isolated in browser storage.'
      : 'MorseLab is undergoing scheduled calibration and repository updates. Practice operations will resume shortly.';

  const morseBanner = 'QRT · — — · —  · — ·  —';

  const handleAuditionBeacon = () => {
    if (audioEngine && typeof audioEngine.playSequence === 'function') {
      audioEngine.playSequence('QRT', { wpm: 16, farnsworthWpm: 16, freq: 680 });
    }
  };

  return (
    <div
      role="alert"
      className="min-h-[100dvh] bg-[#F4F3EE] text-[#141413] flex items-center justify-center p-4 sm:p-8"
    >
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
            className={`min-h-[40px] px-3 py-1 bg-[#FAF9F6] hover:bg-[#141413] hover:text-[#FAF9F6] border border-[#141413] font-['IBM_Plex_Mono'] text-[11px] font-bold uppercase tracking-[0.12em] ${TACTILE_BTN}`}
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

export class MorseLabErrorBoundary extends Component {
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