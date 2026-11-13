import { AppHeader } from '@/components/AppHeader';
import { getMe } from '@/lib/me';
import { Heartbeat } from '@/components/Heartbeat';
import { HelpBot } from '@/components/HelpBot';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { me, counts } = await getMe();
  return (
    <div className="bg-dots min-h-dvh pb-20 md:pb-0">
      <AppHeader me={me} counts={counts} />
      {me && <Heartbeat />}
      {me?.suspended && (
        <p role="alert" className="border-b-2 border-[#FF5A5A] bg-[#2a1020] px-4 py-2 text-center text-sm">Your account is suspended for breaking the community rules. You can still download or delete your data in Settings.</p>
      )}
      <main id="main">{children}</main>
      {me && <HelpBot me={me.username} />}
    </div>
  );
}
