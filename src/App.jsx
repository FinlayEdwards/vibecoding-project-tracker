import { useState, useEffect } from 'react';

/**
 * Vibecoding Project Tracker.
 *
 * Data model follows PRD §6; visual tokens follow DESIGN.md / tailwind.config.js.
 *
 * Build sequence (Phase 3):
 *   - M4  data-model    : four columns + seeded tickets.            ✓
 *   - M5  crud-modal    : add the "+" button modal and the edit-on-click modal.
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

function TaskCard({ task }) {
  const assignee = assigneeLabel(task);
  return (
    <article
      aria-labelledby={`${task.id}-title`}
      className="rounded-md border border-surface-border bg-surface-card p-4"
    >
      <p className="font-mono text-sm text-text-muted">{task.id}</p>
      <h3 id={`${task.id}-title`} className="mt-1 text-base font-semibold leading-snug">
        {task.title}
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

function Column({ stage, tasks }) {
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
              <TaskCard task={task} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function App() {
  const [tasks] = useLocalStorage('vibetracker.tasks', seedTasks);
  // Monotonic counter for the next ticket ID — never decremented, so deleted IDs are never reused (PRD §6).
  const [nextTaskNumber] = useLocalStorage('vibetracker.nextTaskNumber', 5);

  // TODO M5 crud-modal:
  //   const [editing, setEditing] = useState(null);
  //   New tickets take formatTaskId(nextTaskNumber), then increment the counter.
  //
  // TODO M11 anchors:
  //   const [anchors, setAnchors] = useLocalStorage('vibetracker.anchors', [...]);

  return (
    <div className="min-h-screen p-4 sm:p-6">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-[1.75rem] font-bold text-brand-primary">
            Vibecoding Project Tracker
          </h1>
          <p className="text-sm text-text-muted">
            Track vibecoding tickets and the AI context behind them.
          </p>
        </div>
        {/* TODO M5 crud-modal: "+ New ticket" button. */}
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
            />
          ))}
        </div>
      </main>
    </div>
  );
}
