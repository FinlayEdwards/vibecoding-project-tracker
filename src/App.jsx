import { useState, useEffect, useRef } from 'react';

/**
 * Vibecoding Project Tracker.
 *
 * Data model follows PRD §6; visual tokens follow DESIGN.md / tailwind.config.js.
 *
 * Build sequence (Phase 3):
 *   - M4  data-model    : four columns + seeded tickets.            ✓
 *   - M5  crud-modal    : "+" / edit-on-click / delete modal.        ✓
 *   - M6  tag-style     : bug vs. safe change (icon + label + colour).
 *   - M7  task-owner    : assignee badge + "Hand off to..." dropdown.
 *   - M8  due-tint      : urgency states from the due date.
 *   - M9  context       : Markdown AI context field on the modal.
 *   - M10 copy-prompt   : "Copy as Prompt Context" handoff block.
 *   - M11 anchors       : the Deliverable Anchor Board above the Kanban.
 *   - M12 secret-sauce  : drag-and-drop with column ordering.
 *
 * Search the file for `TODO M<n>` to find the right hook for each milestone.
 */

/**
 * @typedef {Object} Task
 * @property {string} id                 Immutable, human-readable, never reused, e.g. 'TASK-001'
 * @property {string} title
 * @property {string} description
 * @property {'bug'|'safe_change'} type
 * @property {'todo'|'in-progress'|'review'|'done'} status
 * @property {string|null} assignedUserId
 * @property {string|null} assignedTeamId
 * @property {string|null} dueDate       ISO 'YYYY-MM-DD'
 * @property {string} aiContext          Markdown
 * @property {string|null} aiToolId      Current / most recent tool
 * @property {string|null} deliverableId
 * @property {number} position           Order within its column
 * @property {string} createdBy          User id
 * @property {string} createdAt          ISO timestamp
 * @property {string} updatedAt          ISO timestamp
 * @property {string|null} completedAt   ISO timestamp
 */

// The four columns of the board, in render order.
// Use these IDs everywhere — do not invent new ones.
export const STAGES = [
  { id: 'todo',        label: 'To Do' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'review',      label: 'Review' },
  { id: 'done',        label: 'Done' },
];

export const TASK_TYPES = [
  { id: 'bug',         label: 'Bug' },
  { id: 'safe_change', label: 'Safe change' },
];

// Demo reference data (PRD §5: seed sample users, roles, teams and AI tools).
export const ROLES = [
  { id: 'role-lead', name: 'Lead developer' },
  { id: 'role-dev',  name: 'Developer' },
  { id: 'role-ux',   name: 'UX designer' },
];

export const USERS = [
  { id: 'u-finlay', name: 'Finlay Edwards', email: 'finlay@example.com', githubUsername: 'FinlayEdwards', roleId: 'role-lead' },
  { id: 'u-sam',    name: 'Sam Rivera',     email: 'sam@example.com',    githubUsername: 'samrivera',     roleId: 'role-dev' },
  { id: 'u-priya',  name: 'Priya Shah',     email: 'priya@example.com',  githubUsername: 'priyashah',     roleId: 'role-ux' },
];

export const TEAMS = [
  { id: 'team-frontend', name: 'Frontend', memberIds: ['u-finlay', 'u-sam'] },
  { id: 'team-design',   name: 'Design',   memberIds: ['u-priya'] },
];

export const AI_TOOLS = [
  { id: 'tool-claude',  name: 'Claude' },
  { id: 'tool-chatgpt', name: 'ChatGPT' },
  { id: 'tool-copilot', name: 'Copilot' },
  { id: 'tool-cursor',  name: 'Cursor' },
  { id: 'tool-lovable', name: 'Lovable' },
  { id: 'tool-bolt',    name: 'Bolt' },
];

const findById = (list, id) => list.find((item) => item.id === id) ?? null;

