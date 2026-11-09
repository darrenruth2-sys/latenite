import { Logo } from '@/components/Logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-dots flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center px-4 py-5 sm:px-6"><Logo cursor /></header>
      <main id="main" className="flex flex-1 items-start justify-center px-4 pb-16 pt-4 sm:pt-10">
        <div className="panel-hard w-full max-w-md p-6 sm:p-8">{children}</div>
      </main>
    </div>
  );
}
