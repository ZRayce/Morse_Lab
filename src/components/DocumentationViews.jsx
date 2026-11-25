import { TACTILE_BTN } from '../lib/uiStyles.js';

function DocumentShell({ sectionTag, title, updatedDate, onBack, children }) {
  return (
    <article className="bg-[#FAF9F6] border border-[#141413] p-6 sm:p-10 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#141413]">
        <div>
          <div className="font-['IBM_Plex_Mono'] text-[11px] font-bold uppercase tracking-[0.14em] text-[#57564F]">
            {sectionTag} · {updatedDate}
          </div>
          <h2 className="font-['Newsreader'] text-2xl sm:text-3xl font-semibold text-[#141413] mt-1">
            {title}
          </h2>
        </div>
        <button
          type="button"
          onClick={onBack}
          className={`min-h-[40px] px-4 py-2 bg-[#F4F3EE] hover:bg-[#141413] hover:text-[#FAF9F6] border border-[#141413] font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] ${TACTILE_BTN}`}
        >
          Return to Station
        </button>
      </div>

      <div className="space-y-6 font-['IBM_Plex_Sans'] text-sm sm:text-[15px] text-[#141413] leading-relaxed">
        {children}
      </div>

      <div className="pt-5 border-t border-[#141413]/20 flex flex-wrap items-center justify-between gap-3">
        <span className="font-['IBM_Plex_Mono'] text-[11px] uppercase tracking-[0.12em] text-[#57564F]">
          MORSELAB ARCHIVAL MANUAL · RAYCE MANUEL E. FILLON
        </span>
        <button
          type="button"
          onClick={onBack}
          className={`min-h-[40px] px-4 py-2 bg-[#141413] hover:bg-[#1D4ED8] text-[#FAF9F6] font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] ${TACTILE_BTN}`}
        >
          Return to Station
        </button>
      </div>
    </article>
  );
}