/** 'YYYY-MM-DD' for today + `days`, so seeded due dates stay relative to the demo date. */
function isoDateFromToday(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Formats a counter as a ticket ID, e.g. 7 → 'TASK-007'. */
export function formatTaskId(n) {
  return `TASK-${String(n).padStart(3, '0')}`;
}

function seedTasks() {
  const now = new Date().toISOString();
  const base = { createdBy: 'u-finlay', createdAt: now, updatedAt: now, completedAt: null, deliverableId: null };
  return [
    {
      ...base,
      id: formatTaskId(1),
      title: 'Render the four-column Kanban board',
      description: 'Columns from STAGES with tickets grouped by status.',
      type: 'safe_change',
      status: 'done',
      assignedUserId: 'u-finlay',
      assignedTeamId: 'team-frontend',
      dueDate: isoDateFromToday(-1),
      aiContext: 'Built with Claude from the M4 brief. Uses `STAGES` for column order.',
      aiToolId: 'tool-claude',
      position: 0,
      completedAt: now,
    },
    {
      ...base,
      id: formatTaskId(2),
      title: 'Fix tickets losing their order after reload',
      description: 'Position is not persisted when a ticket changes column.',
      type: 'bug',
      status: 'review',
      assignedUserId: 'u-sam',
      assignedTeamId: null,
      dueDate: isoDateFromToday(0),
      aiContext: 'Cursor suggested sorting by `position` before rendering each column.',
      aiToolId: 'tool-cursor',
      position: 0,
    },
    {
      ...base,
      id: formatTaskId(3),
      title: 'Build the add / edit ticket modal',
      description: 'Accessible dialog with every ticket field.',
      type: 'safe_change',
      status: 'in-progress',
      assignedUserId: 'u-finlay',
      assignedTeamId: 'team-frontend',
      dueDate: isoDateFromToday(2),
      aiContext: 'Needs focus trap, Esc to close, and focus returned to the opening card.',
      aiToolId: 'tool-claude',
      position: 0,
    },
    {
      ...base,
      id: formatTaskId(4),
      title: 'Check urgency colours with a colour-blindness simulator',
      description: 'Verify every due state is distinguishable without colour.',
      type: 'safe_change',
      status: 'todo',
      assignedUserId: null,
      assignedTeamId: 'team-design',
      dueDate: isoDateFromToday(7),
      aiContext: '',
      aiToolId: null,
      position: 0,
    },
  ];
}

/**
 * A tiny localStorage hook — survives reloads, no library needed.
 *
 * Usage:
 *   const [tasks, setTasks] = useLocalStorage('vibetracker.tasks', []);
 */
export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw != null) return JSON.parse(raw);
    } catch {
      /* fall through to the initial value */
    }
    return typeof initialValue === 'function' ? initialValue() : initialValue;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* quota or private-mode error — silently ignore for hackathon */
    }
  }, [key, value]);

  return [value, setValue];
}

/** Who a ticket is assigned to, as display text: user, team, both, or nobody. */
function assigneeLabel(task) {
  const user = findById(USERS, task.assignedUserId);
  const team = findById(TEAMS, task.assignedTeamId);
  if (user && team) return `${user.name} · ${team.name}`;
  if (user) return user.name;
  if (team) return `${team.name} team`;
  return 'Unassigned';
}

/** A blank ticket for the "new" modal; the ID is assigned on save. */
function emptyDraft() {
  return {
    title: '',
    description: '',
    type: 'safe_change',
    status: 'todo',
    assignedUserId: null,
    assignedTeamId: null,
    dueDate: null,
    aiContext: '',
    aiToolId: null,
    deliverableId: null,
  };
}

/** Next free position at the bottom of a column. */
function nextPosition(tasks, status) {
  const positions = tasks.filter((t) => t.status === status).map((t) => t.position);
  return positions.length ? Math.max(...positions) + 1 : 0;
}

const inputClass =
  'mt-1 block min-h-target w-full rounded-md border border-surface-border bg-surface-card px-3 py-2 text-base text-text-primary';

