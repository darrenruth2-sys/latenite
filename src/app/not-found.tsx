import Link from 'next/link';
import { Logo } from '@/components/Logo';
export default function NotFound() {
  return (
    <main id="main" className="bg-dots flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo />
      <p className="pixel text-3xl text-pink">404 · PAGE NOT FOUND</p>
      <h1 className="font-display text-4xl font-extrabold">This page went offline.</h1>
      <Link href="/" className="btn-cyan">Go home</Link>
    </main>
  );
}