export function ManualView({ onBack }) {
  return (
    <DocumentShell
      sectionTag="DOCUMENTATION 01 · OPERATOR MANUAL"
      title="Continuous-Wave Telegraphy & Station Manual"
      updatedDate="REVISION NOV 2026"
      onBack={onBack}
    >
      <section className="space-y-2">
        <h3 className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#1D4ED8]">
          01 · BIDIRECTIONAL TRANSLATOR &amp; TAPE SYNTAX
        </h3>
        <p className="text-[#57564F]">
          In <strong className="text-[#141413]">01. Translate</strong>, typing into{' '}
          <strong className="text-[#141413]">Plaintext Message</strong> encodes letters (<code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">A–Z</code>), numerals (<code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">0–9</code>), and standard ITU punctuation into International Morse code in real time. Typing or pasting dots (<code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">.</code>) and dashes (<code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">-</code>) into{' '}
          <strong className="text-[#141413]">International Morse Tape</strong> decodes back to plaintext—separate individual letters with a single space and separate words with a forward slash (<code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">/</code>). Clicking <strong className="text-[#141413]">Copy Morse</strong> copies clean ASCII dots and dashes to your clipboard.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#1D4ED8]">
          02 · PARIS STANDARD TIMING &amp; FARNSWORTH SPACING
        </h3>
        <p className="text-[#57564F]">
          MorseLab computes all audio sidetones and optical lamp intervals from the international{' '}
          <strong className="text-[#141413]">PARIS</strong> standard (50 dot-units per standard word). One basic unit (1 Dit) equals{' '}
          <code className="font-['IBM_Plex_Mono'] bg-[#EAE8E1] px-1.5 py-0.5 text-xs text-[#141413]">
            1200 / WPM
          </code>{' '}
          milliseconds. Open the <strong className="text-[#141413]">Audio</strong> drawer in the top navigation bar to choose a quick preset or adjust Character Speed (8–40 WPM), Letter Pause (Farnsworth Spacing), Sidetone Pitch (400–1000 Hz), or Mute state.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 font-['IBM_Plex_Mono'] text-xs">
          <div className="bg-[#F4F3EE] border border-[#141413]/30 p-3">
            <div className="font-bold text-[#141413]">DIT (·)</div>
            <div className="text-[#57564F] mt-0.5">1 Unit</div>
          </div>
          <div className="bg-[#F4F3EE] border border-[#141413]/30 p-3">
            <div className="font-bold text-[#141413]">DAH (—)</div>
            <div className="text-[#57564F] mt-0.5">3 Units</div>
          </div>
          <div className="bg-[#F4F3EE] border border-[#141413]/30 p-3">
            <div className="font-bold text-[#141413]">LETTER GAP</div>
            <div className="text-[#57564F] mt-0.5">3 Units (Scaled)</div>
          </div>
          <div className="bg-[#F4F3EE] border border-[#141413]/30 p-3">
            <div className="font-bold text-[#141413]">WORD GAP</div>
            <div className="text-[#57564F] mt-0.5">7 Units (Scaled)</div>
          </div>
        </div>
        <p className="text-[#57564F] pt-1">
          Setting <strong className="text-[#141413]">Character Speed</strong> to 18–20 WPM while lowering{' '}
          <strong className="text-[#141413]">Letter Pause</strong> to 10–14 WPM preserves authentic character sound shapes while giving you extra pause time between letters—preventing the habit of counting dots.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#1D4ED8]">
          03 · KOCH CURRICULUM &amp; TRAINING MODES
        </h3>
        <ul className="list-disc pl-5 space-y-1.5 text-[#57564F]">
          <li>
            <strong className="text-[#141413]">Koch Progression:</strong> Training begins with two distinct characters (<code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">K</code> and <code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">M</code>). Scoring 85% or higher across a 10-character drill unlocks the next symbol in the 40-character Koch sequence.
          </li>
          <li>
            <strong className="text-[#141413]">Ear Training &amp; Signal Lamp:</strong> Click <strong>Start Session</strong> when ready, then identify audio sidetones or visual carrier flashes using your physical keyboard (<code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">A–Z</code>, <code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">0–9</code>) or the on-screen character keypad.
          </li>
          <li>
            <strong className="text-[#141413]">Manual Straight Key:</strong> Progress through 10 guided stages—starting with single-element letters (<code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">E</code>, <code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">T</code>, <code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">I</code>, <code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">A</code>)—by tapping for a Dit and holding for a Dah with the Spacebar or touch contact pad.
          </li>
          <li>
            <strong className="text-[#141413]">Daily Intercepts &amp; SOS Survival:</strong> Decode daily simulated HF weather/maritime broadcasts or clear a 5-callsign emergency beacon streak.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#1D4ED8]">
          04 · LOGBOOK MATRIX &amp; LOCAL DATA INTEGRITY
        </h3>
        <p className="text-[#57564F]">
          In <strong className="text-[#141413]">03. Logbook</strong>, tap any tile in the 36-Character Mastery Matrix to audition its sidetone pattern or review accuracy thresholds (<code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">less than 60%</code> Weak, <code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">60–84%</code> Developing, <code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">85%+</code> Mastered). Stored records include a local integrity checksum solely to detect accidental browser storage corruption or truncated writes; because MorseLab has no server backend, local storage is not cryptographically tamper-proof. Switching browser tabs automatically stops active audio transmissions.
        </p>
      </section>
    </DocumentShell>
  );
}

export function TermsView({ onBack }) {
  return (
    <DocumentShell
      sectionTag="DOCUMENTATION 02 · LEGAL"
      title="Terms of Service & Operational Conditions"
      updatedDate="EFFECTIVE NOVEMBER 2026"
      onBack={onBack}
    >
      <section className="space-y-1.5">
        <h3 className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#141413]">
          01 · ACCEPTANCE OF TERMS &amp; ELIGIBILITY
        </h3>
        <p className="text-[#57564F]">
          By accessing or using MorseLab (&ldquo;the Service&rdquo;), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the Service. You represent that you are at least 13 years of age (or the minimum age of digital consent in your jurisdiction) or are using the Service under the supervision of a parent or legal guardian. MorseLab is provided free of charge as an educational Continuous-Wave (CW) telegraphy simulator created and maintained by <strong className="text-[#141413]">Rayce Manuel E. Fillon</strong>.
        </p>
      </section>

      <section className="bg-[#B91C1C]/10 border border-[#B91C1C] p-4 space-y-1.5">
        <h3 className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#B91C1C]">
          02 · LIFE-SAFETY, MARITIME &amp; AVIATION EMERGENCY DISCLAIMER
        </h3>
        <p className="text-[#141413] text-xs sm:text-sm">
          MorseLab is strictly a software-based educational simulator and training utility. It is <strong>NOT</strong> certified radio equipment, maritime distress hardware, aviation avionics, or an emergency signaling device. Never rely on this software for real-world maritime, aviation, wilderness, medical, or life-safety distress communications (<code className="font-['IBM_Plex_Mono']">SOS</code> / <code className="font-['IBM_Plex_Mono']">MAYDAY</code>). Always use type-approved GMDSS, EPIRB, PLB, or licensed emergency transceivers during actual emergencies.
        </p>
      </section>

      <section className="space-y-1.5">
        <h3 className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#141413]">
          03 · NO RADIO FREQUENCY TRANSMISSION OR LICENSING GRANT
        </h3>
        <p className="text-[#57564F]">
          MorseLab generates local audio sidetones and visual display pulses solely within your web browser; it does not transmit electromagnetic radio-frequency (RF) signals. Using MorseLab does not grant amateur or commercial radio operating privileges. If you operate physical radio transmitters, you are solely responsible for obtaining the required government authorization and callsign (such as from the National Telecommunications Commission in the Philippines or the FCC in the United States) and complying with applicable spectrum laws.
        </p>
      </section>

      <section className="space-y-1.5">
        <h3 className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#141413]">
          04 · AUDITORY &amp; PHOTOSENSITIVE SAFETY NOTICE
        </h3>
        <p className="text-[#57564F]">
          Continuous-wave sidetones generate pure sine-wave audio tones between 300 Hz and 1200 Hz. Maintain safe speaker and headphone volume levels to avoid hearing fatigue or discomfort. The Optical Signal Lamp training mode emits high-contrast flashing visual pulses; discontinue use immediately and consult a physician if you experience eye strain, dizziness, or have a history of photosensitive sensitivity.
        </p>
      </section>

      <section className="space-y-1.5">
        <h3 className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#141413]">
          05 · LOCAL DATA INTEGRITY &amp; ACCEPTABLE USE
        </h3>
        <p className="text-[#57564F]">
          Local training records include a client-side checksum and schema validation solely to detect accidental storage corruption or malformed entries. Because all logic runs client-side without a remote authentication server, local logbook records are intended for personal practice tracking rather than certified competitive verification. You agree not to disrupt the Service or use it in any unlawful manner.
        </p>
      </section>

      <section className="space-y-1.5">
        <h3 className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#141413]">
          06 · INTELLECTUAL PROPERTY, THIRD-PARTY LINKS &amp; SERVICE CHANGES
        </h3>
        <p className="text-[#57564F]">
          All original source code, audio synthesis routines, storage validation logic, and archival Swiss interface layouts are © 2026 Rayce Manuel E. Fillon. International Morse Code character mappings follow public ITU-R M.1677-1 standards. The Service may contain links to external sites (such as LinkedIn or GitHub) and relies on third-party static hosting and font delivery networks; the developer is not responsible for the availability, security, or content of external services. The developer reserves the right to modify, suspend, or discontinue the Service at any time without prior notice.
        </p>
      </section>

      <section className="space-y-1.5">
        <h3 className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#141413]">
          07 · DISCLAIMER OF WARRANTIES &amp; LIMITATION OF LIABILITY
        </h3>
        <p className="text-[#57564F]">
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, MORSELAB IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. IN NO EVENT SHALL RAYCE MANUEL E. FILLON BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF DATA (INCLUDING BROWSER LOCAL STORAGE RESETS), ARISING OUT OF YOUR USE OF OR INABILITY TO USE THE SERVICE. BECAUSE THE SERVICE IS PROVIDED FREE OF CHARGE, THE DEVELOPER&apos;S TOTAL AGGREGATE LIABILITY FOR ANY CLAIM SHALL NOT EXCEED PHP 0.00 (USD 0.00).
        </p>
      </section>

      <section className="space-y-1.5">
        <h3 className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#141413]">
          08 · INDEMNIFICATION
        </h3>
        <p className="text-[#57564F]">
          You agree to indemnify, defend, and hold harmless Rayce Manuel E. Fillon from and against any claims, liabilities, damages, losses, and reasonable expenses arising out of your misuse of the Service, your violation of these Terms, or your violation of any applicable telecommunications, safety, or third-party rights.
        </p>
      </section>

      <section className="space-y-1.5">
        <h3 className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#141413]">
          09 · GOVERNING LAW, SEVERABILITY &amp; CONTACT
        </h3>
        <p className="text-[#57564F]">
          These Terms are governed by and construed in accordance with the laws of the <strong className="text-[#141413]">Republic of the Philippines</strong>, without regard to conflict-of-law principles, and any disputes shall be subject to the exclusive jurisdiction of the proper courts of <strong className="text-[#141413]">Cebu City, Philippines</strong> (without prejudice to mandatory consumer protections where applicable). If any provision of these Terms is held unenforceable, the remaining provisions remain in full force. Legal notices or inquiries may be sent to{' '}
          <a href="mailto:zerorayce@gmail.com" className="text-[#1D4ED8] underline">
            zerorayce@gmail.com
          </a>{' '}
          or via{' '}
          <a
            href="https://www.linkedin.com/in/raycefillon"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#1D4ED8] underline"
          >
            linkedin.com/in/raycefillon
          </a>
          .
        </p>
      </section>
    </DocumentShell>
  );
}

export function PrivacyView({ onBack }) {
  return (
    <DocumentShell
      sectionTag="DOCUMENTATION 03 · PRIVACY"
      title="Privacy Policy & Local-First Data Disclosure"
      updatedDate="EFFECTIVE NOVEMBER 2026"
      onBack={onBack}
    >
      <section className="space-y-1.5">
        <h3 className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#141413]">
          01 · OPERATOR IDENTITY &amp; PRIVACY COMMITMENT
        </h3>
        <p className="text-[#57564F]">
          MorseLab is developed and operated by <strong className="text-[#141413]">Rayce Manuel E. Fillon</strong>. In alignment with the principles of transparency, legitimate purpose, and proportionality under the <strong className="text-[#141413]">Philippine Data Privacy Act of 2012 (Republic Act No. 10173)</strong> and international privacy standards, MorseLab is engineered with a zero-backend, local-first architecture: we do not require user accounts, do not collect names, emails, or keystroke logs on developer servers, and never sell, rent, or monetize user data.
        </p>
      </section>

      <section className="space-y-1.5">
        <h3 className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#141413]">
          02 · STRICTLY NECESSARY BROWSER STORAGE (NO TRACKING COOKIES)
        </h3>
        <p className="text-[#57564F]">
          MorseLab does not set advertising cookies, cross-site tracking identifiers, or behavioral analytics scripts. To save your practice progress locally on your own device, the application writes only two strictly functional records to your browser&apos;s <code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">localStorage</code>:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-[#57564F]">
          <li>
            <code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">morselab_logbook_v2</code> — Stores your Koch curriculum level, experience points (XP), daily practice streak, per-character accuracy counts, and a local integrity checksum used to detect accidental storage corruption.
          </li>
          <li>
            <code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">morselab_notice_ack_v2</code> — Stores a simple boolean flag (<code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">1</code>) if you dismiss the footer storage notice.
          </li>
        </ul>
        <p className="text-[#57564F]">
          If you access MorseLab in Private/Incognito browsing or a restricted mobile WebView where <code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">localStorage</code> is blocked, MorseLab automatically operates in temporary in-memory session mode without writing to disk.
        </p>
      </section>

      <section className="space-y-1.5">
        <h3 className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#141413]">
          03 · THIRD-PARTY HOSTING &amp; GOOGLE FONTS NETWORK DISCLOSURE
        </h3>
        <p className="text-[#57564F]">
          While the developer collects zero personal data on proprietary servers, standard web delivery involves two third-party infrastructure connections made directly by your browser:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-[#57564F]">
          <li>
            <strong className="text-[#141413]">Static Web Hosting:</strong> The static HTML, CSS, and JavaScript bundle is delivered via third-party cloud hosting infrastructure, which automatically processes standard HTTP request metadata (such as your IP address, browser User-Agent, and timestamp) strictly to route the application files to your device and maintain network security.
          </li>
          <li>
            <strong className="text-[#141413]">Google Fonts Typography:</strong> When online, your browser connects to Google Fonts (<code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">fonts.googleapis.com</code> and <code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">fonts.gstatic.com</code>) to load the <code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">Newsreader</code>, <code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">IBM Plex Sans</code>, and <code className="font-['IBM_Plex_Mono'] text-xs text-[#141413]">IBM Plex Mono</code> typefaces. As part of standard HTTP delivery, Google receives your IP address and browser headers to serve the font stylesheets.
          </li>
        </ul>
      </section>

      <section className="space-y-1.5">
        <h3 className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#141413]">
          04 · CHILDREN&apos;S PRIVACY
        </h3>
        <p className="text-[#57564F]">
          MorseLab does not knowingly collect, solicit, or store personal information from children under 13 years of age (or under 16 in the European Economic Area). Because all practice progress remains exclusively on the user&apos;s local device, no child&apos;s personal data is transmitted to the developer.
        </p>
      </section>

      <section className="space-y-1.5">
        <h3 className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#141413]">
          05 · DATA SUBJECT RIGHTS, PORTABILITY &amp; PERMANENT ERASURE
        </h3>
        <p className="text-[#57564F]">
          Under RA 10173, GDPR, and similar privacy laws, you retain full control over your local records. Because your logbook resides exclusively inside your browser, you can exercise your rights of access, data portability, and erasure directly at any time: open <strong className="text-[#141413]">03. Logbook</strong> and click <strong className="text-[#141413]">Export JSON</strong> to download a complete copy of your records, or click <strong className="text-[#141413]">Purge Logbook</strong> (or clear your browser site data) to permanently delete all stored entries.
        </p>
      </section>

      <section className="space-y-1.5">
        <h3 className="font-['IBM_Plex_Mono'] text-xs font-bold uppercase tracking-[0.12em] text-[#141413]">
          06 · POLICY UPDATES &amp; PRIVACY CONTACT
        </h3>
        <p className="text-[#57564F]">
          This Privacy Policy may be updated from time to time to reflect technical or regulatory changes, with the revision date shown at the top of this page. For privacy inquiries or security disclosures, contact{' '}
          <strong className="text-[#141413]">Rayce Manuel E. Fillon</strong> at{' '}
          <a href="mailto:zerorayce@gmail.com" className="text-[#1D4ED8] underline">
            zerorayce@gmail.com
          </a>{' '}
          or{' '}
          <a
            href="https://www.linkedin.com/in/raycefillon"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#1D4ED8] underline"
          >
            linkedin.com/in/raycefillon
          </a>
          .
        </p>
      </section>
    </DocumentShell>
  );
}