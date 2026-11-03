"use client";

import { useCallback, useRef, useState, useTransition } from "react";
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
import type { ApplicationCard as Card, BoardColumn } from "@/lib/queries";
import { ApplicationCard } from "./ApplicationCard";
import { StageDot } from "./LabelChip";

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

/**
 * How the board drags:
 * - Inside one column, cards slide out of the way (sortable animation).
 * - Across columns, NOTHING moves until you drop: the target column is
 *   highlighted and a line shows where the card will land. Moving cards
 *   between columns mid-drag shifts the layout, and dnd-kit's measurements
 *   lag one frame behind, which made the card bounce between two columns
 *   forever ("Maximum update depth exceeded").
 */
export function Board({ columns: serverColumns, selectedId }: { columns: Columns; selectedId?: string }) {
  // Local copy so cards move instantly while the server saves (optimistic UI).
  // When the server sends fresh data (after refresh()), adopt it.
  const [columns, setColumns] = useState(serverColumns);
  const [prevServerColumns, setPrevServerColumns] = useState(serverColumns);
  if (serverColumns !== prevServerColumns) {
    setPrevServerColumns(serverColumns);
    setColumns(serverColumns);
  }

  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null); // only for OTHER columns
  // Hovering a card spotlights that engineer: their cards stay, others fade
  const [focusId, setFocusId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const lastDragEnd = useRef(0);

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

      const column = columns.find((c) => c.id === overId);
      if (column && column.cards.length > 0) {
        const cardIds = new Set(column.cards.map((c) => c.id));
        const nearest = closestCenter({
          ...args,
          droppableContainers: args.droppableContainers.filter((d) => cardIds.has(String(d.id))),
        });
        if (nearest.length > 0) return nearest;
      }
      return [{ id: overId }];
    },
    [columns],
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
    setFocusId(null);
    const ci = findColumnIndex(columns, String(active.id));
    setActiveCard(columns[ci]?.cards.find((c) => c.id === active.id) ?? null);
    setError(null);
  }

  function onDragOver({ active, over }: DragOverEvent) {
    const fromColumn = columns[findColumnIndex(columns, String(active.id))];
    const target = over ? dropTargetFor(columns, active, over) : null;
    const next = target && target.columnId !== fromColumn?.id ? target : null;
    // Only update when it actually changed, so re-renders stay minimal
    setDropTarget((prev) =>
      prev?.columnId === next?.columnId && prev?.index === next?.index ? prev : next,
    );
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
    const from = findColumnIndex(columns, activeId);
    const target = dropTargetFor(columns, active, over);
    if (from < 0 || !target) return;
    const to = columns.findIndex((c) => c.id === target.columnId);
    const fromIndex = columns[from].cards.findIndex((c) => c.id === activeId);

    let next: Columns;
    if (from === to) {
      // Same column: the sortable preview already shows the new order
      const overIndex = columns[to].cards.findIndex((c) => c.id === over.id);
      if (overIndex < 0 || overIndex === fromIndex) return; // nothing changed
      next = columns.map((c, i) => (i === to ? { ...c, cards: arrayMove(c.cards, fromIndex, overIndex) } : c));
    } else {
      // Other column: take it out, put it in at the drop line
      next = columns.map((c) => ({ ...c, cards: [...c.cards] }));
      const [card] = next[from].cards.splice(fromIndex, 1);
      next[to].cards.splice(target.index, 0, { ...card, stageId: next[to].id });
    }
    setColumns(next);

    const cards = next[to].cards;
    const index = cards.findIndex((c) => c.id === activeId);
    // Tell the server: "put this card between these two neighbours"
    startTransition(async () => {
      const result = await moveApplication({
        applicationId: activeId,
        stageId: next[to].id,
        prevId: cards[index - 1]?.id ?? null,
        nextId: cards[index + 1]?.id ?? null,
      });
      if (!result.ok) setError("Couldn't save that move. The board was reset.");
    });
  }

  return (
    <>
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
            Without it they escaped and stretched the whole page sideways. */}
        <div className="relative flex flex-1 gap-3 overflow-x-auto px-4 pb-6 sm:px-6">
          {columns.map((column) => (
            <Column
              key={column.id}
              column={column}
              lastDragEnd={lastDragEnd}
              selectedId={selectedId}
              dropIndex={dropTarget?.columnId === column.id ? dropTarget.index : null}
              focusId={activeCard ? null : focusId}
              onFocusEngineer={setFocusId}
            />
          ))}
        </div>
        <DragOverlay>
          {activeCard && (
            <div className="rotate-2 cursor-grabbing">
              <ApplicationCard card={activeCard} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </>
  );
}

