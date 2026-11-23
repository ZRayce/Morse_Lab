<div align="center">
  <img src="./public/logo.svg" alt="MorseLab Geometric Telegraph Logo" width="88" height="88" />
  <h1>MORSELAB</h1>
  <p><strong>Continuous-Wave (CW) Telegraph Manual, Koch Trainer &amp; Signed Operator Logbook</strong></p>
  <p><code>— · — · &nbsp; — — · — &nbsp;&nbsp; · — · — &nbsp; · — · · &nbsp; · — &nbsp; — · · ·</code></p>

  <p>
    <a href="https://morselab-station.vercel.app">
      <img src="https://img.shields.io/badge/LIVE_STATION-MORSELAB--STATION.VERCEL.APP-1D4ED8?style=flat-square&labelColor=141413" alt="Live MorseLab Station" />
    </a>
    <img src="https://img.shields.io/badge/ITU--R-M.1677--1-141413?style=flat-square&labelColor=EAE8E1" alt="ITU-R M.1677-1 Standard" />
    <img src="https://img.shields.io/badge/TIMING-PARIS_STANDARD-141413?style=flat-square&labelColor=EAE8E1" alt="PARIS Timing Standard" />
    <img src="https://img.shields.io/badge/AUDIO-WEB_AUDIO_API-15803D?style=flat-square&labelColor=141413" alt="Web Audio API" />
    <img src="https://img.shields.io/badge/LOGBOOK-HMAC--SHA256-141413?style=flat-square&labelColor=EAE8E1" alt="HMAC-SHA256 Logbook" />
    <img src="https://img.shields.io/badge/HOSTING-VERCEL_EDGE-141413?style=flat-square&labelColor=EAE8E1" alt="Hosted on Vercel" />
  </p>
</div>

---

## Overview

**MorseLab** is a precision, browser-based Continuous-Wave (CW) Morse code transceiver, spaced-repetition trainer, and cryptographically signed practice logbook modeled after archival Swiss technical manuals and classic Braun test instruments.

Instead of gamified clutter or bloated third-party audio libraries, MorseLab synthesizes pure sine-wave sidetones directly in the browser using the Web Audio API with 5ms exponential gain envelopes—eliminating acoustic clicks while maintaining exact **PARIS** (`1200 / WPM`) and **Farnsworth** timing intervals. Everything runs locally in your browser with zero external tracking, zero ads, and zero backend database dependencies.

---

## Why I Built This

MorseLab started from my personal interest in learning Morse code and wanting a tool that treats telegraphy like a real instrument rather than a casual mobile game.

Most online Morse tools rely on pre-recorded MP3 clips with sluggish timing, cluttered screens, or mandatory cloud accounts. I wanted a distraction-free station built for:

* **Everyday Learners & Hobbyists:** Anyone curious about International Morse code who wants to build real acoustic reflex recognition—rather than slowly counting dots and dashes—through structured Koch-method drills and progressive straight-key stages.
* **Amateur Radio (Ham) & Emergency Communicators:** Operators preparing for CW band contacts, field day operations, or backup off-grid communication drills where clean Farnsworth spacing and straight-key cadence matter.
* **Military & Tactical Signal Trainees:** Service members, cadets, and signal specialists looking for a lightweight, zero-tracking, self-hostable practice terminal for ear copy, optical signal lamp flashing, and distress callsign drills.

> **Educational & Training Notice:** MorseLab is an educational simulation and practice utility-not certified maritime, aviation, or military distress equipment.

---

## Station Preview

<div align="center">

| `01` · Bidirectional Translator | `02` · Koch Operator Training | `03` · Operator Logbook & Matrix |
| :---: | :---: | :---: |
| <img src="./public/shots/Screenshot%202026-11-23%20185852.png" alt="MorseLab Bidirectional Translator" width="275" /> | <img src="./public/shots/Screenshot%202026-11-23%20185902.png" alt="MorseLab Koch Operator Training" width="275" /> | <img src="./public/shots/Screenshot%202026-11-23%20185915.png" alt="MorseLab Operator Logbook and Matrix" width="275" /> |

</div>

---

## Core Capabilities

