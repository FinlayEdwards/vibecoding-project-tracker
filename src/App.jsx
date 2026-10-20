import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  AlarmClock,
  ArrowRightLeft,
  Bug,
  CalendarCheck,
  CalendarX,
  CircleCheck,
  Clock,
  OctagonAlert,
  ShieldCheck,
  UserX,
  Users,
} from 'lucide-react';

/**
 * Vibecoding Project Tracker.
 *
 * Data model follows PRD §6; visual tokens follow DESIGN.md / tailwind.config.js.
 *
 * Build sequence (Phase 3):
 *   - M4  data-model    : four columns + seeded tickets.            ✓
 *   - M5  crud-modal    : "+" / edit-on-click / delete modal.        ✓
 *   - M6  tag-style     : bug vs. safe change (icon + label + colour). ✓
 *   - M7  task-owner    : owner avatar + "Hand off to..." + who's driving. ✓
 *   - M8  due-tint      : urgency states from the due date.             ✓
 *   - M9  task-context  : Markdown context + preview, AI tool, history.  ✓
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
 * @property {string|null} contextUpdatedAt ISO timestamp, set whenever aiContext is edited
 * @property {string|null} aiToolId      Current / most recent tool
 * @property {AIUsageEntry[]} aiUsageLog Append-only history (PRD §6 AIUsageLog)
 * @property {string|null} deliverableId
 * @property {number} position           Order within its column
 * @property {string} createdBy          User id
 * @property {string} createdAt          ISO timestamp
 * @property {string} updatedAt          ISO timestamp
 * @property {string|null} completedAt   ISO timestamp
 */

/**
 * @typedef {Object} AIUsageEntry
 * @property {string} id
 * @property {string} aiToolId
 * @property {string} usedBy             User id
 * @property {string} contextSnapshot    Markdown at the time of logging
 * @property {string} loggedAt           ISO timestamp
 */

const findById = (list, id) => list.find((item) => item.id === id) ?? null;

// The four columns of the board, in render order.
// Use these IDs everywhere — do not invent new ones.
export const STAGES = [
  { id: 'todo',        label: 'To Do' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'review',      label: 'Review' },
  { id: 'done',        label: 'Done' },
];

// M6 tag-style: every type has an icon + label + colour, so it never relies on colour alone (DESIGN.md §2).
// Class names are written out in full so Tailwind can find them.
export const TASK_TYPES = [
  {
    id: 'bug',
    label: 'Bug',
    Icon: Bug,
    text: 'text-type-bug',
    border: 'border-type-bug',
    stripe: 'border-l-type-bug',
  },
  {
    id: 'safe_change',
    label: 'Safe change',
    Icon: ShieldCheck,
    text: 'text-type-safe-change',
    border: 'border-type-safe-change',
    stripe: 'border-l-type-safe-change',
  },
];

const typeStyle = (typeId) => findById(TASK_TYPES, typeId) ?? TASK_TYPES[1];

