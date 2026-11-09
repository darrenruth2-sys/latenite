'use client';
import { useFormStatus } from 'react-dom';

export function Submit({ children, className = 'btn-pink w-full', pendingText = 'Hang on…' }: { children: React.ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={className} aria-busy={pending}>{pending ? pendingText : children}</button>;
}

export function FormMessage({ error, ok }: { error?: string; ok?: string }) {
  if (error) return <p role="alert" className="border-2 border-[#FF5A5A] bg-[#2a1020] px-3 py-2 text-sm text-[#FFB3B3]">{error}</p>;
  if (ok) return <p role="status" className="border-2 border-lime bg-[#0f2a18] px-3 py-2 text-sm text-lime">{ok}</p>;
  return null;
}
