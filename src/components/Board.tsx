"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  getFirstCollision,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type Active,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type Over,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { moveApplication } from "@/app/actions";
import type { ApplicationCard as Card, BoardColumn, Label } from "@/lib/queries";
import { ApplicationCard } from "./ApplicationCard";
import { AddColumnTile, ColumnSettingsButton } from "./BoardColumnTools";
import { FilterBar, NO_FILTERS, isFiltering, matches, type Filters } from "./BoardFilters";
import { StageDot } from "./LabelChip";
import { PanelPreview } from "./panel/PanelPreview";

type Columns = BoardColumn[];
type DropTarget = { columnId: string; index: number };

/** Which column holds this id? (id may be a card id or a column id) */
function findColumnIndex(columns: Columns, id: string) {
  return columns.findIndex((c) => c.id === id || c.cards.some((card) => card.id === id));
}

/**
 * Where would the card land if dropped now?
 * Over a column's empty space → bottom of that column.
 * Over a card → before it, or after it if the dragged card's middle is lower.
 */
function dropTargetFor(columns: Columns, active: Active, over: Over): DropTarget | null {
  const ci = findColumnIndex(columns, String(over.id));
  if (ci < 0) return null;
  const column = columns[ci];
  if (column.id === over.id) return { columnId: column.id, index: column.cards.length };

  const index = column.cards.findIndex((c) => c.id === over.id);
  const dragged = active.rect.current.translated;
  const below = dragged ? dragged.top + dragged.height / 2 > over.rect.top + over.rect.height / 2 : false;
  return { columnId: column.id, index: index + (below ? 1 : 0) };
}

// ---------------------------------------------------------------------------
// Collapsed columns: remembered in this browser (localStorage). Read through
// useSyncExternalStore so server and first client render agree (no flicker or
// hydration mismatch), then the saved state applies.
// ---------------------------------------------------------------------------
const COLLAPSED_KEY = "k8.collapsedColumns";
const collapsedListeners = new Set<() => void>();
function readCollapsed(): string {
  try {
    return localStorage.getItem(COLLAPSED_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}
function subscribeCollapsed(cb: () => void) {
  collapsedListeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    collapsedListeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
function toggleCollapsed(id: string) {
  const ids = new Set<string>(JSON.parse(readCollapsed()));
  if (ids.has(id)) ids.delete(id);
  else ids.add(id);
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...ids]));
  } catch {
    /* storage blocked: the toggle just won't persist */
  }
  collapsedListeners.forEach((cb) => cb());
}

/**
 * How the board drags:
 * - Inside one column, cards slide out of the way (sortable animation).
 * - Across columns, NOTHING moves until you drop: the target column is
 *   highlighted and a line shows where the card will land. Moving cards
 *   between columns mid-drag shifts the layout, and dnd-kit's measurements
 *   lag one frame behind, which made the card bounce between two columns
 *   forever ("Maximum update depth exceeded").
 *
 * Performance:
 * - Column and card components are memoised: a change re-renders only the
 *   columns/cards whose data actually changed, not all of them.
 * - The hover spotlight is pure CSS written into one <style> tag, so hovering
 *   never re-renders React at all.
 */
