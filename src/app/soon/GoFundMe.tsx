'use client';
import Script from 'next/script';

/** GoFundMe's official live widget (goal + amount raised come straight from GoFundMe, so they're always accurate). */
export function GoFundMeWidget({ url }: { url: string }) {
  return (
    <div className="min-h-[200px] bg-white">
      <div className="gfm-embed" data-url={`${url.replace(/\/+$/, '')}/widget/large`} />
      <Script src="https://www.gofundme.com/static/js/embed.js" strategy="afterInteractive" />
    </div>
  );
}
