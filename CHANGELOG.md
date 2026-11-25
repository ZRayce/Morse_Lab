# Changelog

All notable updates to **MorseLab** are documented here.

## [1.0.1] - 2026-11-26

### Added
- **Modular Core & UI Architecture:** Split the monolithic application into dedicated modules under `src/lib/` (`morseCodec.js`, `timing.js`, `audioEngine.js`, `logbookStorage.js`, `uiStyles.js`) and `src/components/` (`StationChrome.jsx`, `DocumentationViews.jsx`).
- **Automated Vitest Suite:** Added 17 unit and integration tests (`src/__tests__/morselab.test.js`) covering ITU Morse codec round-trips, PARIS/Farnsworth timing ratios, Koch promotion rules, schema validation, legacy record migration, and corruption recovery.
- **Explicit Drill Start Controls:** Added a pre-session **Start Session** readiness screen to Ear Training and Optical Signal Lamp drills so audio and visual prompts begin only when the user is ready.

### Changed
- **Honest Local Integrity Checksum:** Replaced hardcoded HMAC secrets with a Web Crypto `SHA-256` local corruption-detection checksum (with `FNV-64` fallback), automatic read-only migration for existing `1.0.0` logbooks, and updated documentation disclosures.
- **Web Audio Node Cleanup & Edge Hardening:** Disconnected finished `OscillatorNode` and `GainNode` graphs via `onended` handlers, added explicit keyboard `focus-visible` rings across interactive controls, and hardened `vercel.json`, `server.js`, and `index.html` security and cache headers.

## [1.0.0] - 2026-11-23

### Added
- **Core Transceiver & Training Suite:** Bidirectional Plaintext-to-Morse translator, Koch curriculum drills (Ear Training & Optical Signal Lamp), 10-stage Manual Straight Key simulator, Daily HF Intercepts, and 5-callsign SOS Survival streaks.
- **Click-Free Web Audio DSP Engine:** Real-time sine-wave sidetones with 5ms exponential gain ramps, PARIS (`1200 / WPM`) timing, and Farnsworth letter spacing.
- **Audio Drawer Presets & Step Controls:** One-tap skill presets (*Beginner*, *Standard*, *Fast CW*), `−`/`+` fine-adjustment step buttons, plain-language parameter descriptions, and a live **Test Tone (HI)** button.
- **Signed Local Logbook & Matrix:** Interactive 36-character (`A–Z`, `0–9`) mastery matrix with one-tap sidetone auditioning, JSON export, and `HMAC-SHA256` local storage verification.
- **Production Deployment & Docs:** Vercel edge configuration (`vercel.json`), standalone Node.js production server (`server.js`), Operator Manual, Terms of Service, and Privacy Policy.

### Changed
- **Streamlined Calibration Boot Screen:** Removed bottom footer buttons on `StationBootScreen` so the startup card terminates cleanly below the `WELCOME` paper-tape tiles.
- **Tactile UI & Field Clarity:** Added high-contrast bordered highlight tags for textbox labels and refined button press feedback across desktop and touch devices.