const buttonPrimary =
  'min-h-target rounded-md bg-brand-primary px-4 py-2 font-semibold text-white hover:bg-brand-accent';
const buttonSecondary =
  'min-h-target rounded-md border border-surface-border bg-surface-card px-4 py-2 font-semibold text-text-primary hover:border-brand-accent hover:text-brand-accent';
const buttonDanger =
  'min-h-target rounded-md border border-due-overdue bg-surface-card px-4 py-2 font-semibold text-due-overdue hover:bg-due-overdue-tint';

function Field({ id, label, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className="block font-semibold">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-text-muted">
          {hint}
        </p>
      )}
      {children}
    </div>
  );
}

/** Select whose empty option maps to null. */
function OptionalSelect({ id, value, onChange, options, emptyLabel }) {
  return (
    <select
      id={id}
      className={inputClass}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">{emptyLabel}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  );
}

/**
 * Add / edit ticket modal. Uses the native <dialog> so the browser provides
 * Esc-to-close, focus containment and an inert background (DESIGN.md §4).
 */
function TaskModal({ task, onSave, onDelete, onClose }) {
  const dialogRef = useRef(null);
  const titleRef = useRef(null);
  const isNew = !task.id;
  const [draft, setDraft] = useState(task);
  const [titleError, setTitleError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    // Guard: React StrictMode runs effects twice in development.
    if (!dialogRef.current.open) dialogRef.current.showModal();
    titleRef.current.focus();
  }, []);

  const set = (field) => (value) => setDraft((d) => ({ ...d, [field]: value }));

  function handleSubmit(e) {
    e.preventDefault();
    const title = draft.title.trim();
    if (!title) {
      setTitleError('Enter a title for this ticket.');
      titleRef.current.focus();
      return;
    }
    onSave({ ...draft, title, description: draft.description.trim() });
  }

  const heading = isNew ? 'New ticket' : `Edit ${task.id}`;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="task-modal-heading"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="w-[calc(100%-2rem)] max-w-[640px] rounded-lg bg-surface-card p-0 text-text-primary"
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 p-6">
        <h2 id="task-modal-heading" className="text-xl font-bold">
          {heading}
        </h2>

        <Field id="task-title" label="Title (required)">
          <input
            id="task-title"
            ref={titleRef}
            className={inputClass}
            value={draft.title}
            onChange={(e) => {
              set('title')(e.target.value);
              if (titleError) setTitleError('');
            }}
            aria-invalid={titleError ? 'true' : undefined}
            aria-describedby={titleError ? 'task-title-error' : undefined}
          />
          {titleError && (
            <p id="task-title-error" className="mt-1 font-semibold text-due-overdue">
              <span aria-hidden="true">⚠ </span>
              {titleError}
            </p>
          )}
        </Field>

        <Field id="task-description" label="Description">
          <textarea
            id="task-description"
            rows={3}
            className={inputClass}
            value={draft.description}
            onChange={(e) => set('description')(e.target.value)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="task-type" label="Type">
            <select
              id="task-type"
              className={inputClass}
              value={draft.type}
              onChange={(e) => set('type')(e.target.value)}
            >
              {TASK_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>

          <Field id="task-status" label="Status">
            <select
              id="task-status"
              className={inputClass}
              value={draft.status}
              onChange={(e) => set('status')(e.target.value)}
            >
              {STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>

          <Field id="task-user" label="Assigned person">
            <OptionalSelect
              id="task-user"
              value={draft.assignedUserId}
              onChange={set('assignedUserId')}
              options={USERS}
              emptyLabel="Nobody"
            />
          </Field>

          <Field id="task-team" label="Assigned team">
            <OptionalSelect
              id="task-team"
              value={draft.assignedTeamId}
              onChange={set('assignedTeamId')}
              options={TEAMS}
              emptyLabel="No team"
            />
          </Field>

          <Field id="task-due" label="Due date">
            <input
              id="task-due"
              type="date"
              className={inputClass}
              value={draft.dueDate ?? ''}
              onChange={(e) => set('dueDate')(e.target.value || null)}
            />
          </Field>

          <Field id="task-tool" label="AI tool used">
            <OptionalSelect
              id="task-tool"
              value={draft.aiToolId}
              onChange={set('aiToolId')}
              options={AI_TOOLS}
              emptyLabel="None yet"
            />
          </Field>
        </div>

        {/* TODO M9 context: render the Markdown preview alongside this field. */}
        <Field id="task-context" label="AI context" hint="Markdown. Paste the prompt, decisions and anything the next AI session needs.">
          <textarea
            id="task-context"
            rows={5}
            className={`${inputClass} font-mono`}
            value={draft.aiContext}
            onChange={(e) => set('aiContext')(e.target.value)}
            aria-describedby="task-context-hint"
          />
        </Field>

        {/* TODO M11 anchors: deliverable select once deliverables exist. */}

        {confirmingDelete ? (
          <div
            role="alert"
            className="rounded-md border border-due-overdue bg-due-overdue-tint p-4"
          >
            <p className="font-semibold">
              Delete {task.id}? This can't be undone, and the ID won't be reused.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button type="button" className={buttonDanger} onClick={() => onDelete(task.id)}>
                Yes, delete {task.id}
              </button>
              <button type="button" className={buttonSecondary} onClick={() => setConfirmingDelete(false)}>
                Keep ticket
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-border pt-4">
            {isNew ? (
              <span />
            ) : (
              <button type="button" className={buttonDanger} onClick={() => setConfirmingDelete(true)}>
                Delete
              </button>
            )}
            <div className="flex flex-wrap gap-3">
              <button type="button" className={buttonSecondary} onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className={buttonPrimary}>
                {isNew ? 'Create ticket' : 'Save changes'}
              </button>
            </div>
          </div>
        )}
      </form>
    </dialog>
  );
}

function TaskCard({ task, onOpen }) {
  const assignee = assigneeLabel(task);
  return (
    <article
      aria-labelledby={`${task.id}-title`}
      className="relative rounded-md border border-surface-border bg-surface-card p-4 hover:border-brand-accent focus-within:border-brand-primary"
    >
      <p className="font-mono text-sm text-text-muted">{task.id}</p>
      <h3 id={`${task.id}-title`} className="mt-1 text-base font-semibold leading-snug">
        {/* The ::after overlay makes the whole card the click target while keeping one tab stop. */}
        <button
          type="button"
          onClick={(e) => onOpen(task, e.currentTarget)}
          aria-label={`Edit ${task.id}: ${task.title}`}
          className="text-left after:absolute after:inset-0 after:rounded-md focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-[3px] focus-visible:after:outline-offset-2 focus-visible:after:outline-brand-primary"
        >
          {task.title}
        </button>
      </h3>
      {/* TODO M6 tag-style: type stripe + icon + label. */}
      {/* TODO M8 due-tint: urgency badge from dueDate. */}
      <p className="mt-3 text-sm text-text-muted">
        <span className="sr-only">Assigned to </span>
        {assignee}
      </p>
    </article>
  );
}

function Column({ stage, tasks, onOpenTask }) {
  const headingId = `column-${stage.id}`;
  return (
    <section
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col rounded-lg border border-surface-border bg-surface-page p-3"
    >
      <h2 id={headingId} className="flex items-baseline justify-between px-1 text-lg font-bold">
        {stage.label}
        <span className="text-sm font-normal text-text-muted">
          {tasks.length}
          <span className="sr-only"> {tasks.length === 1 ? 'ticket' : 'tickets'}</span>
        </span>
      </h2>
      {tasks.length === 0 ? (
        <p className="mt-3 rounded-md border-2 border-dashed border-surface-border p-4 text-sm text-text-muted">
          No tickets in {stage.label} yet.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {tasks.map((task) => (
            <li key={task.id}>
              <TaskCard task={task} onOpen={onOpenTask} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function App() {
  const [tasks, setTasks] = useLocalStorage('vibetracker.tasks', seedTasks);
  // Monotonic counter for the next ticket ID — never decremented, so deleted IDs are never reused (PRD §6).
  const [nextTaskNumber, setNextTaskNumber] = useLocalStorage('vibetracker.nextTaskNumber', 5);

  // The ticket open in the modal (a blank draft when creating), or null when closed.
  const [editing, setEditing] = useState(null);
  // Element to return focus to when the modal closes (DESIGN.md §4).
  const returnFocusRef = useRef(null);
  const newButtonRef = useRef(null);

  // Status message shown as a toast and announced by screen readers (WCAG 4.1.3).
  const [toast, setToast] = useState('');
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  function openModal(task, trigger) {
    returnFocusRef.current = trigger;
    setEditing(task);
  }

  function closeModal() {
    setEditing(null);
    // Wait for the dialog to unmount; fall back to "+ New ticket" if the card was deleted.
    requestAnimationFrame(() => {
      const target = returnFocusRef.current?.isConnected ? returnFocusRef.current : newButtonRef.current;
      target?.focus();
    });
  }

  function saveTask(draft) {
    const now = new Date().toISOString();
    if (!draft.id) {
      const id = formatTaskId(nextTaskNumber);
      setNextTaskNumber(nextTaskNumber + 1);
      setTasks([
        ...tasks,
        {
          ...draft,
          id,
          position: nextPosition(tasks, draft.status),
          createdBy: USERS[0].id,
          createdAt: now,
          updatedAt: now,
          completedAt: draft.status === 'done' ? now : null,
        },
      ]);
      setToast(`${id} created.`);
    } else {
      setTasks(
        tasks.map((t) => {
          if (t.id !== draft.id) return t;
          const movedColumn = t.status !== draft.status;
          return {
            ...draft,
            position: movedColumn ? nextPosition(tasks, draft.status) : t.position,
            updatedAt: now,
            completedAt: draft.status === 'done' ? t.completedAt ?? now : null,
          };
        }),
      );
      setToast(`${draft.id} saved.`);
    }
    closeModal();
  }

  function deleteTask(id) {
    setTasks(tasks.filter((t) => t.id !== id));
    setToast(`${id} deleted.`);
    closeModal();
  }

  // TODO M11 anchors:
  //   const [anchors, setAnchors] = useLocalStorage('vibetracker.anchors', [...]);

  return (
    <div className="min-h-screen p-4 sm:p-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] font-bold text-brand-primary">
            Vibecoding Project Tracker
          </h1>
          <p className="text-sm text-text-muted">
            Track vibecoding tickets and the AI context behind them.
          </p>
        </div>
        <button
          ref={newButtonRef}
          type="button"
          className={buttonPrimary}
          onClick={(e) => openModal(emptyDraft(), e.currentTarget)}
          aria-label="Create new ticket"
        >
          <span aria-hidden="true">+ </span>New ticket
        </button>
      </header>

      {/* TODO M11 anchors: render the Anchor Board (Presentation / Demo / Report / Documentation) above the board. */}

      <main aria-label="Board">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {STAGES.map((stage) => (
            <Column
              key={stage.id}
              stage={stage}
              tasks={tasks
                .filter((task) => task.status === stage.id)
                .sort((a, b) => a.position - b.position)}
              onOpenTask={openModal}
            />
          ))}
        </div>
      </main>

      {editing && (
        <TaskModal task={editing} onSave={saveTask} onDelete={deleteTask} onClose={closeModal} />
      )}

      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 flex justify-center px-4"
      >
        {toast && (
          <p className="pointer-events-auto rounded-md bg-text-primary px-4 py-3 font-semibold text-white shadow-lg motion-safe:animate-[fade-in_200ms_ease-out]">
            {toast}
          </p>
        )}
      </div>
    </div>
  );
}