| Module | Description |
| :--- | :--- |
| **`01` · Bidirectional Translator** | Real-time Plaintext-to-Morse and Morse-to-Plaintext conversion with high-contrast visual signal tape, live keying readout, and 4-second auto-dismissing clipboard confirmation. |
| **`02` · Ear Training & Signal Lamp** | Session-gated 10-character Koch curriculum drills supporting both sidetone audio copy and silent optical carrier flashes, promoting automatically at 85%+ accuracy. |
| **`02` · Manual Straight Key** | 10-stage progressive keying simulator (`E`, `T`, `I`, `A`, `N`, `M`, `S`, `O`, `HI`, `73`) using Spacebar or touch contact with real-time paper-tape decoding. |
| **`02` · Daily Intercepts & SOS** | Simulated HF weather and maritime radio broadcasts alongside a 5-callsign consecutive emergency beacon streak challenge. |
| **`03` · Logbook & Mastery Matrix** | Interactive 36-character (`A–Z`, `0–9`) accuracy matrix with one-tap sidetone auditioning, JSON export, and keyed `HMAC-SHA256` local storage verification. |
| **`AUX` · Audio & Timing Console** | Collapsible transceiver drawer with one-tap skill presets (*Beginner*, *Standard*, *Fast CW*), Character Speed (8–40 WPM), Farnsworth Letter Pause, Sidetone Pitch (400–1000 Hz), and live tone testing. |

---

## Tech Stack & Architecture

MorseLab is engineered as a lightweight, zero-backend client application with optional standalone Node.js hosting:

| Layer | Technology | Role in MorseLab |
| :--- | :--- | :--- |
| **UI & Build Tooling** | **React + Vite** | Component architecture, fast ESM bundling, and optimized static production builds (`dist/`). |
| **Styling & Typography** | **Tailwind CSS + IBM Plex / Newsreader** | High-contrast Swiss archival editorial layout with tactile button states and zero-beat vernier graphics. |
| **DSP Audio Synthesis** | **Web Audio API** | Real-time sine-wave oscillator synthesis with 5ms exponential ramps for click-free sidetones. |
| **Local Persistence & Integrity** | **Web Crypto API (`HMAC-SHA256`) + `localStorage`** | Signs logbook records locally in the browser with schema validation and `event.isTrusted` gesture checks—no remote user database required. |
| **Edge & Server Hosting** | **Vercel (`vercel.json`) + Node.js (`server.js`)** | Deployed live on Vercel with strict security headers and SPA rewrites, plus a zero-dependency Node server for self-hosting. |

---

## Hosting, Local Development & Self-Hosting

<div align="center">

### Live Production Deployment (Vercel)

**MorseLab is hosted live on Vercel at [morselab-station.vercel.app](https://morselab-station.vercel.app)**

[![Launch Live Station](https://img.shields.io/badge/LAUNCH_LIVE_STATION-MORSELAB--STATION.VERCEL.APP-1D4ED8?style=for-the-badge&labelColor=141413)](https://morselab-station.vercel.app)

</div>

* Every push to the `main` branch automatically builds the Vite bundle (`dist/`) and deploys to Vercel's edge network.
* `vercel.json` enforces Content Security Policy (CSP), `X-Frame-Options`, `Referrer-Policy`, and clean Single-Page Application (SPA) routing.

### Run Locally in Development Mode
```bash
git clone [https://github.com/ZRayce/morselab.git](https://github.com/ZRayce/morselab.git)
cd morselab
npm install
npm run dev
```

server.js is a zero-dependency Node.js HTTP server that serves the compiled dist/ bundle with path-traversal protection, security headers, SPA fallback routing, and optional MAINTENANCE_MODE=true support.

<div align="center">

### Author & Operator

**Rayce Manuel E. Fillon**

[![Email](https://img.shields.io/badge/EMAIL-ZERORAYCE%40GMAIL.COM-141413?style=flat-square&labelColor=EAE8E1)](mailto:zerorayce@gmail.com)
[![LinkedIn](https://img.shields.io/badge/LINKEDIN-RAYCEFILLON-1D4ED8?style=flat-square&labelColor=141413)](https://www.linkedin.com/in/raycefillon)
[![GitHub](https://img.shields.io/badge/GITHUB-ZRAYCE%2FMORSELAB-141413?style=flat-square&labelColor=EAE8E1)](https://github.com/ZRayce/morselab)

<br />

<img src="./public/shots/columbina-i'm-going-to-touch-you(dont-mind-the-name).gif" alt="Funny WW2 telegraph operator meme GIF" width="320" />
<br />
<sub><i>Me at 2 AM trying to figure out if that was a Dah or a really long Dit.</i></sub>

</div>
