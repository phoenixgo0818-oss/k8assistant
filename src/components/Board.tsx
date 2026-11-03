"use client";

import { useRef, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
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

/** Which column holds this id? (id may be a card id or a column id) */
function findColumnIndex(columns: Columns, id: string) {
  return columns.findIndex((c) => c.id === id || c.cards.some((card) => card.id === id));
}

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
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const dragOrigin = useRef<{ columnId: string; index: number } | null>(null);
  const lastDragEnd = useRef(0);

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
    const ci = findColumnIndex(columns, String(active.id));
    const index = columns[ci].cards.findIndex((c) => c.id === active.id);
    dragOrigin.current = { columnId: columns[ci].id, index };
    setActiveCard(columns[ci].cards[index]);
    setError(null);
  }

  // While dragging over ANOTHER column, move the card there so the gap shows
  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const from = findColumnIndex(columns, String(active.id));
    const to = findColumnIndex(columns, String(over.id));
    if (from < 0 || to < 0 || from === to) return;

    setColumns((prev) => {
      const next = prev.map((c) => ({ ...c, cards: [...c.cards] }));
      const fromCards = next[from].cards;
      const card = fromCards.splice(fromCards.findIndex((c) => c.id === active.id), 1)[0];
      const overIndex = next[to].cards.findIndex((c) => c.id === over.id);
      const insertAt = overIndex >= 0 ? overIndex : next[to].cards.length; // over the column itself → bottom
      next[to].cards.splice(insertAt, 0, { ...card, stageId: next[to].id });
      return next;
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    lastDragEnd.current = Date.now();
    setActiveCard(null);
    const origin = dragOrigin.current;
    dragOrigin.current = null;
    if (!over || !origin) {
      setColumns(serverColumns); // dropped outside: undo
      return;
    }

    // Final reorder inside the column the card is now in
    const ci = findColumnIndex(columns, String(active.id));
    let cards = columns[ci].cards;
    const oldIndex = cards.findIndex((c) => c.id === active.id);
    const overIndex = cards.findIndex((c) => c.id === over.id);
    if (overIndex >= 0 && overIndex !== oldIndex) cards = arrayMove(cards, oldIndex, overIndex);
    const finalColumns = columns.map((c, i) => (i === ci ? { ...c, cards } : c));
    setColumns(finalColumns);

    const index = cards.findIndex((c) => c.id === active.id);
    const stageId = finalColumns[ci].id;
    if (stageId === origin.columnId && index === origin.index) return; // nothing changed

    // Tell the server: "put this card between these two neighbours"
    startTransition(async () => {
      const result = await moveApplication({
        applicationId: String(active.id),
        stageId,
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
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActiveCard(null);
          setColumns(serverColumns);
        }}
      >
        <div className="flex flex-1 gap-3 overflow-x-auto px-4 pb-6 sm:px-6">
          {columns.map((column) => (
            <Column key={column.id} column={column} lastDragEnd={lastDragEnd} selectedId={selectedId} />
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
}: {
  column: BoardColumn;
  lastDragEnd: React.RefObject<number>;
  selectedId?: string;
}) {
  // The column itself is a drop target, so empty columns accept cards too
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <section
      aria-label={`${column.name}, ${column.cards.length} cards`}
      className={`flex w-72 shrink-0 flex-col rounded-xl p-2 transition-colors ${
        isOver ? "bg-indigo-50 dark:bg-indigo-950/40" : column.isFinal ? "bg-zinc-100/60 dark:bg-zinc-900/40" : "bg-zinc-100 dark:bg-zinc-900/70"
      }`}
    >
      <header className="flex items-center gap-2 px-2 py-1.5">
        <StageDot color={column.color} />
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{column.name}</h2>
        <span className="ml-auto rounded-full bg-zinc-200 px-2 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          {column.cards.length}
        </span>
      </header>

      <SortableContext id={column.id} items={column.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex min-h-24 flex-1 flex-col gap-2 p-1">
          {column.cards.map((card) => (
            <SortableCard key={card.id} card={card} lastDragEnd={lastDragEnd} selected={card.id === selectedId} />
          ))}
          {column.cards.length === 0 && (
            <p className="rounded-lg border border-dashed border-zinc-300 p-3 text-center text-xs text-zinc-500 dark:border-zinc-700">
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
}: {
  card: Card;
  lastDragEnd: React.RefObject<number>;
  selected: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`touch-manipulation ${isDragging ? "opacity-40" : ""}`}
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
