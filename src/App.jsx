import { createContext, useContext, useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AlarmClock,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  ArrowUp,
  BookOpen,
  Bug,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  CalendarCheck,
  CalendarX,
  CircleCheck,
  CircleDashed,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  GripVertical,
  LayoutGrid,
  Lock,
  LogIn,
  LogOut,
  MonitorPlay,
  OctagonAlert,
  Package,
  Plus,
  Presentation,
  ShieldCheck,
  Monitor,
  Moon,
  Sun,
  UserPlus,
  UserX,
  Users,
  X,
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
 *   - M10 copy-context  : "Copy context" handoff block on cards + modal. ✓
 *   - M11 project-deliverables : Deliverable Anchor Board + ticket links. ✓
 *   - M12 secret-sauce  : accessible drag-and-drop (pointer, keyboard, screen reader). ✓
 *   - Login (PRD nice-to-have): demo sign-in / sign-up, hashed passwords, role permissions. ✓
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
// Basic role-based access control (PRD §10). Anything not listed is open to every signed-in user.
export const PERMISSIONS = {
  deleteTicket: 'ticket.delete',
  editDeliverables: 'deliverables.edit',
};

export const ROLES = [
  { id: 'role-lead', name: 'Lead developer', permissions: [PERMISSIONS.deleteTicket, PERMISSIONS.editDeliverables] },
  { id: 'role-dev',  name: 'Developer',      permissions: [PERMISSIONS.deleteTicket] },
  { id: 'role-ux',   name: 'UX designer',    permissions: [] },
];

export const can = (user, permission) =>
  Boolean(findById(ROLES, user?.roleId)?.permissions.includes(permission));

/** Role names that hold a permission, for "Only … can do this" messages. */
const rolesWith = (permission) =>
  ROLES.filter((r) => r.permissions.includes(permission)).map((r) => `${r.name}s`).join(' and ');

// Seeded demo accounts; every one signs in with DEMO_PASSWORD. Hashes are PBKDF2-SHA256
// (see hashPassword) so no plaintext password is stored, even in the demo.
export const DEMO_PASSWORD = 'demo1234';

export const USERS = [
  {
    id: 'u-finlay', name: 'Finlay Edwards', email: 'finlay@example.com', githubUsername: 'FinlayEdwards', roleId: 'role-lead',
    salt: '36c4fdf6513bbc48156f90e5853c38a9', passwordHash: 'da264f86c1a10d10058975a2506fca1de1862a4562e4260f82228b7da3325829',
  },
  {
    id: 'u-sam', name: 'Sam Rivera', email: 'sam@example.com', githubUsername: 'samrivera', roleId: 'role-dev',
    salt: '88e537123c2b0f55648f756bcfc98672', passwordHash: '5a5e23db9c3ef8ed15d3e826939471c69ec8db40043542c5508853838607b5a4',
  },
  {
    id: 'u-priya', name: 'Priya Shah', email: 'priya@example.com', githubUsername: 'priyashah', roleId: 'role-ux',
    salt: 'a06ac507ccbfc30b381467b234d3787e', passwordHash: 'db1ebee71d5002f3edf1e9b6721c3a585062fa6c579c5a67fba8b86c915e47c3',
  },
];

// Accounts live in state (seeded from USERS) so sign-ups appear in every user picker.
const UsersContext = createContext(USERS);
const useUsers = () => useContext(UsersContext);

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

// M11 project-deliverables: the four anchor slots (PRD §8 — an initial proposal, kept extensible).
// Tickets link to one through `deliverableId`; each slot's URL lives in localStorage.
export const DELIVERABLES = [
  { id: 'presentation',  name: 'Presentation',  Icon: Presentation },
  { id: 'demo',          name: 'Demo',          Icon: MonitorPlay },
  { id: 'report',        name: 'Report',        Icon: FileText },
  { id: 'documentation', name: 'Documentation', Icon: BookOpen },
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
        <span className={`inline-flex items-center gap-1 rounded-md border border-transparent px-2 py-0.5 font-semibold text-on-fill ${badge}`}>
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
      deliverableId: 'demo',
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
      deliverableId: 'report',
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
function assigneeLabel(task, users) {
  const user = findById(users, task.assignedUserId);
  const team = findById(TEAMS, task.assignedTeamId);
  if (user && team) return `${user.name} · ${team.name}`;
  if (user) return user.name;
  if (team) return `${team.name} team`;
  return 'Unassigned';
}

/**
 * M10 copy-context: the paste-ready handoff block (PRD §5) — ticket ID, title, status,
 * AI tool and the raw Markdown context, framed so it reads as a briefing in a new AI chat.
 */
export function buildContextBlock(task, users = USERS) {
  const id = task.id ?? 'New ticket';
  const status = findById(STAGES, task.status)?.label ?? task.status;
  const tool = findById(AI_TOOLS, task.aiToolId)?.name ?? 'None recorded';
  const lines = [
    `# ${id}: ${task.title.trim() || 'Untitled ticket'}`,
    '',
    "I'm continuing work on this ticket from a previous AI session. Use the context below to pick it up.",
    '',
    `- **Status:** ${status}`,
    `- **Type:** ${typeStyle(task.type).label}`,
    `- **Assigned to:** ${assigneeLabel(task, users)}`,
    `- **Due:** ${task.dueDate ?? 'No due date'}`,
    `- **AI tool used so far:** ${tool}`,
  ];
  const deliverable = findById(DELIVERABLES, task.deliverableId);
  if (deliverable) lines.push(`- **Deliverable:** ${deliverable.name}`);
  if (task.description?.trim()) lines.push('', '## Description', task.description.trim());
  lines.push('', '## Context', task.aiContext?.trim() || '_No context recorded yet._');
  return lines.join('\n');
}

/** Clipboard write with a fallback for browsers/contexts without the async Clipboard API. */
async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand('copy');
  area.remove();
  if (!ok) throw new Error('Copy failed');
}

/** "Copy context" button; reports a success or failure message through onResult. */
function CopyContextButton({ task, onResult, className = '' }) {
  const id = task.id ?? 'new ticket';
  const users = useUsers();
  async function handleClick() {
    try {
      await copyText(buildContextBlock(task, users));
      onResult(`Copied ${task.id ?? 'ticket'} context. Paste it into your AI tool.`);
    } catch {
      onResult(`Couldn't copy ${task.id ?? 'the'} context. Check clipboard permissions and try again.`);
    }
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`Copy context for ${id}`}
      className={`inline-flex min-h-target items-center gap-2 rounded-md border border-brand-primary bg-surface-card px-3 text-sm font-semibold text-brand-primary hover:bg-surface-page ${className}`}
    >
      <Copy size={16} aria-hidden="true" />
      Copy context
    </button>
  );
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
function withUsageLog(draft, previous, now, userId) {
  const log = draft.aiUsageLog ?? [];
  const changed =
    !previous || previous.aiToolId !== draft.aiToolId || previous.aiContext !== draft.aiContext;
  if (!draft.aiToolId || !changed) return log;
  return [
    ...log,
    {
      id: `${now}-${log.length}`,
      aiToolId: draft.aiToolId,
      usedBy: userId,
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
  'min-h-target rounded-md bg-brand-primary px-4 py-2 font-semibold text-on-fill hover:bg-brand-accent';
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
  const users = useUsers();
  const history = [...(draft.aiUsageLog ?? [])].reverse().slice(0, 5);
  // The board's toast sits behind the modal's inert backdrop, so the modal announces copies itself.
  const [copyMessage, setCopyMessage] = useState('');
  useEffect(() => {
    if (!copyMessage) return undefined;
    const timer = setTimeout(() => setCopyMessage(''), 5000);
    return () => clearTimeout(timer);
  }, [copyMessage]);
  return (
    <section aria-labelledby="context-heading" className="rounded-md border border-surface-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 id="context-heading" className="text-lg font-bold">
            Context
          </h3>
          <p id="task-context-updated" className="text-sm text-text-muted">
            {draft.contextUpdatedAt ? `Last updated ${timeAgo(draft.contextUpdatedAt, now)}` : 'Not edited yet'}
          </p>
        </div>
        <CopyContextButton task={draft} onResult={setCopyMessage} />
      </div>
      <p role="status" className="mt-2 text-sm font-semibold text-brand-primary empty:hidden">
        {copyMessage}
      </p>

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
                  {findById(users, entry.usedBy)?.name ?? 'Someone'} · {timeAgo(entry.loggedAt, now)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

function TaskModal({ task, now, canDelete, onSave, onDelete, onClose }) {
  const users = useUsers();
  const dialogRef = useRef(null);
  const titleRef = useRef(null);
  const isNew = !task.id;
  const [draft, setDraft] = useState(task);
  const [titleError, setTitleError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // The button that was clicked disappears either way, so move focus to its counterpart.
  const deleteButtonRef = useRef(null);
  const keepButtonRef = useRef(null);
  const confirmToggled = useRef(false);

  useEffect(() => {
    // Guard: React StrictMode runs effects twice in development.
    if (!dialogRef.current.open) dialogRef.current.showModal();
    titleRef.current.focus();
  }, []);

  useEffect(() => {
    if (!confirmToggled.current) return;
    (confirmingDelete ? keepButtonRef : deleteButtonRef).current?.focus();
  }, [confirmingDelete]);

  function toggleConfirmDelete(value) {
    confirmToggled.current = true;
    setConfirmingDelete(value);
  }

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
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="task-modal-heading" className="text-xl font-bold">
              {heading}
            </h2>
            <TypeBadge type={draft.type} />
          </div>
          <button type="button" onClick={onClose} aria-label="Close without saving" className={iconButton}>
            <X size={20} aria-hidden="true" />
          </button>
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
              options={users}
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

        <div className="max-w-sm">
          <Field id="task-deliverable" label="Deliverable">
            <OptionalSelect
              id="task-deliverable"
              value={draft.deliverableId}
              onChange={set('deliverableId')}
              options={DELIVERABLES}
              emptyLabel="Not linked"
            />
          </Field>
        </div>

        {confirmingDelete ? (
          <div
            key="confirm-delete"
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
              <button ref={keepButtonRef} type="button" className={buttonSecondary} onClick={() => toggleConfirmDelete(false)}>
                Keep ticket
              </button>
            </div>
          </div>
        ) : (
          // Separate keys stop React reusing "Keep ticket" as the submit button mid-click,
          // which would save and close the modal instead of just cancelling the delete.
          <div key="actions" className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-border pt-4">
            {isNew ? (
              <span />
            ) : canDelete ? (
              <button ref={deleteButtonRef} type="button" className={buttonDanger} onClick={() => toggleConfirmDelete(true)}>
                Delete
              </button>
            ) : (
              <p className="flex items-center gap-1 text-sm text-text-muted">
                <Lock size={16} aria-hidden="true" />
                Only {rolesWith(PERMISSIONS.deleteTicket)} can delete tickets.
              </p>
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

const iconButton =
  'inline-flex min-h-target min-w-target items-center justify-center rounded-md border border-surface-border bg-surface-card text-text-primary hover:border-brand-accent hover:text-brand-accent disabled:cursor-not-allowed disabled:opacity-40';

/**
 * M12 secret-sauce: a draggable card. Dragging starts only from the grip handle, which
 * also works from the keyboard (Space to lift, arrows to move, Space to drop, Esc to cancel).
 */
function SortableTaskCard(props) {
  const { task } = props;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, data: { type: 'task' } });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={isDragging ? 'relative z-20' : undefined}
    >
      <TaskCard
        {...props}
        isDragging={isDragging}
        dragHandle={
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Move ${task.id}`}
            className={`${iconButton} relative z-10 cursor-grab touch-none active:cursor-grabbing`}
          >
            <GripVertical size={20} aria-hidden="true" />
          </button>
        }
      />
    </li>
  );
}

/**
 * Silver foil outline (inspired by React Bits' Holo Card): feeds the pointer position into
 * CSS variables that steer the foil gradient and glare in index.css. Written straight
 * to the element's style so pointer moves don't re-render React.
 */
function trackHolo(e) {
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;
  el.style.setProperty('--holo-x', `${x * 100}%`);
  el.style.setProperty('--holo-y', `${y * 100}%`);
  el.style.setProperty('--holo-angle', `${(x + y) * 180}deg`);
}

function TaskCard({ task, now, onOpen, onHandOff, onCopied, onMove, onMoveColumn, justHandedOff, isFirst, isLast, isDragging, dragHandle, collapsed, onToggleCollapsed }) {
  const assignee = assigneeLabel(task, useUsers());
  const tint = DUE_STATES[dueStatus(task, now).state].card;
  const stageIndex = STAGES.findIndex((s) => s.id === task.status);
  const prevStage = STAGES[stageIndex - 1];
  const nextStage = STAGES[stageIndex + 1];
  // The hand-off form is tucked behind a disclosure button so cards stay calm (DESIGN.md §1).
  const [handOffOpen, setHandOffOpen] = useState(false);
  const handOffButtonRef = useRef(null);
  const handOffPanelId = `${task.id}-handoff-panel`;
  const detailsId = `${task.id}-details`;
  // Collapsed cards show only the title; the chevron is the same size in both states so it never jumps.
  const collapseToggle = (
    <button
      type="button"
      aria-expanded={!collapsed}
      aria-controls={detailsId}
      aria-label={`${collapsed ? 'Show' : 'Hide'} details for ${task.id}`}
      title={collapsed ? 'Show details' : 'Hide details'}
      onClick={() => onToggleCollapsed(task.id)}
      className={`${iconButton} relative z-10 shrink-0`}
    >
      <ChevronDown
        size={20}
        aria-hidden="true"
        className={`motion-safe:transition-transform ${collapsed ? '-rotate-90' : ''}`}
      />
    </button>
  );
  const title = (
    <h3 id={`${task.id}-title`} className={`${collapsed ? 'min-w-0 flex-1' : 'mt-2'} text-base font-semibold leading-snug`}>
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
  );
  return (
    <article
      aria-labelledby={`${task.id}-title`}
      onPointerMove={trackHolo}
      data-dragging={isDragging || undefined}
      className={`holo-outline relative rounded-lg border border-l-4 border-surface-border shadow-sm ${collapsed ? 'p-2' : 'p-4'} ${tint} ${typeStyle(task.type).stripe} ${
        isDragging ? 'shadow-xl motion-safe:rotate-1' : ''
      }`}
    >
      {collapsed ? (
        <div className="flex items-center gap-2">
          {dragHandle}
          {title}
          {collapseToggle}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {dragHandle}
              <p className="font-mono text-sm text-text-muted">{task.id}</p>
            </div>
            <div className="flex items-center gap-2">
              <TypeBadge type={task.type} />
              {collapseToggle}
            </div>
          </div>
          {title}
        </>
      )}
      <div id={detailsId} hidden={collapsed}>
        <DueBadge task={task} now={now} />
        <div className="mt-3 flex items-center gap-2">
          <OwnerAvatar task={task} />
          <p className="min-w-0 text-sm font-semibold">
            <span className="sr-only">Assigned to </span>
            {assignee}
          </p>
        </div>
        {task.deliverableId && (
          <p className="mt-2 flex items-center gap-1 text-sm text-text-muted">
            <Package size={16} aria-hidden="true" />
            Deliverable: {findById(DELIVERABLES, task.deliverableId)?.name}
          </p>
        )}
        {justHandedOff && (
          <p className="mt-2 flex items-center gap-1 text-sm font-semibold text-brand-primary">
            <ArrowRightLeft size={16} aria-hidden="true" />
            Handed off just now
          </p>
        )}
        {/* relative z-10 lifts the controls above the card's full-size edit button. */}
        <div className="relative z-10 mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-surface-border pt-3">
          <div className="flex flex-wrap gap-2">
            <CopyContextButton task={task} onResult={onCopied} />
            <button
              ref={handOffButtonRef}
              type="button"
              aria-expanded={handOffOpen}
              aria-controls={handOffPanelId}
              onClick={() => setHandOffOpen(!handOffOpen)}
              className={`inline-flex min-h-target items-center gap-2 rounded-md border px-3 text-sm font-semibold hover:border-brand-accent hover:text-brand-accent ${
                handOffOpen
                  ? 'border-brand-primary bg-surface-page text-brand-primary'
                  : 'border-surface-border bg-surface-card text-text-primary'
              }`}
            >
              <ArrowRightLeft size={16} aria-hidden="true" />
              Hand off
              <span className="sr-only"> {task.id}</span>
            </button>
          </div>
          {/* Single-pointer alternative to dragging, across columns too (WCAG 2.5.7). */}
          <div role="group" aria-label={`Move ${task.id}`} className="flex">
            <MoveButton
              label={prevStage ? `Move ${task.id} to ${prevStage.label}` : `${task.id} is in the first column`}
              disabled={!prevStage}
              onClick={() => onMoveColumn(task.id, prevStage.id)}
              Icon={ArrowLeft}
              className="rounded-l-md"
            />
            <MoveButton
              label={`Move ${task.id} up`}
              disabled={isFirst}
              onClick={() => onMove(task.id, -1)}
              Icon={ArrowUp}
            />
            <MoveButton
              label={`Move ${task.id} down`}
              disabled={isLast}
              onClick={() => onMove(task.id, 1)}
              Icon={ArrowDown}
            />
            <MoveButton
              label={nextStage ? `Move ${task.id} to ${nextStage.label}` : `${task.id} is in the last column`}
              disabled={!nextStage}
              onClick={() => onMoveColumn(task.id, nextStage.id)}
              Icon={ArrowRight}
              className="rounded-r-md"
            />
          </div>
        </div>
        {handOffOpen && (
          <div id={handOffPanelId} className="relative z-10 mt-3">
            <HandOff
              task={task}
              onHandOff={(...args) => {
                onHandOff(...args);
                setHandOffOpen(false);
                handOffButtonRef.current?.focus();
              }}
            />
          </div>
        )}
      </div>
    </article>
  );
}

/** One segment of the card's joined move-button group; the label also shows as a tooltip. */
function MoveButton({ label, disabled, onClick, Icon, className = '' }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`-ml-px inline-flex min-h-target min-w-target items-center justify-center border border-surface-border bg-surface-card text-text-primary first:ml-0 hover:z-10 hover:border-brand-accent hover:text-brand-accent focus-visible:z-10 disabled:cursor-not-allowed disabled:text-text-muted disabled:opacity-50 ${className}`}
    >
      <Icon size={18} aria-hidden="true" />
    </button>
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
  const user = findById(useUsers(), task.assignedUserId);
  const base = `flex ${size} shrink-0 items-center justify-center rounded-full font-bold`;
  if (user) {
    return (
      <span aria-hidden="true" className={`${base} bg-brand-primary text-sm text-on-fill`}>
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
  const others = useUsers().filter((u) => u.id !== task.assignedUserId);
  // Move focus into the panel when it opens, so keyboard users land on the choice.
  const selectRef = useRef(null);
  useEffect(() => selectRef.current?.focus(), []);
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-md bg-surface-page p-2">
      <div className="min-w-0 flex-1">
        <label htmlFor={selectId} className="block text-sm font-semibold">
          Hand off to…
        </label>
        <select
          id={selectId}
          ref={selectRef}
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

/** Accepts only absolute http(s) URLs, so a saved link always opens somewhere real. */
function isValidUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** One deliverable slot: URL field, empty/filled status, open link and linked-ticket count. */
function AnchorCard({ deliverable, url, ticketCount, canEdit, onSave }) {
  const { id, name, Icon } = deliverable;
  const [value, setValue] = useState(url);
  const [error, setError] = useState('');
  const inputId = `anchor-${id}`;
  const filled = Boolean(url);

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed && !isValidUrl(trimmed)) {
      setError('Enter a full link starting with https://');
      return;
    }
    setError('');
    setValue(trimmed);
    onSave(id, trimmed);
  }

  return (
    <li className="flex flex-col rounded-md border border-surface-border bg-surface-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-bold">
          <Icon size={20} aria-hidden="true" />
          {name}
        </h3>
        {/* Status uses icon shape + text, not just a coloured dot (WCAG 1.4.1). */}
        {filled ? (
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-due-safe">
            <CircleCheck size={16} aria-hidden="true" />
            Link added
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-sm text-text-muted">
            <CircleDashed size={16} aria-hidden="true" />
            No link yet
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-text-muted">
        {ticketCount === 0 ? 'No tickets linked' : `${plural(ticketCount, 'ticket')} linked`}
      </p>

      {canEdit && (
        <form onSubmit={handleSubmit} noValidate className="mt-3 flex flex-col gap-2">
          <label htmlFor={inputId} className="text-sm font-semibold">
            {name} link
          </label>
          <div className="flex gap-2">
            <input
              id={inputId}
              type="url"
              inputMode="url"
              placeholder="https://"
              className="block min-h-target w-full min-w-0 rounded-md border border-surface-border bg-surface-card px-3 text-sm"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (error) setError('');
              }}
              aria-invalid={error ? 'true' : undefined}
              aria-describedby={error ? `${inputId}-error` : undefined}
            />
            <button
              type="submit"
              aria-label={`Save ${name} link`}
              className="min-h-target shrink-0 rounded-md bg-brand-primary px-3 text-sm font-semibold text-on-fill hover:bg-brand-accent"
            >
              Save
            </button>
          </div>
          {error && (
            <p id={`${inputId}-error`} className="text-sm font-semibold text-due-overdue">
              <span aria-hidden="true">⚠ </span>
              {error}
            </p>
          )}
        </form>
      )}

      {filled && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 self-start text-sm font-semibold text-brand-accent underline"
        >
          Open {name}
          <ExternalLink size={14} aria-hidden="true" />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      )}
    </li>
  );
}

/** M11: Deliverable Anchor Board, pinned above the Kanban. */
function AnchorBoard({ anchors, tasks, canEdit, onSave }) {
  const done = DELIVERABLES.filter((d) => anchors[d.id]).length;
  return (
    <section aria-labelledby="deliverables-heading" className="mb-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="deliverables-heading" className="text-lg font-bold">
          Deliverables
        </h2>
        <p className="text-sm text-text-muted">
          {done} of {DELIVERABLES.length} linked
        </p>
      </div>
      {!canEdit && (
        <p className="mt-1 flex items-center gap-1 text-sm text-text-muted">
          <Lock size={16} aria-hidden="true" />
          View only: {rolesWith(PERMISSIONS.editDeliverables)} can change deliverable links.
        </p>
      )}
      <ul className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {DELIVERABLES.map((d) => (
          <AnchorCard
            key={d.id}
            deliverable={d}
            url={anchors[d.id] ?? ''}
            ticketCount={tasks.filter((t) => t.deliverableId === d.id).length}
            canEdit={canEdit}
            onSave={onSave}
          />
        ))}
      </ul>
    </section>
  );
}

const VIEWS = [
  { id: 'board',        label: 'Board',        Icon: LayoutGrid },
  { id: 'deliverables', label: 'Deliverables', Icon: Package },
];

/**
 * Board / Deliverables tabs, following the WAI-ARIA tabs pattern: one Tab stop for the
 * group, ←/→ (and Home/End) move between tabs, and the selected tab is shown by a bold
 * label plus an underline bar, not colour alone.
 */
function ViewTabs({ active, onChange, deliverablesLinked }) {
  const tabRefs = useRef({});

  function handleKeyDown(e) {
    const index = VIEWS.findIndex((v) => v.id === active);
    const moves = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: VIEWS.length - 1 };
    if (!(e.key in moves)) return;
    e.preventDefault();
    const next = VIEWS[(moves[e.key] + VIEWS.length) % VIEWS.length];
    onChange(next.id);
    tabRefs.current[next.id]?.focus();
  }

  return (
    <div role="tablist" aria-label="Views" className="mb-6 flex gap-2 border-b border-surface-border">
      {VIEWS.map(({ id, label, Icon }) => {
        const selected = id === active;
        return (
          <button
            key={id}
            ref={(el) => (tabRefs.current[id] = el)}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={selected}
            aria-controls={`panel-${id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(id)}
            onKeyDown={handleKeyDown}
            className={`-mb-px flex min-h-target items-center gap-2 border-b-4 px-4 text-base ${
              selected
                ? 'border-brand-primary font-bold text-brand-primary'
                : 'border-transparent font-semibold text-text-muted hover:text-brand-accent'
            }`}
          >
            <Icon size={18} aria-hidden="true" />
            {label}
            {id === 'deliverables' && (
              <span className="rounded-full border border-surface-border px-2 text-sm font-semibold text-text-muted">
                {deliverablesLinked}/{DELIVERABLES.length}
                <span className="sr-only"> linked</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

const THEMES = [
  { id: 'system', label: 'System', Icon: Monitor },
  { id: 'light',  label: 'Light',  Icon: Sun },
  { id: 'dark',   label: 'Dark',   Icon: Moon },
];

/**
 * Theme choice, saved per browser. 'system' follows the OS setting and updates live
 * if it changes. index.html applies the same logic before first paint.
 */
function useTheme() {
  const [choice, setChoice] = useLocalStorage('vibetracker.theme', 'system');
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = choice === 'dark' || (choice === 'system' && media.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    };
    apply();
    if (choice !== 'system') return undefined;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [choice]);
  return [choice, setChoice];
}

/** System / Light / Dark as a labelled radio group: always visible, arrow-key operable. */
function ThemeToggle() {
  const [choice, setChoice] = useTheme();
  return (
    <fieldset>
      <legend className="text-sm font-semibold">Theme</legend>
      <div className="mt-1 flex rounded-md border border-surface-border bg-surface-card p-0.5">
        {THEMES.map(({ id, label, Icon }) => (
          <label
            key={id}
            className={`flex min-h-target cursor-pointer items-center gap-1 rounded px-3 text-sm font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-primary ${
              choice === id ? 'bg-brand-primary text-on-fill' : 'text-text-primary hover:text-brand-accent'
            }`}
          >
            <input
              type="radio"
              name="theme"
              value={id}
              checked={choice === id}
              onChange={() => setChoice(id)}
              className="sr-only"
            />
            <Icon size={16} aria-hidden="true" />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** M7 optional strip: who is driving which In Progress tickets right now. */
function DrivingStrip({ tasks }) {
  const users = useUsers();
  return (
    <section aria-labelledby="driving-heading" className="mb-6">
      <h2 id="driving-heading" className="text-lg font-bold">
        Who's driving
      </h2>
      <ul className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {users.map((user) => {
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

/** A column's tickets in display order. */
const columnTasks = (tasks, status) =>
  tasks.filter((t) => t.status === status).sort((a, b) => a.position - b.position);

/**
 * M12: moves a ticket to `status` at `index`, renumbering positions in the columns it
 * leaves and enters. Used by drag-and-drop, keyboard dragging and the Move up/down buttons.
 */
export function moveTask(tasks, taskId, status, index) {
  const task = tasks.find((t) => t.id === taskId);
  const now = new Date().toISOString();
  const moved = {
    ...task,
    status,
    updatedAt: now,
    completedAt: status === 'done' ? task.completedAt ?? now : null,
  };
  const target = columnTasks(tasks, status).filter((t) => t.id !== taskId);
  target.splice(Math.max(0, Math.min(index, target.length)), 0, moved);

  const positions = new Map(target.map((t, i) => [t.id, i]));
  if (task.status !== status) {
    columnTasks(tasks, task.status)
      .filter((t) => t.id !== taskId)
      .forEach((t, i) => positions.set(t.id, i));
  }
  return tasks.map((t) => {
    const base = t.id === taskId ? moved : t;
    return positions.has(t.id) ? { ...base, position: positions.get(t.id) } : base;
  });
}

/** Where a ticket sits: its column, 0-based index and the column size. */
function locate(tasks, taskId) {
  const task = tasks.find((t) => t.id === taskId);
  const column = columnTasks(tasks, task.status);
  return { status: task.status, index: column.findIndex((t) => t.id === taskId), count: column.length };
}

const stageLabel = (status) => findById(STAGES, status)?.label ?? status;

/** "TASK-003 moved to Review, position 2 of 3." (DESIGN.md §5) */
function moveMessage(tasks, taskId) {
  const { status, index, count } = locate(tasks, taskId);
  return `${taskId} moved to ${stageLabel(status)}, position ${index + 1} of ${count}.`;
}

/**
 * Collapses or expands a set of tickets at once. It collapses until every ticket in the set is
 * collapsed, then offers to expand, so one press always does something visible.
 */
function CollapseAllButton({ ids, collapsedIds, onSetCollapsed, scope, compact = false }) {
  const allCollapsed = ids.length > 0 && ids.every((id) => collapsedIds.includes(id));
  const action = allCollapsed ? 'Expand all' : 'Collapse all';
  const Icon = allCollapsed ? ChevronsUpDown : ChevronsDownUp;
  return (
    <button
      type="button"
      disabled={ids.length === 0}
      onClick={() => onSetCollapsed(ids, !allCollapsed)}
      aria-label={scope ? `${action} in ${scope}` : undefined}
      title={compact ? `${action} in ${scope}` : undefined}
      className={`${iconButton} gap-2 ${compact ? '' : 'px-3 text-sm font-semibold'}`}
    >
      <Icon size={18} aria-hidden="true" />
      {!compact && action}
    </button>
  );
}

function Column({ stage, tasks, cardProps }) {
  const headingId = `column-${stage.id}`;
  // The column itself is a drop target, so empty columns can receive cards.
  const { setNodeRef, isOver } = useDroppable({
    id: `column:${stage.id}`,
    data: { type: 'column', status: stage.id },
  });
  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      className={`flex min-w-0 flex-col rounded-lg border bg-surface-page p-3 ${
        isOver ? 'border-brand-primary ring-2 ring-brand-primary' : 'border-surface-border'
      }`}
    >
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 id={headingId} className="flex items-center gap-2 text-lg font-bold">
          {stage.label}
          <span className="min-w-[2rem] rounded-full border border-surface-border bg-surface-card px-2 text-center text-sm font-semibold text-text-muted">
            {tasks.length}
            <span className="sr-only"> {tasks.length === 1 ? 'ticket' : 'tickets'}</span>
          </span>
        </h2>
        <CollapseAllButton
          ids={tasks.map((t) => t.id)}
          collapsedIds={cardProps.collapsedIds}
          onSetCollapsed={cardProps.onSetCollapsed}
          scope={stage.label}
          compact
        />
      </div>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        {tasks.length === 0 ? (
          <p className="mt-3 rounded-md border-2 border-dashed border-surface-border p-4 text-sm text-text-muted">
            No tickets in {stage.label} yet. Drag a ticket here or change its status.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {tasks.map((task, index) => (
              <SortableTaskCard
                key={task.id}
                task={task}
                isFirst={index === 0}
                isLast={index === tasks.length - 1}
                {...cardProps}
                justHandedOff={task.id === cardProps.recentHandOffId}
                collapsed={cardProps.collapsedIds.includes(task.id)}
              />
            ))}
          </ul>
        )}
      </SortableContext>
    </section>
  );
}

/**
 * Demo login (PRD §5 nice-to-have). There is no backend: accounts and the session live in
 * localStorage, so this shows the flow and the rules, not real security. Passwords are
 * still only ever stored as salted PBKDF2 hashes, never as plaintext.
 */
const PBKDF2_ITERATIONS = 100000;

const toHex = (buffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: PBKDF2_ITERATIONS },
    key,
    256,
  );
  return toHex(bits);
}

const newSalt = () => toHex(crypto.getRandomValues(new Uint8Array(16)));

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const MIN_PASSWORD_LENGTH = 8;

/** Sign in / create account screen, shown until someone is signed in. */
function LoginScreen({ users, onSignIn, onRegister }) {
  const [mode, setMode] = useState('signin');
  const isSignUp = mode === 'signup';
  const [form, setForm] = useState({ name: '', email: '', githubUsername: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const headingRef = useRef(null);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  function switchMode(next) {
    setMode(next);
    setErrors({});
    setForm((f) => ({ ...f, password: '', confirm: '' }));
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  function fillDemo(user) {
    setMode('signin');
    setErrors({});
    setForm((f) => ({ ...f, email: user.email, password: DEMO_PASSWORD }));
  }

  function validate() {
    const email = form.email.trim();
    const next = {};
    if (isSignUp && !form.name.trim()) next.name = 'Enter your name.';
    if (!isValidEmail(email)) next.email = 'Enter an email address like name@example.com.';
    else if (isSignUp && users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      next.email = 'An account with this email already exists. Sign in instead.';
    }
    if (isSignUp && form.password.length < MIN_PASSWORD_LENGTH) {
      next.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    } else if (!form.password) next.password = 'Enter your password.';
    if (isSignUp && form.confirm !== form.password) next.confirm = "Passwords don't match.";
    return next;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    const firstInvalid = Object.keys(found)[0];
    if (firstInvalid) {
      document.getElementById(`auth-${firstInvalid}`)?.focus();
      return;
    }
    setBusy(true);
    const email = form.email.trim();
    try {
      if (isSignUp) {
        const salt = newSalt();
        onRegister({
          id: `u-${Date.now()}`,
          name: form.name.trim(),
          email,
          githubUsername: form.githubUsername.trim().replace(/^@/, ''),
          roleId: 'role-dev',
          salt,
          passwordHash: await hashPassword(form.password, salt),
          createdAt: new Date().toISOString(),
        });
        return;
      }
      const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (user && (await hashPassword(form.password, user.salt)) === user.passwordHash) {
        onSignIn(user.id);
        return;
      }
      // Same message either way, so the form doesn't reveal which emails have accounts.
      setErrors({ form: 'Email or password is incorrect.' });
    } finally {
      setBusy(false);
    }
  }

  const fieldProps = (field) => ({
    id: `auth-${field}`,
    className: inputClass,
    value: form[field],
    onChange: set(field),
    'aria-invalid': errors[field] ? 'true' : undefined,
    'aria-describedby': errors[field] ? `auth-${field}-error` : undefined,
  });
  const fieldError = (field) =>
    errors[field] && (
      <p id={`auth-${field}-error`} className="mt-1 text-sm font-semibold text-due-overdue">
        <span aria-hidden="true">⚠ </span>
        {errors[field]}
      </p>
    );

  return (
    <div className="min-h-screen">
      <header className="border-b border-surface-border bg-surface-card">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-end justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <p className="text-[1.75rem] font-bold leading-tight text-brand-primary">Vibecoding Project Tracker</p>
            <p className="mt-1 text-sm text-text-muted">Track vibecoding tickets and the AI context behind them.</p>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto grid max-w-4xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-[1fr_18rem]">
        <section aria-labelledby="auth-heading" className="rounded-lg border border-surface-border bg-surface-card p-6 shadow-sm">
          <h1 id="auth-heading" ref={headingRef} tabIndex={-1} className="text-xl font-bold focus:outline-none">
            {isSignUp ? 'Create an account' : 'Sign in'}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {isSignUp ? 'New accounts join as Developers.' : 'Sign in to see your board.'}
          </p>

          <form onSubmit={handleSubmit} noValidate className="mt-4 flex flex-col gap-4">
            {errors.form && (
              <p role="alert" className="rounded-md border border-due-overdue bg-due-overdue-tint p-3 font-semibold">
                <span aria-hidden="true">⚠ </span>
                {errors.form}
              </p>
            )}
            {isSignUp && (
              <Field id="auth-name" label="Name">
                <input {...fieldProps('name')} type="text" autoComplete="name" />
                {fieldError('name')}
              </Field>
            )}
            <Field id="auth-email" label="Email">
              <input {...fieldProps('email')} type="email" autoComplete={isSignUp ? 'email' : 'username'} />
              {fieldError('email')}
            </Field>
            {isSignUp && (
              <Field id="auth-githubUsername" label="GitHub username (optional)">
                <input {...fieldProps('githubUsername')} type="text" autoComplete="off" />
              </Field>
            )}
            <Field
              id="auth-password"
              label="Password"
              hint={isSignUp ? `At least ${MIN_PASSWORD_LENGTH} characters.` : undefined}
            >
              <input
                {...fieldProps('password')}
                type="password"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
              />
              {fieldError('password')}
            </Field>
            {isSignUp && (
              <Field id="auth-confirm" label="Confirm password">
                <input {...fieldProps('confirm')} type="password" autoComplete="new-password" />
                {fieldError('confirm')}
              </Field>
            )}

            <button type="submit" disabled={busy} className={`${buttonPrimary} inline-flex items-center justify-center gap-2 disabled:opacity-70`}>
              {isSignUp ? <UserPlus size={20} aria-hidden="true" /> : <LogIn size={20} aria-hidden="true" />}
              {busy ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <p className="mt-4 text-sm">
            {isSignUp ? 'Already have an account? ' : 'New here? '}
            <button
              type="button"
              onClick={() => switchMode(isSignUp ? 'signin' : 'signup')}
              className="font-semibold text-brand-accent underline"
            >
              {isSignUp ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        </section>

        <aside aria-labelledby="demo-heading" className="rounded-lg border border-surface-border bg-surface-card p-6">
          <h2 id="demo-heading" className="text-lg font-bold">Demo accounts</h2>
          <p className="mt-1 text-sm text-text-muted">
            Password for each: <span className="font-mono">{DEMO_PASSWORD}</span>. Roles change what you can do.
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {USERS.map((user) => (
              <li key={user.id}>
                <button
                  type="button"
                  onClick={() => fillDemo(user)}
                  className="flex w-full items-center gap-3 rounded-md border border-surface-border p-2 text-left hover:border-brand-accent"
                >
                  <OwnerAvatar task={{ assignedUserId: user.id }} />
                  <span className="min-w-0">
                    <span className="block font-semibold">{user.name}</span>
                    <span className="block text-sm text-text-muted">{findById(ROLES, user.roleId)?.name}</span>
                  </span>
                  <span className="sr-only">: fill in this account</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </main>
    </div>
  );
}

/** Signed-in user, their role, and the sign-out button for the header. */
function AccountMenu({ user, onSignOut }) {
  return (
    <div className="flex items-end gap-3">
      <div className="flex items-center gap-2">
        <OwnerAvatar task={{ assignedUserId: user.id }} />
        <div className="text-sm">
          <p className="font-semibold">
            <span className="sr-only">Signed in as </span>
            {user.name}
          </p>
          <p className="text-text-muted">{findById(ROLES, user.roleId)?.name}</p>
        </div>
      </div>
      <button type="button" onClick={onSignOut} className={`${buttonSecondary} inline-flex items-center gap-2`}>
        <LogOut size={18} aria-hidden="true" />
        Sign out
      </button>
    </div>
  );
}

export default function App() {
  const [users, setUsers] = useLocalStorage('vibetracker.users', USERS);
  const [sessionUserId, setSessionUserId] = useLocalStorage('vibetracker.session', null);
  const currentUser = findById(users, sessionUserId);

  return (
    <UsersContext.Provider value={users}>
      {currentUser ? (
        <Tracker currentUser={currentUser} onSignOut={() => setSessionUserId(null)} />
      ) : (
        <LoginScreen
          users={users}
          onSignIn={setSessionUserId}
          onRegister={(user) => {
            setUsers([...users, user]);
            setSessionUserId(user.id);
          }}
        />
      )}
    </UsersContext.Provider>
  );
}

function Tracker({ currentUser, onSignOut }) {
  const users = useUsers();
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
  // Card moves are announced to screen readers only — a visual pop-up on every move was noise.
  const [moveAnnouncement, setMoveAnnouncement] = useState('');
  function announce(message) {
    // Clear first so repeating the same message is still announced.
    setMoveAnnouncement('');
    requestAnimationFrame(() => setMoveAnnouncement(message));
  }
  // Ticket that was just handed off; its card shows a "Handed off just now" note while the toast is up.
  const [recentHandOffId, setRecentHandOffId] = useState(null);
  // The toast stays while hovered or focused, so slower readers aren't rushed (WCAG 2.2.1).
  const [toastPaused, setToastPaused] = useState(false);
  useEffect(() => {
    if (!toast || toastPaused) return undefined;
    const timer = setTimeout(() => {
      setToast('');
      setRecentHandOffId(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [toast, toastPaused]);

  function dismissToast() {
    setToast('');
    setToastPaused(false);
    setRecentHandOffId(null);
  }

  function handOff(taskId, userId) {
    const user = findById(users, userId);
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
          aiUsageLog: withUsageLog(draft, null, now, currentUser.id),
          position: nextPosition(tasks, draft.status),
          createdBy: currentUser.id,
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
            aiUsageLog: withUsageLog(draft, t, now, currentUser.id),
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

  const canDelete = can(currentUser, PERMISSIONS.deleteTicket);
  const canEditDeliverables = can(currentUser, PERMISSIONS.editDeliverables);

  function deleteTask(id) {
    if (!canDelete) return;
    setTasks(tasks.filter((t) => t.id !== id));
    setToast(`${id} deleted.`);
    closeModal();
  }

  // M12: drag-and-drop. Pointer and keyboard sensors; the keyboard one moves between
  // positions and columns with the arrow keys.
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  // Board state before the drag, restored if the drag is cancelled with Esc.
  const dragSnapshot = useRef(null);
  // Announcements run outside React's render, so read the latest tasks from a ref.
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  /** Column + index that a drag is currently over, or null. */
  function dropTarget(list, over) {
    if (!over) return null;
    if (over.data.current?.type === 'column') {
      const status = over.data.current.status;
      return { status, index: columnTasks(list, status).length };
    }
    const overTask = list.find((t) => t.id === over.id);
    if (!overTask) return null;
    return { status: overTask.status, index: locate(list, over.id).index };
  }

  function handleDragStart() {
    dragSnapshot.current = tasks;
  }

  // Moving into another column happens live, so the card visibly joins it while dragging.
  function handleDragOver({ active, over }) {
    const target = dropTarget(tasks, over);
    const task = tasks.find((t) => t.id === active.id);
    if (!target || !task || task.status === target.status) return;
    setTasks(moveTask(tasks, active.id, target.status, target.index));
  }

  function handleDragEnd({ active, over }) {
    const target = dropTarget(tasks, over);
    if (!target) {
      handleDragCancel();
      return;
    }
    const next = moveTask(tasks, active.id, target.status, target.index);
    setTasks(next);
    announce(moveMessage(next, active.id));
  }

  function handleDragCancel() {
    if (dragSnapshot.current) setTasks(dragSnapshot.current);
  }

  function moveByOne(taskId, delta) {
    const { status, index } = locate(tasks, taskId);
    const next = moveTask(tasks, taskId, status, index + delta);
    setTasks(next);
    announce(moveMessage(next, taskId));
  }

  /** Button alternative to dragging between columns: drops the ticket at the bottom of `status`. */
  function moveToColumn(taskId, status) {
    const next = moveTask(tasks, taskId, status, columnTasks(tasks, status).length);
    setTasks(next);
    announce(moveMessage(next, taskId));
    // The card remounts in its new column, so put focus back on the same arrow there
    // (or the opposite one once it reaches the first/last column).
    const order = STAGES.map((s) => s.id);
    const forward = order.indexOf(status) > order.indexOf(locate(tasks, taskId).status);
    requestAnimationFrame(() => {
      const group = document.querySelector(`[role="group"][aria-label="Move ${taskId}"]`);
      const buttons = [...(group?.querySelectorAll('button') ?? [])];
      const preferred = forward ? buttons.at(-1) : buttons[0];
      const fallback = forward ? buttons[0] : buttons.at(-1);
      (preferred && !preferred.disabled ? preferred : fallback)?.focus();
    });
  }

  // Screen-reader guidance and live announcements while dragging (DESIGN.md §4).
  const accessibility = {
    screenReaderInstructions: {
      draggable:
        'To pick up a ticket, press Space. Use the arrow keys to move it: left and right change column, ' +
        'up and down change position. Press Space again to drop it, or Escape to cancel.',
    },
    announcements: {
      onDragStart: ({ active }) => {
        const { status, index, count } = locate(tasksRef.current, active.id);
        return `Picked up ${active.id}. ${stageLabel(status)}, position ${index + 1} of ${count}.`;
      },
      onDragOver: ({ active, over }) => {
        const target = dropTarget(tasksRef.current, over);
        if (!target) return `${active.id} is not over a column.`;
        const count = columnTasks(tasksRef.current, target.status).filter((t) => t.id !== active.id).length + 1;
        return `${active.id} is over ${stageLabel(target.status)}, position ${Math.min(target.index + 1, count)} of ${count}.`;
      },
      // The drop is announced by the hidden move announcer, so avoid saying it twice.
      onDragEnd: () => undefined,
      onDragCancel: ({ active }) => `Move cancelled. ${active.id} returned to where it was.`,
    },
  };

  // Tickets collapsed to just their title, saved per browser.
  const [collapsedIds, setCollapsedIds] = useLocalStorage('vibetracker.collapsed', []);
  function toggleCollapsed(taskId) {
    setCollapsedIds((ids) => (ids.includes(taskId) ? ids.filter((id) => id !== taskId) : [...ids, taskId]));
  }
  /** Collapses or expands several tickets at once (a column, or the whole board). */
  function setCollapsed(taskIds, collapse) {
    setCollapsedIds((ids) => {
      const rest = ids.filter((id) => !taskIds.includes(id));
      return collapse ? [...rest, ...taskIds] : rest;
    });
    const count = plural(taskIds.length, 'ticket');
    announce(`${count} ${collapse ? 'collapsed to titles only' : 'expanded'}.`);
  }

  // Which tab is showing; the board is the default so it stays the main focus.
  const [view, setView] = useLocalStorage('vibetracker.view', 'board');

  // M11: deliverable id → URL ('' when empty).
  const [anchors, setAnchors] = useLocalStorage('vibetracker.anchors', {});

  function saveAnchor(id, url) {
    if (!canEditDeliverables) return;
    setAnchors({ ...anchors, [id]: url });
    const { name } = findById(DELIVERABLES, id);
    setToast(url ? `${name} link saved.` : `${name} link removed.`);
  }

  return (
    <div className="min-h-screen">
      {/* WCAG 2.4.1 Bypass Blocks: first Tab stop, visible only when focused. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand-primary focus:px-4 focus:py-3 focus:font-semibold focus:text-on-fill"
      >
        Skip to main content
      </a>

      <header className="border-b border-surface-border bg-surface-card">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-end justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <h1 className="text-[1.75rem] font-bold leading-tight text-brand-primary">
              Vibecoding Project Tracker
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              Track vibecoding tickets and the AI context behind them.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <AccountMenu user={currentUser} onSignOut={onSignOut} />
            <ThemeToggle />
            <button
              ref={newButtonRef}
              type="button"
              className={`${buttonPrimary} inline-flex items-center gap-2 shadow-sm`}
              onClick={(e) => openModal(emptyDraft(), e.currentTarget)}
              aria-label="Create new ticket"
            >
              <Plus size={20} strokeWidth={2.5} aria-hidden="true" />
              New ticket
            </button>
          </div>
        </div>
      </header>

      {/* tabIndex -1 lets the skip link move focus here, not just scroll. */}
      <main id="main" tabIndex={-1} className="mx-auto max-w-[1600px] px-4 py-6 focus:outline-none sm:px-6">
        <ViewTabs
          active={view}
          onChange={setView}
          deliverablesLinked={DELIVERABLES.filter((d) => anchors[d.id]).length}
        />

        <div role="tabpanel" id="panel-deliverables" aria-labelledby="tab-deliverables" hidden={view !== 'deliverables'}>
          <AnchorBoard anchors={anchors} tasks={tasks} canEdit={canEditDeliverables} onSave={saveAnchor} />
        </div>

        <div role="tabpanel" id="panel-board" aria-labelledby="tab-board" hidden={view !== 'board'}>
          <DrivingStrip tasks={tasks} />

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-text-muted">
              {plural(tasks.length, 'ticket')}
              {collapsedIds.length > 0 && ` · ${tasks.filter((t) => collapsedIds.includes(t.id)).length} collapsed`}
            </p>
            <CollapseAllButton
              ids={tasks.map((t) => t.id)}
              collapsedIds={collapsedIds}
              onSetCollapsed={setCollapsed}
            />
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            accessibility={accessibility}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {STAGES.map((stage) => (
                <Column
                  key={stage.id}
                  stage={stage}
                  tasks={columnTasks(tasks, stage.id)}
                  cardProps={{
                    now,
                    onOpen: openModal,
                    onHandOff: handOff,
                    onCopied: setToast,
                    onMove: moveByOne,
                    onMoveColumn: moveToColumn,
                    recentHandOffId,
                    collapsedIds,
                    onToggleCollapsed: toggleCollapsed,
                    onSetCollapsed: setCollapsed,
                  }}
                />
              ))}
            </div>
          </DndContext>
        </div>
      </main>

      {editing && (
        <TaskModal
          task={editing}
          now={now}
          canDelete={canDelete}
          onSave={saveTask}
          onDelete={deleteTask}
          onClose={closeModal}
        />
      )}

      <p role="status" aria-live="polite" className="sr-only">
        {moveAnnouncement}
      </p>

      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4"
      >
        {toast && (
          <div
            onMouseEnter={() => setToastPaused(true)}
            onMouseLeave={() => setToastPaused(false)}
            onFocus={() => setToastPaused(true)}
            onBlur={() => setToastPaused(false)}
            className="pointer-events-auto flex items-center gap-3 rounded-lg border border-transparent bg-text-primary py-1 pl-4 pr-1 font-semibold text-on-fill shadow-lg motion-safe:animate-[fade-in_200ms_ease-out]"
          >
            <p>{toast}</p>
            <button
              type="button"
              onClick={dismissToast}
              aria-label="Dismiss message"
              className="inline-flex min-h-target min-w-target items-center justify-center rounded-md hover:bg-on-fill/15 focus-visible:outline-on-fill"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
