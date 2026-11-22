<div align="center">
  <img src="./public/logo.svg" alt="MorseLab Geometric Telegraph Logo" width="84" height="84" />
  <h1>MORSELAB</h1>
  <p><strong>Continuous-Wave (CW) Telegraph Manual, Koch Trainer &amp; Signed Operator Logbook</strong></p>

  <p>
    <a href="https://morselab-station.vercel.app">
      <img src="https://img.shields.io/badge/LIVE_STATION-MORSELAB--STATION.VERCEL.APP-1D4ED8?style=flat-square&labelColor=141413" alt="Live MorseLab Station" />
    </a>
    <img src="https://img.shields.io/badge/ITU--R-M.1677--1-141413?style=flat-square&labelColor=EAE8E1" alt="ITU-R M.1677-1 Standard" />
    <img src="https://img.shields.io/badge/TIMING-PARIS_STANDARD-141413?style=flat-square&labelColor=EAE8E1" alt="PARIS Timing Standard" />
    <img src="https://img.shields.io/badge/AUDIO-WEB_AUDIO_API-15803D?style=flat-square&labelColor=141413" alt="Web Audio API" />
    <img src="https://img.shields.io/badge/LOGBOOK-HMAC--SHA256-141413?style=flat-square&labelColor=EAE8E1" alt="HMAC-SHA256 Logbook" />
  </p>
</div>

---

## What is MorseLab?

**MorseLab** is a precision, browser-based Continuous-Wave (CW) Morse code transceiver, spaced-repetition trainer, and cryptographically signed practice logbook modeled after archival Swiss technical manuals and classic Braun test instruments.

Instead of gamified clutter or bloated third-party libraries, MorseLab synthesizes pure sine-wave audio sidetones directly in the browser using the Web Audio API with 5ms exponential gain envelopes, eliminating acoustic clicks while maintaining exact **PARIS** (`1200 / WPM`) and **Farnsworth** timing intervals. Everything runs locally in the browser with zero external tracking or backend dependencies.

---

## Why I Built This

MorseLab started from my personal interest in learning Morse code and wanting a tool that treats telegraphy like a real instrument rather than a casual mobile game.

Most online Morse tools rely on pre-recorded MP3 clips with sluggish timing, cluttered screens, or mandatory cloud accounts. I wanted a distraction-free station that serves:

* **Everyday Learners & Hobbyists:** Anyone curious about International Morse code who wants to build real acoustic reflex recognition—rather than slowly counting dots and dashes through structured Koch-method drills and progressive straight-key stages.
* **Amateur Radio (Ham) & Emergency Communicators:** Operators preparing for CW band contacts, field day operations, or backup off-grid communication drills where clean Farnsworth spacing and straight-key cadence matter.
* **Military & Tactical Signal Trainees:** Service members, cadets, and signal specialists looking for a lightweight, zero-tracking, self-hostable practice terminal for ear copy, optical signal lamp flashing, and distress callsign drills.

> *Educational & Training Notice:* MorseLab is a simulation and practice utility—not certified maritime, aviation, or military distress equipment.

---

## Core Capabilities

| Module | Description |
| :--- | :--- |
| **01. Bidirectional Translator** | Real-time Plaintext-to-Morse and Morse-to-Plaintext conversion with high-contrast visual signal tape, live element highlighting, and 4-second auto-dismissing clipboard copy confirmation. |
| **02. Ear Training & Signal Lamp** | Session-gated 10-character Koch curriculum drills supporting both sidetone audio copy and silent optical carrier flashes, promoting automatically at 85%+ accuracy. |
| **02. Manual Straight Key** | 10-stage progressive keying simulator (`E`, `T`, `I`, `A`, `N`, `M`, `S`, `O`, `HI`, `73`) using Spacebar or touch contact with real-time paper-tape decoding. |
| **02. Daily Intercepts & SOS** | Simulated HF weather and maritime radio broadcasts alongside a 5-callsign consecutive emergency beacon streak challenge. |
| **03. Logbook & Mastery Matrix** | Interactive 36-character (`A–Z`, `0–9`) accuracy matrix with one-tap sidetone auditioning, JSON export, and keyed `HMAC-SHA256` local storage verification. |

---

## Station Preview

| Bidirectional Translator | Koch Operator Training | Operator Logbook & Matrix |
| :---: | :---: | :---: |
| <img src="./Screenshot%202026-11-23%20072751.png" alt="MorseLab Bidirectional Translator" width="260" /> | <img src="./Screenshot%202026-11-23%20072740.png" alt="MorseLab Koch Operator Training" width="260" /> | <img src="./Screenshot%202026-11-23%20072729.png" alt="MorseLab Operator Logbook & Matrix" width="260" /> |

*(Note: If you move those screenshots into a `public/shots/` folder later, update the paths above to `./public/shots/...`.)*

---

## Local Development & Production Server

### Run in Development Mode
```bash
npm install
npm run dev
```
Build & Run Production Server
```Bash
npm run build
npm start
```
server.js serves the compiled dist/ bundle with path-traversal protection, SPA routing, Content Security Policy headers, and optional MAINTENANCE_MODE=true support.

vercel.json mirrors the security headers and SPA fallback configuration for edge hosting on Vercel.

Author
Name: Rayce Manuel E. Fillon

Email: zerorayce@gmail.com

LinkedIn: linkedin.com/in/raycefillon

GitHub: github.com/ZRayce/morselab
