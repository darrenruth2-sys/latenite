import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-20 text-center">
      <p className="pixel text-3xl text-pink">404 · PAGE NOT FOUND</p>
      <h1 className="font-display text-4xl font-extrabold">Nobody lives here.</h1>
      <p className="text-muted">That username doesn&apos;t exist, or the page isn&apos;t available to you.</p>
      <Link href="/discover" className="btn-cyan">Find people</Link>
    </div>
  );
}