/** Icon + label badge for a ticket type; used on cards and in the modal. */
function TypeBadge({ type }) {
  const { label, Icon, text, border } = typeStyle(type);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border bg-surface-card px-2 py-0.5 text-sm font-semibold ${text} ${border}`}
    >
      <Icon size={16} strokeWidth={2.25} aria-hidden="true" />
      {label}
    </span>
  );
}

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
  { id: 'tool-replit',  name: 'Replit' },
  { id: 'tool-other',   name: 'Other' },
];

/** 'YYYY-MM-DD' for today + `days`, so seeded due dates stay relative to the demo date. */
function isoDateFromToday(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  // Local date, not toISOString(), which would shift to UTC and can land on the wrong day.
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// M8 due-tint thresholds (PRD §10: configurable constants).
export const DUE_WARNING_HOURS = 24;
export const DUE_SOON_DAYS = 3;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Each state has its own icon shape and text label, so urgency never relies on colour alone (DESIGN.md §2).
const DUE_STATES = {
  overdue: { Icon: OctagonAlert,  card: 'bg-due-overdue-tint', badge: 'bg-due-overdue' },
  warning: { Icon: AlarmClock,    card: 'bg-due-warning-tint', badge: 'bg-due-warning' },
  soon:    { Icon: Clock,         card: 'bg-due-soon-tint',    badge: 'bg-due-soon' },
  safe:    { Icon: CalendarCheck, card: 'bg-surface-card',     badge: 'bg-due-safe' },
  done:    { Icon: CircleCheck,   card: 'bg-due-neutral-tint', badge: 'bg-due-neutral' },
  none:    { Icon: CalendarX,     card: 'bg-surface-card',     badge: null },
};

/** 'YYYY-MM-DD' → end of that day in local time; a ticket is due any time on its due date. */
function endOfDueDay(dueDate) {
  const [y, m, d] = dueDate.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Derived urgency (PRD §6: not stored). Done overrides the date.
 * Returns { state, label } where label gives the concrete time, e.g. 'Due in 5h'.
 */
export function dueStatus(task, now) {
  if (task.status === 'done') return { state: 'done', label: 'Done' };
  if (!task.dueDate) return { state: 'none', label: 'No due date' };

  const remaining = endOfDueDay(task.dueDate) - now;
  if (remaining < 0) {
    // Rounded up, so a ticket due yesterday reads "Overdue by 1 day" even a few hours past midnight.
    return { state: 'overdue', label: `Overdue by ${plural(Math.ceil(-remaining / DAY), 'day')}` };
  }
  if (remaining < DUE_WARNING_HOURS * HOUR) {
    const hours = Math.floor(remaining / HOUR);
    return { state: 'warning', label: hours === 0 ? 'Due within the hour' : `Due in ${hours}h` };
  }
  if (remaining < DUE_SOON_DAYS * DAY) {
    return { state: 'soon', label: `Due in ${plural(Math.floor(remaining / DAY), 'day')}` };
  }
  return { state: 'safe', label: 'On track' };
}

/** Current time, refreshed every minute so urgency updates without the user doing anything. */
function useNow(intervalMs = 60 * 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

const formatDueDate = (dueDate) =>
  endOfDueDay(dueDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** Urgency badge: filled colour + icon + concrete label, with the due date beside it. */
function DueBadge({ task, now }) {
  const { state, label } = dueStatus(task, now);
  const { Icon, badge } = DUE_STATES[state];
  return (
    <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
      {badge ? (
        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold text-white ${badge}`}>
          <Icon size={16} strokeWidth={2.25} aria-hidden="true" />
          {label}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-text-muted">
          <Icon size={16} aria-hidden="true" />
          {label}
        </span>
      )}
      {task.dueDate && state !== 'done' && (
        <span className="text-text-muted">
          <span className="sr-only">Due date: </span>
          <time dateTime={task.dueDate}>{formatDueDate(task.dueDate)}</time>
        </span>
      )}
    </p>
  );
}

/** Formats a counter as a ticket ID, e.g. 7 → 'TASK-007'. */
export function formatTaskId(n) {
  return `TASK-${String(n).padStart(3, '0')}`;
}

function seedTasks() {
  const now = new Date().toISOString();
  const base = {
    createdBy: 'u-finlay',
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    deliverableId: null,
    contextUpdatedAt: now,
    aiUsageLog: [],
  };
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
      aiContext: [
        '## Background',
        'Tickets need an add / edit dialog with every field from the data model.',
        '',
        '## Constraints',
        '- Native `<dialog>` for focus containment and Esc to close',
        '- Visible labels on every field; errors as text',
        '- Return focus to the card that opened it',
        '',
        '## Tried so far',
        'A custom overlay `div` — dropped because focus escaped behind it.',
        '',
        '## Pick up',
        'Wire the delete confirmation and check the flow with a screen reader.',
      ].join('\n'),
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
    {
      ...base,
      id: formatTaskId(5),
      title: 'Fix focus not returning after closing the modal',
      description: 'Keyboard users lose their place on the board after Esc.',
      type: 'bug',
      status: 'todo',
      assignedUserId: 'u-priya',
      assignedTeamId: null,
      dueDate: isoDateFromToday(-2),
      aiContext: 'Store the trigger element before opening and refocus it on close.',
      aiToolId: 'tool-chatgpt',
      position: 1,
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

// Starting structure for a new ticket's context, so every briefing answers the same questions.
const CONTEXT_TEMPLATE = [
  '## Background',
  'What is this ticket and why does it matter?',
  '',
  '## Constraints',
  '- ',
  '',
  '## Tried so far',
  '- ',
  '',
  '## Pick up',
  'What the next AI session should do first.',
].join('\n');

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
    aiContext: CONTEXT_TEMPLATE,
    contextUpdatedAt: null,
    aiToolId: null,
    aiUsageLog: [],
    deliverableId: null,
  };
}