export function Board({
  columns: serverColumns,
  selectedId,
  labels,
  companies,
}: {
  columns: Columns;
  selectedId?: string;
  labels: Label[];
  companies: string[];
}) {
  // Local copy so cards move instantly while the server saves (optimistic UI).
  // When the server sends fresh data (after refresh()), adopt it.
  const [columns, setColumns] = useState(serverColumns);
  const [prevServerColumns, setPrevServerColumns] = useState(serverColumns);
  if (serverColumns !== prevServerColumns) {
    setPrevServerColumns(serverColumns);
    setColumns(serverColumns);
  }

  // --- Search & filters: the board shows `view`, a filtered copy -----------
  // All drag logic works on `view` (what you see); the final move is applied
  // to the full `columns`, placed between the VISIBLE neighbours.
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const filtering = isFiltering(filters);
  const view = useMemo(
    () => (filtering ? columns.map((c) => ({ ...c, cards: c.cards.filter((card) => matches(card, filters)) })) : columns),
    [columns, filters, filtering],
  );
  const total = columns.reduce((n, c) => n + c.cards.length, 0);
  const shown = view.reduce((n, c) => n + c.cards.length, 0);

  // --- Collapsed columns ----------------------------------------------------
  const collapsedJson = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => "[]");
  const collapsed = useMemo(() => new Set<string>(JSON.parse(collapsedJson)), [collapsedJson]);

  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null); // only for OTHER columns
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const lastDragEnd = useRef(0);

  // --- Instant panel: show a preview the moment a card is clicked ----------
  const [opening, setOpening] = useState<Card | null>(null);
  if (opening && opening.id === selectedId) setOpening(null); // real panel arrived
  const onOpen = useCallback((card: Card) => setOpening(card), []);
  const dismissPreview = useCallback(() => setOpening(null), []);

  // --- Hover spotlight, without React re-renders ----------------------------
  const spotlight = useRef<HTMLStyleElement>(null);
  const spotlitId = useRef<string | null>(null);
  const onSpotlight = useCallback((candidateId: string | null) => {
    spotlitId.current = candidateId;
    if (!spotlight.current) return;
    spotlight.current.textContent = candidateId
      ? `[data-engineer]:not([data-engineer="${candidateId}"]){opacity:.32;filter:saturate(.4)}`
      : "";
  }, []);

  // A card that disappears (filtered out, column collapsed) never gets a
  // "pointer left" event, so the spotlight would stay stuck on. Clear it when
  // the spotlit engineer's card unmounts.
  const onCardUnmount = useCallback(
    (candidateId: string) => {
      if (spotlitId.current === candidateId) onSpotlight(null);
    },
    [onSpotlight],
  );

  // Column names for the "move cards to…" choice when removing a column.
  // Recomputed only when a column is added, removed or renamed.
  const columnsKey = columns.map((c) => `${c.id}:${c.name}`).join("|");
  const columnList = useMemo(
    () => columns.map((c) => ({ id: c.id, name: c.name })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on names/ids on purpose
    [columnsKey],
  );

  // Which droppable is the card "over"?
  // 1. What the POINTER is inside wins. (The old "closest corners" rule let a
  //    nearby card in another column beat a big empty column.)
  // 2. If that's a column with cards, use the nearest card inside it.
  // Keyboard drags have no pointer, so they fall back to rectangle overlap.
  const collisionDetection: CollisionDetection = useCallback(
    (args) => {
      const pointerHits = pointerWithin(args);
      const hits = pointerHits.length > 0 ? pointerHits : rectIntersection(args);
      const overId = getFirstCollision(hits, "id");
      if (overId == null) return [];

      const column = view.find((c) => c.id === overId);
      if (column && column.cards.length > 0 && !collapsed.has(column.id)) {
        const cardIds = new Set(column.cards.map((c) => c.id));
        const nearest = closestCenter({
          ...args,
          droppableContainers: args.droppableContainers.filter((d) => cardIds.has(String(d.id))),
        });
        if (nearest.length > 0) return nearest;
      }
      return [{ id: overId }];
    },
    [view, collapsed],
  );

  const sensors = useSensors(
    // Must move 6px before a drag starts, so a plain click still opens the card
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Keyboard: focus a card, Space to pick up, arrows to move, Space to drop
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  );

  function onDragStart({ active }: DragStartEvent) {
    onSpotlight(null);
    const ci = findColumnIndex(view, String(active.id));
    setActiveCard(view[ci]?.cards.find((c) => c.id === active.id) ?? null);
    setError(null);
  }

  function onDragOver({ active, over }: DragOverEvent) {
    const fromColumn = view[findColumnIndex(view, String(active.id))];
    const target = over ? dropTargetFor(view, active, over) : null;
    const next = target && target.columnId !== fromColumn?.id ? target : null;
    // Only update when it actually changed, so re-renders stay minimal
    setDropTarget((prev) => (prev?.columnId === next?.columnId && prev?.index === next?.index ? prev : next));
  }

  function resetDrag() {
    lastDragEnd.current = Date.now();
    setActiveCard(null);
    setDropTarget(null);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    resetDrag();
    if (!over) return;

    const activeId = String(active.id);
    const from = findColumnIndex(view, activeId);
    const target = dropTargetFor(view, active, over);
    if (from < 0 || !target) return;
    const to = view.findIndex((c) => c.id === target.columnId);
    const fromIndex = view[from].cards.findIndex((c) => c.id === activeId);
    const card = view[from].cards[fromIndex];

    // 1. The new order of the VISIBLE cards in the target column
    let visible: Card[];
    if (from === to) {
      // Same column: the sortable preview already shows the new order
      const overIndex = view[to].cards.findIndex((c) => c.id === over.id);
      if (overIndex < 0 || overIndex === fromIndex) return; // nothing changed
      visible = arrayMove(view[to].cards, fromIndex, overIndex);
    } else {
      visible = [...view[to].cards];
      visible.splice(target.index, 0, card);
    }
    const index = visible.findIndex((c) => c.id === activeId);
    const prevId = visible[index - 1]?.id ?? null;
    const nextId = visible[index + 1]?.id ?? null;

    // 2. Apply to the FULL board: put the card right before its visible
    //    "next" neighbour (or after "prev", or at the end). Hidden cards keep
    //    their places. Only the two affected columns get new objects.
    const stageId = view[to].id;
    const moved = { ...card, stageId };
    setColumns((prev) =>
      prev.map((c) => {
        const isSource = c.id === view[from].id;
        const isTarget = c.id === stageId;
        if (!isSource && !isTarget) return c;
        const cards = c.cards.filter((x) => x.id !== activeId);
        if (!isTarget) return { ...c, cards };
        const at = nextId ? cards.findIndex((x) => x.id === nextId) : prevId ? cards.findIndex((x) => x.id === prevId) + 1 : cards.length;
        cards.splice(at < 0 ? cards.length : at, 0, moved);
        return { ...c, cards };
      }),
    );

    // Tell the server: "put this card between these two neighbours"
    startTransition(async () => {
      const result = await moveApplication({ applicationId: activeId, stageId, prevId, nextId });
      if (!result.ok) setError("Couldn't save that move. The board was reset.");
    });
  }

  return (
    <>
      <style ref={spotlight} />
      <FilterBar filters={filters} onChange={setFilters} labels={labels} companies={companies} shown={shown} total={total} />
      {error && (
        <p role="alert" className="mx-4 mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:mx-6 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </p>
      )}
      <DndContext
        id="pipeline-board" // stable id avoids server/client hydration mismatch
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={resetDrag}
      >
        {/* `relative` matters: absolutely positioned children (e.g. screen-reader
            text) are only clipped by a scroll container that is positioned.
            Without it they escaped and stretched the whole page sideways.
            --col-w: one place to change the column width. */}
        <div
          className="relative flex flex-1 gap-2 overflow-x-auto px-4 pb-6 [--col-w:10.5rem] sm:px-6"
          onPointerLeave={() => onSpotlight(null)}
        >
          {view.map((column, i) => (
            <Column
              key={column.id}
              column={column}
              totalCount={filtering ? columns[i].cards.length : null}
              isFirst={i === 0}
              isLast={i === view.length - 1}
              collapsed={collapsed.has(column.id)}
              columnList={columnList}
              lastDragEnd={lastDragEnd}
              // pass the selection only to the column that holds it, so the
              // others don't re-render when you open a different card
              selectedId={column.cards.some((c) => c.id === selectedId) ? selectedId : undefined}
              dropIndex={dropTarget?.columnId === column.id ? dropTarget.index : null}
              onSpotlight={onSpotlight}
              onCardUnmount={onCardUnmount}
              onOpen={onOpen}
            />
          ))}
          <AddColumnTile />
        </div>
        <DragOverlay>
          {activeCard && (
            <div className="w-[10.5rem] rotate-2 cursor-grabbing">
              <ApplicationCard card={activeCard} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {opening && opening.id !== selectedId && <PanelPreview card={opening} onDismiss={dismissPreview} />}
    </>
  );
}

const Column = memo(function Column({
  column,
  totalCount,
  isFirst,
  isLast,
  collapsed,
  columnList,
  lastDragEnd,
  selectedId,
  dropIndex,
  onSpotlight,
  onCardUnmount,
  onOpen,
}: {
  column: BoardColumn;
  /** While filtering: how many cards the column has in total (else null) */
  totalCount: number | null;
  isFirst: boolean;
  isLast: boolean;
  collapsed: boolean;
  columnList: { id: string; name: string }[];
  lastDragEnd: React.RefObject<number>;
  selectedId?: string;
  /** Where a card from another column would land (null = not targeted) */
  dropIndex: number | null;
  onSpotlight: (candidateId: string | null) => void;
  onCardUnmount: (candidateId: string) => void;
  onOpen: (card: Card) => void;
}) {
  // The column itself is a drop target, so empty columns accept cards too
  const { setNodeRef } = useDroppable({ id: column.id });
  const targeted = dropIndex !== null;
  const otherColumns = useMemo(() => columnList.filter((c) => c.id !== column.id), [columnList, column.id]);
  const itemIds = useMemo(() => column.cards.map((c) => c.id), [column.cards]);
  const count = totalCount === null ? `${column.cards.length}` : `${column.cards.length}/${totalCount}`;
  const settings = (
    <ColumnSettingsButton
      column={{ id: column.id, name: column.name, color: column.color, isFinal: column.isFinal, cardCount: totalCount ?? column.cards.length }}
      otherColumns={otherColumns}
      isFirst={isFirst}
      isLast={isLast}
      collapsed={collapsed}
      onToggleCollapse={() => toggleCollapsed(column.id)}
    />
  );

  // Collapsed: a slim strip that still accepts dropped cards (they go to the bottom)
  if (collapsed) {
    return (
      <section
        ref={setNodeRef}
        aria-label={`${column.name}, ${count} cards, collapsed`}
        className={`group/col glass relative flex w-10 shrink-0 flex-col items-center gap-2 rounded-2xl py-2 ${targeted ? "ring-2 ring-white/90 !bg-white/30" : ""}`}
      >
        <button
          type="button"
          onClick={() => toggleCollapsed(column.id)}
          title={`Expand ${column.name}`}
          aria-label={`Expand ${column.name}`}
          className="flex flex-1 flex-col items-center gap-2 text-white"
        >
          <StageDot color={column.color} />
          <span className="rounded-full bg-white/25 px-1.5 text-[11px] font-semibold ring-1 ring-white/30">{count}</span>
          <span className="text-[13px] font-semibold [text-shadow:0_1px_2px_rgb(0_32_64/0.35)] [writing-mode:vertical-rl]">{column.name}</span>
        </button>
        <span className="absolute bottom-1">{settings}</span>
      </section>
    );
  }

  return (
    <section
      aria-label={`${column.name}, ${count} cards`}
      className={`group/col glass flex w-[var(--col-w)] shrink-0 flex-col rounded-2xl p-1.5 ${
        targeted ? "ring-2 ring-white/90 !bg-white/30 dark:!bg-white/15" : column.isFinal ? "opacity-90" : ""
      }`}
    >
      <header className="relative flex items-start gap-1.5 px-1.5 py-1">
        <span className="mt-[3px] flex"><StageDot color={column.color} /></span>
        {/* names wrap to a second line instead of being cut off */}
        <h2 className="min-w-0 flex-1 text-[13px] leading-tight font-semibold break-words text-white [text-shadow:0_1px_2px_rgb(0_32_64/0.35)]">
          {column.name}
        </h2>
        <span className="rounded-full bg-white/25 px-1.5 text-[11px] font-semibold text-white ring-1 ring-white/30">
          {count}
        </span>
        {/* "⋯" sits over the count and only shows on hover / keyboard focus */}
        <span className="absolute top-0.5 right-1">
          {settings}
        </span>
      </header>

      <SortableContext id={column.id} items={itemIds} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex min-h-24 flex-1 flex-col gap-1.5 p-0.5">
          {column.cards.map((card, i) => (
            <SortableCard
              key={card.id}
              card={card}
              lastDragEnd={lastDragEnd}
              selected={card.id === selectedId}
              // Drop line drawn with a shadow, so it never changes the layout
              dropLine={dropIndex === i ? "before" : dropIndex === column.cards.length && i === column.cards.length - 1 ? "after" : null}
              onSpotlight={onSpotlight}
              onUnmount={onCardUnmount}
              onOpen={onOpen}
            />
          ))}
          {column.cards.length === 0 && (
            <p
              className={`rounded-lg border border-dashed p-3 text-center text-xs ${
                targeted ? "border-white text-white" : "border-white/40 text-white/70"
              }`}
            >
              Drop here
            </p>
          )}
        </div>
      </SortableContext>
    </section>
  );
});

const SortableCard = memo(function SortableCard({
  card,
  lastDragEnd,
  selected,
  dropLine,
  onSpotlight,
  onUnmount,
  onOpen,
}: {
  card: Card;
  lastDragEnd: React.RefObject<number>;
  selected: boolean;
  dropLine: "before" | "after" | null;
  onSpotlight: (candidateId: string | null) => void;
  onUnmount: (candidateId: string) => void;
  onOpen: (card: Card) => void;
}) {
  const candidateId = card.candidate.id;
  useEffect(() => () => onUnmount(candidateId), [candidateId, onUnmount]);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });

  return (
    <div
      ref={setNodeRef}
      data-engineer={card.candidate.id} // used by the CSS-only hover spotlight
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`touch-manipulation rounded-xl transition-opacity duration-150 ${isDragging ? "opacity-40" : ""} ${
        dropLine === "before"
          ? "shadow-[0_-5px_0_-2px_rgb(255_255_255)]"
          : dropLine === "after"
            ? "shadow-[0_5px_0_-2px_rgb(255_255_255)]"
            : ""
      }`}
      onPointerEnter={(e) => e.pointerType === "mouse" && onSpotlight(card.candidate.id)}
      onPointerLeave={() => onSpotlight(null)}
      {...attributes}
      {...listeners}
      // A drop can end with a click on the card; don't treat that as "open"
      onClickCapture={(e) => {
        if (Date.now() - lastDragEnd.current < 250) e.preventDefault();
      }}
    >
      <ApplicationCard card={card} selected={selected} onOpen={onOpen} />
    </div>
  );
});
