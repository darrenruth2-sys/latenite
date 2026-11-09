import Link from 'next/link';
const LINKS = [['/settings/profile', 'Profile'], ['/settings/privacy', 'Privacy & safety'], ['/settings/account', 'Account & data']];
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-[1000px] flex-wrap gap-6 px-4 py-6 sm:px-6">
      <nav aria-label="Settings" className="flex w-full flex-row gap-1 overflow-x-auto sm:w-52 sm:flex-col">
        <h1 className="sr-only">Settings</h1>
        {LINKS.map(([h, l]) => <Link key={h} href={h} className="flex min-h-11 shrink-0 items-center border-l-4 border-transparent px-3 font-semibold text-muted hover:border-cyan hover:bg-panel2 hover:text-fg">{l}</Link>)}
      </nav>
      <div className="min-w-0 flex-[1_1_480px]">{children}</div>
    </div>
  );
}