/**
 * Appends an AI usage entry when a tool is set and either the tool or the context changed,
 * so the log records each meaningful AI session without duplicating unchanged saves.
 */
function withUsageLog(draft, previous, now) {
  const log = draft.aiUsageLog ?? [];
  const changed =
    !previous || previous.aiToolId !== draft.aiToolId || previous.aiContext !== draft.aiContext;
  if (!draft.aiToolId || !changed) return log;
  return [
    ...log,
    {
      id: `${now}-${log.length}`,
      aiToolId: draft.aiToolId,
      usedBy: USERS[0].id,
      contextSnapshot: draft.aiContext,
      loggedAt: now,
    },
  ];
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
const relativeTime = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

/** '2 hours ago', 'yesterday', 'just now' … */
function timeAgo(iso, now) {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  if (Math.abs(seconds) < 60) return 'just now';
  const units = [
    ['year', 365 * 24 * 3600],
    ['month', 30 * 24 * 3600],
    ['day', 24 * 3600],
    ['hour', 3600],
    ['minute', 60],
  ];
  const [unit, size] = units.find(([, s]) => Math.abs(seconds) >= s);
  return relativeTime.format(Math.round(seconds / size), unit);
}

// Links in rendered context open in a new tab so the user never loses the modal, and say so.
const markdownComponents = {
  a: ({ node, children, ...props }) => (
    <a {...props} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  ),
};

/**
 * M9 task-context: Markdown briefing with a live preview, the AI tool used,
 * a "last updated" hint and the append-only AI usage history (PRD §5–6).
 */
function ContextSection({ draft, setDraft, now }) {
  const history = [...(draft.aiUsageLog ?? [])].reverse().slice(0, 5);
  return (
    <section aria-labelledby="context-heading" className="rounded-md border border-surface-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="context-heading" className="text-lg font-bold">
          Context
        </h3>
        <p id="task-context-updated" className="text-sm text-text-muted">
          {draft.contextUpdatedAt ? `Last updated ${timeAgo(draft.contextUpdatedAt, now)}` : 'Not edited yet'}
        </p>
      </div>

      <div className="mt-2 grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="task-context" className="block font-semibold">
            AI context (Markdown)
          </label>
          <p id="task-context-hint" className="text-sm text-text-muted">
            A paste-ready briefing: what the next AI session needs to pick this up.
          </p>
          <textarea
            id="task-context"
            rows={12}
            className={`${inputClass} font-mono text-sm`}
            value={draft.aiContext}
            onChange={(e) =>
              setDraft((d) => ({ ...d, aiContext: e.target.value, contextUpdatedAt: new Date().toISOString() }))
            }
            aria-describedby="task-context-hint task-context-updated"
          />
        </div>

        <div className="flex min-w-0 flex-col">
          <p id="context-preview-label" className="font-semibold">
            Preview
          </p>
          <p className="text-sm text-text-muted">How the context reads once rendered.</p>
          {/* Focusable so keyboard users can scroll a long preview. */}
          <div
            role="region"
            aria-labelledby="context-preview-label"
            tabIndex={0}
            className="markdown mt-1 max-h-80 min-h-40 flex-1 overflow-auto rounded-md border border-surface-border bg-surface-page p-3"
          >
            {draft.aiContext.trim() ? (
              <ReactMarkdown components={markdownComponents}>{draft.aiContext}</ReactMarkdown>
            ) : (
              <p className="text-text-muted">Nothing to preview yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 max-w-sm">
        <Field id="task-tool" label="AI tool">
          <OptionalSelect
            id="task-tool"
            value={draft.aiToolId}
            onChange={(aiToolId) => setDraft((d) => ({ ...d, aiToolId }))}
            options={AI_TOOLS}
            emptyLabel="None yet"
          />
        </Field>
      </div>

      {history.length > 0 && (
        <div className="mt-4">
          <h4 className="font-semibold">AI tool history</h4>
          <ol className="mt-1 flex flex-col gap-1 text-sm">
            {history.map((entry) => (
              <li key={entry.id} className="flex flex-wrap gap-x-2">
                <span className="font-semibold">{findById(AI_TOOLS, entry.aiToolId)?.name ?? 'Unknown tool'}</span>
                <span className="text-text-muted">
                  {findById(USERS, entry.usedBy)?.name ?? 'Someone'} · {timeAgo(entry.loggedAt, now)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

function TaskModal({ task, now, onSave, onDelete, onClose }) {
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
      className="w-[calc(100%-2rem)] max-w-[960px] rounded-lg bg-surface-card p-0 text-text-primary"
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="task-modal-heading" className="text-xl font-bold">
            {heading}
          </h2>
          <TypeBadge type={draft.type} />
        </div>

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

        {/* Radio cards rather than a select, so both options and their icons are always visible. */}
        <fieldset>
          <legend className="font-semibold">Type</legend>
          <div className="mt-1 grid gap-3 sm:grid-cols-2">
            {TASK_TYPES.map(({ id, label, Icon, text, border }) => {
              const checked = draft.type === id;
              return (
                <label
                  key={id}
                  className={`flex min-h-target cursor-pointer items-center gap-2 rounded-md border-2 px-3 py-2 font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-primary ${
                    checked ? `${border} ${text} bg-surface-page` : 'border-surface-border text-text-primary'
                  }`}
                >
                  <input
                    type="radio"
                    name="task-type"
                    value={id}
                    checked={checked}
                    onChange={() => set('type')(id)}
                    className="h-5 w-5 accent-brand-primary focus-visible:outline-none"
                  />
                  <Icon size={20} strokeWidth={2.25} aria-hidden="true" />
                  {label}
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
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
        </div>

        <ContextSection draft={draft} setDraft={setDraft} now={now} />

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

function TaskCard({ task, now, onOpen, onHandOff, justHandedOff }) {
  const assignee = assigneeLabel(task);
  const tint = DUE_STATES[dueStatus(task, now).state].card;
  return (
    <article
      aria-labelledby={`${task.id}-title`}
      className={`relative rounded-md border border-l-4 border-surface-border p-4 hover:ring-2 hover:ring-brand-accent ${tint} ${typeStyle(task.type).stripe}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-sm text-text-muted">{task.id}</p>
        <TypeBadge type={task.type} />
      </div>
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
      <DueBadge task={task} now={now} />
      <div className="mt-3 flex items-center gap-2">
        <OwnerAvatar task={task} />
        <p className="min-w-0 text-sm font-semibold">
          <span className="sr-only">Assigned to </span>
          {assignee}
        </p>
      </div>
      {justHandedOff && (
        <p className="mt-2 flex items-center gap-1 text-sm font-semibold text-brand-primary">
          <ArrowRightLeft size={16} aria-hidden="true" />
          Handed off just now
        </p>
      )}
      <HandOff task={task} onHandOff={onHandOff} />
    </article>
  );
}

/** Two-letter initials, e.g. 'Sam Rivera' → 'SR'. */
function initials(name) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Owner avatar: initials for a person, a group icon for a team-only ticket,
 * a dashed outline when unassigned. Decorative — the name beside it is the label.
 */
function OwnerAvatar({ task, size = 'h-9 w-9' }) {
  const user = findById(USERS, task.assignedUserId);
  const base = `flex ${size} shrink-0 items-center justify-center rounded-full font-bold`;
  if (user) {
    return (
      <span aria-hidden="true" className={`${base} bg-brand-primary text-sm text-white`}>
        {initials(user.name)}
      </span>
    );
  }
  if (task.assignedTeamId) {
    return (
      <span aria-hidden="true" className={`${base} border-2 border-brand-primary text-brand-primary`}>
        <Users size={18} />
      </span>
    );
  }
  return (
    <span aria-hidden="true" className={`${base} border-2 border-dashed border-surface-border text-text-muted`}>
      <UserX size={18} />
    </span>
  );
}

/**
 * "Hand off to…" control. Reassignment only happens on the button press, not when the
 * select changes, so arrowing through the options can't reassign by accident (WCAG 3.2.2).
 */
function HandOff({ task, onHandOff }) {
  const [targetId, setTargetId] = useState('');
  const selectId = `${task.id}-handoff`;
  const others = USERS.filter((u) => u.id !== task.assignedUserId);
  return (
    // relative z-10 lifts the controls above the card's full-size edit button.
    <div className="relative z-10 mt-3 flex flex-wrap items-end gap-2 border-t border-surface-border pt-3">
      <div className="min-w-0 flex-1">
        <label htmlFor={selectId} className="block text-sm font-semibold">
          Hand off to…
        </label>
        <select
          id={selectId}
          className="mt-1 block min-h-target w-full rounded-md border border-surface-border bg-surface-card px-2 text-sm"
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
        >
          <option value="">Choose a person</option>
          {others.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        disabled={!targetId}
        onClick={() => {
          onHandOff(task.id, targetId);
          setTargetId('');
        }}
        aria-label={`Hand off ${task.id}`}
        className="min-h-target rounded-md border border-brand-primary bg-surface-card px-3 text-sm font-semibold text-brand-primary hover:bg-surface-page disabled:cursor-not-allowed disabled:border-surface-border disabled:text-text-muted"
      >
        Hand off
      </button>
    </div>
  );
}

/** M7 optional strip: who is driving which In Progress tickets right now. */
function DrivingStrip({ tasks }) {
  return (
    <section aria-labelledby="driving-heading" className="mb-6">
      <h2 id="driving-heading" className="text-lg font-bold">
        Who's driving
      </h2>
      <ul className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {USERS.map((user) => {
          const driving = tasks.filter((t) => t.assignedUserId === user.id && t.status === 'in-progress');
          return (
            <li
              key={user.id}
              className="flex items-center gap-3 rounded-md border border-surface-border bg-surface-card p-3"
            >
              <OwnerAvatar task={{ assignedUserId: user.id }} />
              <div className="min-w-0">
                <p className="font-semibold">{user.name}</p>
                <p className="text-sm text-text-muted">
                  {driving.length === 0 ? (
                    'Not driving anything in progress'
                  ) : (
                    <>
                      Driving{' '}
                      {driving.map((t, i) => (
                        <span key={t.id}>
                          {i > 0 && ', '}
                          <span className="font-mono">{t.id}</span>
                        </span>
                      ))}
                    </>
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Column({ stage, tasks, now, onOpenTask, onHandOff, recentHandOffId }) {
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
              <TaskCard
                task={task}
                now={now}
                onOpen={onOpenTask}
                onHandOff={onHandOff}
                justHandedOff={task.id === recentHandOffId}
              />
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
  const [nextTaskNumber, setNextTaskNumber] = useLocalStorage('vibetracker.nextTaskNumber', 6);

  const now = useNow();

  // The ticket open in the modal (a blank draft when creating), or null when closed.
  const [editing, setEditing] = useState(null);
  // Element to return focus to when the modal closes (DESIGN.md §4).
  const returnFocusRef = useRef(null);
  const newButtonRef = useRef(null);

  // Status message shown as a toast and announced by screen readers (WCAG 4.1.3).
  const [toast, setToast] = useState('');
  // Ticket that was just handed off; its card shows a "Handed off just now" note while the toast is up.
  const [recentHandOffId, setRecentHandOffId] = useState(null);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => {
      setToast('');
      setRecentHandOffId(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  function handOff(taskId, userId) {
    const user = findById(USERS, userId);
    setTasks(
      tasks.map((t) =>
        t.id === taskId ? { ...t, assignedUserId: userId, updatedAt: new Date().toISOString() } : t,
      ),
    );
    setRecentHandOffId(taskId);
    setToast(`${taskId} handed off to ${user.name}.`);
  }

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
          aiUsageLog: withUsageLog(draft, null, now),
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
            aiUsageLog: withUsageLog(draft, t, now),
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

      <DrivingStrip tasks={tasks} />

      <main aria-label="Board">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {STAGES.map((stage) => (
            <Column
              key={stage.id}
              stage={stage}
              tasks={tasks
                .filter((task) => task.status === stage.id)
                .sort((a, b) => a.position - b.position)}
              now={now}
              onOpenTask={openModal}
              onHandOff={handOff}
              recentHandOffId={recentHandOffId}
            />
          ))}
        </div>
      </main>

      {editing && (
        <TaskModal task={editing} now={now} onSave={saveTask} onDelete={deleteTask} onClose={closeModal} />
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
