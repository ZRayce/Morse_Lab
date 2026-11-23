# Changelog

All notable updates to **MorseLab** are documented here.

## [1.0.0] - 2026-11-23

### Added
* **Core Transceiver & Training Suite:** Bidirectional Plaintext-to-Morse translator, Koch curriculum drills (Ear Training & Optical Signal Lamp), 10-stage Manual Straight Key simulator, Daily HF Intercepts, and 5-callsign SOS Survival streaks.
* **Click-Free Web Audio DSP Engine:** Real-time sine-wave sidetones with 5ms exponential gain ramps, PARIS (`1200 / WPM`) timing, and Farnsworth letter spacing.
* **Audio Drawer Presets & Step Controls:** One-tap skill presets (*Beginner*, *Standard*, *Fast CW*), `−`/`+` fine-adjustment step buttons, plain-language parameter descriptions, and a live **Test Tone (HI)** button.
* **Signed Local Logbook & Matrix:** Interactive 36-character (`A–Z`, `0–9`) mastery matrix with one-tap sidetone auditioning, JSON export, and `HMAC-SHA256` local storage verification.
* **Production Deployment & Docs:** Vercel edge configuration (`vercel.json`), standalone Node.js production server (`server.js`), Operator Manual, Terms of Service, and Privacy Policy.

### Changed
* **Streamlined Calibration Boot Screen:** Removed bottom footer buttons on `StationBootScreen` so the startup card terminates cleanly below the `WELCOME` paper-tape tiles.
* **Tactile UI & Field Clarity:** Added high-contrast bordered highlight tags for textbox labels and refined button press feedback across desktop and touch devices.
