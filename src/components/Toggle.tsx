'use client';
export function Toggle({ checked, onChange, label, help, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; help?: React.ReactNode; disabled?: boolean }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 py-1">
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span aria-hidden="true" className={`mt-0.5 flex h-6 w-11 shrink-0 items-center border-2 px-0.5 transition-colors peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-cyan ${checked ? 'border-lime bg-lime/20' : 'border-line bg-ink'}`}>
        <span className={`h-4 w-4 transition-transform ${checked ? 'translate-x-5 bg-lime' : 'bg-dim'}`} />
      </span>
      <span className="flex flex-col gap-0.5"><span className="font-semibold">{label}</span>{help && <span className="text-sm leading-snug text-dim">{help}</span>}</span>
    </label>
  );
}
