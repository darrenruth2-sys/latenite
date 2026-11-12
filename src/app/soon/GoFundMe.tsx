'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * GoFundMe's official live widget: goal, amount raised and donation count come straight from GoFundMe.
 * We render their widget iframe directly (their embed.js only scans the page on DOMContentLoaded,
 * which has already fired by the time Next.js loads third-party scripts) and honor its resize messages.
 */
export function GoFundMeWidget({ url }: { url: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(500);
  const src = new URL(`${url.replace(/\/+$/, '')}/widget/large`);
  src.searchParams.set('utm_source', 'widget');
  src.searchParams.set('utm_medium', 'referral');
  src.searchParams.set('utm_content', 'signedon.social');

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== 'https://www.gofundme.com' || e.source !== ref.current?.contentWindow) return;
      const d = e.data as { type?: string; offsetHeight?: number } | null;
      if (d?.type === 'gfm-embed-widget-resize' && typeof d.offsetHeight === 'number' && d.offsetHeight > 0 && d.offsetHeight < 2000) {
        setHeight(Math.ceil(d.offsetHeight));
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <div className="bg-white">
      <iframe
        ref={ref}
        src={src.toString()}
        title="SignedOn Social fundraiser on GoFundMe"
        width="100%"
        height={height}
        loading="lazy"
        className="block w-full border-0"
      />
    </div>
  );
}
