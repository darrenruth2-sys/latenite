'use client';
import { useEffect, useState } from 'react';

// "Signing on…" screen, shown once per visit (not again until the tab is closed). Tap or press any key to skip.
// Skipped for people who prefer reduced motion, and for automated browsers.
export const SPLASH_SCRIPT = `try{var d=document.documentElement;if(sessionStorage.getItem('so_on')||navigator.webdriver||matchMedia('(prefers-reduced-motion: reduce)').matches){d.classList.add('so-nosplash')}else{sessionStorage.setItem('so_on','1')}}catch(e){document.documentElement.classList.add('so-nosplash')}`;

const STEPS = ['Dialing…', 'Connecting…', 'Signed On!'];

function Phone() {
  return <svg viewBox="0 0 64 64" aria-hidden="true" className="h-12 w-12"><path d="M18 10h10l4 12-6 4c3 7 8 12 14 15l4-6 12 4v10c0 3-3 5-6 5C27 54 10 37 10 16c0-3 3-6 8-6Z" fill="#FF2D95" stroke="#120B24" strokeWidth="3" strokeLinejoin="round" /></svg>;
}
function Waves() {
  return <svg viewBox="0 0 64 64" aria-hidden="true" className="h-12 w-12" fill="none" stroke="#38E1FF" strokeWidth="5" strokeLinecap="round"><path d="M14 32h4M24 22v20M34 14v36M44 24v16M54 30v4" /></svg>;
}
function Buddy() {
  // the "friends + chat bubble" mark from the SignedOn logo, bouncing in when you're signed on
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className="h-12 w-12 so-run">
      <path d="M6 8h26a5 5 0 0 1 5 5v11a5 5 0 0 1-5 5H17l-7 6v-6H6a5 5 0 0 1-5-5V13a5 5 0 0 1 5-5Z" fill="#B04CFF" stroke="#120B24" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="11" cy="18.5" r="2.6" fill="#fff" /><circle cx="19" cy="18.5" r="2.6" fill="#fff" /><circle cx="27" cy="18.5" r="2.6" fill="#fff" />
      <circle cx="48" cy="22" r="7" fill="#fff" stroke="#120B24" strokeWidth="3" />
      <path d="M35 48a13 13 0 0 1 26 0v4H35Z" fill="#fff" stroke="#120B24" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="36" cy="36" r="6" fill="#FF2D95" stroke="#120B24" strokeWidth="3" />
      <path d="M24 60a12 12 0 0 1 24 0Z" fill="#FF2D95" stroke="#120B24" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}

export function SignOnSplash() {
  const [step, setStep] = useState(0);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (document.documentElement.classList.contains('so-nosplash')) { setGone(true); return; }
    const t = [setTimeout(() => setStep(1), 520), setTimeout(() => setStep(2), 1040), setTimeout(() => setStep(3), 1500), setTimeout(() => setGone(true), 1900)];
    const skip = () => setGone(true);
    window.addEventListener('keydown', skip, { once: true });
    return () => { t.forEach(clearTimeout); window.removeEventListener('keydown', skip); };
  }, []);
  if (gone) return null;
  const icons = [<Phone key="p" />, <Waves key="w" />, <Buddy key="b" />];
  return (
    <div id="so-splash" role="status" aria-label="Signing on to SignedOn" onClick={() => setGone(true)}
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-[#07040F]/95 p-4 transition-opacity duration-300 ${step >= 3 ? 'opacity-0' : 'opacity-100'}`}>
      <div className="w-full max-w-[420px] border-2 border-[#ECE8FF] bg-[#DCD6F2] text-[#120B24] shadow-[8px_8px_0_#FF2D95]">
        <div className="flex items-center justify-between bg-[#120B24] px-2 py-1 text-xs font-bold text-[#ECE8FF]"><span>Sign On</span><span aria-hidden="true">_ □ ×</span></div>
        <div className="flex flex-col items-center gap-4 p-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/signedon-logo.png" alt="SignedOn" className="h-auto w-[220px]" />
          <div className="grid w-full grid-cols-3 gap-3">
            {icons.map((icon, i) => (
              <div key={i} className={`flex aspect-[4/3] items-center justify-center border-[3px] border-[#120B24] transition-colors duration-200 ${step >= i ? 'bg-[#B9B3F0]' : 'bg-[#ECE8FF]'}`}>
                <span className={step >= i ? 'opacity-100' : 'opacity-0'}>{icon}</span>
              </div>
            ))}
          </div>
          <p className="pixel text-2xl leading-none" aria-live="polite">{STEPS[Math.min(step, 2)]}</p>
          <div className="h-1 w-full bg-[#120B24]/20"><div className="h-1 bg-[#FF2D95] transition-[width] duration-500" style={{ width: `${Math.min(100, (step + 1) * 34)}%` }} /></div>
          <span className="text-xs text-[#4D4566]">Tap to skip</span>
        </div>
      </div>
    </div>
  );
}