function Column({
  column,
  lastDragEnd,
  selectedId,
  dropIndex,
  focusId,
  onFocusEngineer,
}: {
  column: BoardColumn;
  lastDragEnd: React.RefObject<number>;
  selectedId?: string;
  /** Where a card from another column would land (null = not targeted) */
  dropIndex: number | null;
  focusId: string | null;
  onFocusEngineer: (candidateId: string | null) => void;
}) {
  // The column itself is a drop target, so empty columns accept cards too
  const { setNodeRef } = useDroppable({ id: column.id });
  const targeted = dropIndex !== null;

  return (
    <section
      aria-label={`${column.name}, ${column.cards.length} cards`}
      className={`glass flex w-[17.5rem] shrink-0 flex-col rounded-2xl p-2 transition ${
        targeted ? "ring-2 ring-sky-400/70 !bg-sky-100/60 dark:!bg-sky-900/30" : column.isFinal ? "opacity-90" : ""
      }`}
    >
      <header className="flex items-center gap-2 px-2 py-1.5">
        <StageDot color={column.color} />
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{column.name}</h2>
        <span className="ml-auto rounded-full bg-white/70 px-2 text-xs font-semibold text-slate-600 shadow-sm dark:bg-slate-800/80 dark:text-slate-300">
          {column.cards.length}
        </span>
      </header>

      <SortableContext id={column.id} items={column.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex min-h-24 flex-1 flex-col gap-2 p-1">
          {column.cards.map((card, i) => (
            <SortableCard
              key={card.id}
              card={card}
              lastDragEnd={lastDragEnd}
              selected={card.id === selectedId}
              // Drop line drawn with a shadow, so it never changes the layout
              dropLine={dropIndex === i ? "before" : dropIndex === column.cards.length && i === column.cards.length - 1 ? "after" : null}
              dimmed={focusId !== null && card.candidate.id !== focusId}
              onFocusEngineer={onFocusEngineer}
            />
          ))}
          {column.cards.length === 0 && (
            <p
              className={`rounded-lg border border-dashed p-3 text-center text-xs ${
                targeted ? "border-sky-400 text-sky-600 dark:text-sky-300" : "border-slate-300/80 text-slate-400 dark:border-slate-700"
              }`}
            >
              Drop here
            </p>
          )}
        </div>
      </SortableContext>
    </section>
  );
}

function SortableCard({
  card,
  lastDragEnd,
  selected,
  dropLine,
  dimmed,
  onFocusEngineer,
}: {
  card: Card;
  lastDragEnd: React.RefObject<number>;
  selected: boolean;
  dropLine: "before" | "after" | null;
  /** Another engineer is spotlighted */
  dimmed: boolean;
  onFocusEngineer: (candidateId: string | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`touch-manipulation rounded-xl transition-[opacity,filter] duration-200 ${isDragging ? "opacity-40" : dimmed ? "opacity-35 saturate-50" : ""} ${
        dropLine === "before"
          ? "shadow-[0_-6px_0_-2px_rgb(14_165_233)]"
          : dropLine === "after"
            ? "shadow-[0_6px_0_-2px_rgb(14_165_233)]"
            : ""
      }`}
      onPointerEnter={(e) => e.pointerType === "mouse" && onFocusEngineer(card.candidate.id)}
      onPointerLeave={() => onFocusEngineer(null)}
      {...attributes}
      {...listeners}
      // A drop can end with a click on the card; don't treat that as "open"
      onClickCapture={(e) => {
        if (Date.now() - lastDragEnd.current < 250) e.preventDefault();
      }}
    >
      <ApplicationCard card={card} selected={selected} />
    </div>
  );
}
