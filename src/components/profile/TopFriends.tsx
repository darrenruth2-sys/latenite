'use client';
import Link from 'next/link';
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { colorFor, initials } from '@/lib/utils';

export type TopFriend = { rank: number | null; id: string; username: string; display_name: string; avatar_url: string | null; online?: boolean };

function Tile({ f, rank, editable, onRemove }: { f: TopFriend; rank: number | null; editable: boolean; onRemove?: () => void }) {
  const s = useSortable({ id: f.id, disabled: !editable });
  const style = { transform: CSS.Transform.toString(s.transform), transition: s.transition, zIndex: s.isDragging ? 10 : undefined };
  const face = (
    <span className="relative block aspect-square overflow-hidden border-2 border-[var(--text)] rounded-[var(--radius)]">
      {f.avatar_url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={f.avatar_url} alt="" className="h-full w-full object-cover" draggable={false} />
        : <span className="flex h-full w-full items-center justify-center font-display text-[clamp(18px,3vw,30px)] font-extrabold text-ink" style={{ background: colorFor(f.id) }}>{initials(f.display_name)}</span>}
      {f.online && <span className="absolute bottom-1.5 right-1.5 h-3 w-3 rounded-full border-2 border-ink bg-lime" title="Online" />}
    </span>
  );
  return (
    <li ref={s.setNodeRef} style={style} className={`relative flex flex-col gap-1.5 transition-transform ${editable ? '' : 'hover:-translate-y-1 hover:-rotate-1'} ${s.isDragging ? 'opacity-80' : ''}`}>
      {editable ? (
        <button type="button" {...s.attributes} {...s.listeners} aria-label={`${f.display_name}, rank ${rank}. Press space to pick up, arrows to move.`}
          className="cursor-grab touch-none text-left active:cursor-grabbing">{face}</button>
      ) : (
        <Link href={`/u/${f.username}`} aria-label={`${f.display_name}'s page`}>{face}</Link>
      )}
      {rank != null && <span className="pointer-events-none absolute -left-1.5 -top-1.5 bg-[var(--text)] px-1.5 font-pixel text-xl leading-tight text-[var(--card)]">#{rank}</span>}
      {editable && onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Remove ${f.display_name} from Top Friends`}
          className="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center border-2 border-[var(--text)] bg-[var(--card)] text-sm font-bold">×</button>
      )}
      <Link href={`/u/${f.username}`} className="truncate text-sm font-semibold">{f.display_name}</Link>
    </li>
  );
}

export function TopFriendsGrid({ list, count, hidden, editable, onChange, pool, ownerName }:
  { list: TopFriend[]; count: number; hidden: boolean; editable: boolean; onChange?: (l: TopFriend[]) => void; pool?: TopFriend[]; ownerName: string }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const shown = list.slice(0, count);
  const showRanks = editable || !hidden;
  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id || !onChange) return;
    const from = list.findIndex((f) => f.id === e.active.id), to = list.findIndex((f) => f.id === e.over!.id);
    onChange(arrayMove(list, from, to));
  }
  const available = (pool || []).filter((p) => !list.some((l) => l.id === p.id));
  return (
    <section aria-labelledby="top-h" className="flex flex-col gap-4 border-2 border-[var(--text)] bg-[var(--card)] p-5 rounded-[var(--radius)] sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="top-h" className="text-3xl font-extrabold" style={{ fontFamily: 'var(--head)' }}>{ownerName}&apos;s Top {count}</h2>
        <span className="text-[13px] text-[var(--muted)]">{editable ? 'Drag to re-rank' : hidden ? 'In no particular order' : ''}</span>
      </div>
      {shown.length === 0 ? (
        <p className="text-[var(--muted)]">{editable ? 'Pick your favorite people below.' : 'No Top Friends picked yet.'}</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={shown.map((f) => f.id)} strategy={rectSortingStrategy}>
            <ol className="grid grid-cols-4 gap-3 sm:gap-3.5" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(22%, 112px), 1fr))` }}>
              {shown.map((f, i) => <Tile key={f.id} f={f} rank={showRanks ? i + 1 : null} editable={editable} onRemove={onChange ? () => onChange(list.filter((x) => x.id !== f.id)) : undefined} />)}
            </ol>
          </SortableContext>
        </DndContext>
      )}
      {editable && onChange && (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="add-top" className="text-sm font-semibold">Add to Top {count}:</label>
          <select id="add-top" className="min-h-10 border-2 border-[var(--text)] bg-[var(--card)] px-2 text-[var(--text)]" value=""
            disabled={shown.length >= count || available.length === 0}
            onChange={(e) => { const f = available.find((p) => p.id === e.target.value); if (f) onChange([...list.slice(0, count), f]); }}>
            <option value="">{available.length === 0 ? 'No more friends to add' : shown.length >= count ? `Top ${count} is full` : 'Choose a friend…'}</option>
            {available.map((p) => <option key={p.id} value={p.id}>{p.display_name} (@{p.username})</option>)}
          </select>
        </div>
      )}
    </section>
  );
}
