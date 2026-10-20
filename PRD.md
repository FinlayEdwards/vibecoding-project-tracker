# Vibecoding Project Tracker — PRD

**Status:** Reviewed for a solo project. This PRD captures the requirements for the hackathon build and the public assessment demo.

---

## 1. Problem

Vibecoding work is easy to lose track of: tickets move between stages, deadlines approach, and the AI conversations that produced working code are hard to recover. A general project tool does not make AI context a first-class part of a ticket.

The tracker gives the developer one place to manage work, see urgency, and resume an AI-assisted task from its saved context.

## 2. Target users

- **Primary:** the solo developer managing their vibecoding projects.
- **Assessment users:** evaluators opening the public demo, which should contain sample data and be usable without setup.

The data model allows assignment to an individual and/or a team so it can support collaborative use later, while this project is currently developed as a solo task.

## 3. Product overview

A web app with a four-column Kanban board and a deliverable area. Each ticket has a permanent human-readable ID, an owner and/or team assignment, due date, type, status, and Markdown AI context. The context renders for reading and can be copied as a complete handoff block for a new AI session. AI tool usage is recorded per ticket, preferably as a history.

The deployed assessment demo is seeded with sample users, roles, tickets, and AI tools so it is not empty.

## 4. Primary user flow

1. Open the app and see the board and deliverables.
2. Create a ticket; the app assigns its next unique `TASK-###` ID.
3. Set its type, status, individual and/or team assignment, due date, AI context, AI tool usage, and deliverable link.
4. Move the ticket through To Do, In Progress, Review, and Done; its urgency state updates from the due date.
5. Read the rendered Markdown context or copy a paste-ready block containing the ticket ID, title, status, AI tool, and raw context.
6. Use the copied block to continue development in a new AI session.

## 5. Functional requirements

- Tickets have unique, automatically generated, human-readable IDs such as `TASK-001`. An ID is immutable and is never reused, including after a ticket is deleted.
- Tickets can be assigned to an individual user, a development team, or both.
- Every ticket can have a due-by date.
- Every ticket has an AI context field stored as Markdown and rendered on display.
- Record the AI tool used on a ticket. Prefer an append-only usage history over a single current value.
- Provide one-click copy of the raw Markdown context. The paste-ready block includes ticket ID, title, status, AI tool, and context.
- Each ticket can link to a deliverable. The exact deliverable fields and relationship remain a design detail to settle during implementation; see §8.
- User accounts store name, unique email, GitHub username, and role. Login is a nice-to-have: email/password or GitHub OAuth.
- Include a unique interaction, such as drag-and-drop with column ordering.
- Seed the public demo with sample users, roles, tickets, and AI tools.

## 6. Data model

```text
User: user_id, name, email (unique), github_username, role_id,
      password_hash or auth_provider_id (if login is implemented), created_at

Role: role_id, name, permissions (optional)

Team: team_id, name
TeamMember: team_id, user_id                     # many-to-many

Ticket: ticket_id (human-readable immutable PK, e.g. TASK-001),
        title, description, type (bug / safe_change),
        status (To Do / In Progress / Review / Done),
        assigned_user_id (nullable), assigned_team_id (nullable),
        due_date, ai_context (Markdown text), ai_tool_id (nullable),
        deliverable_id (nullable / placeholder), position,
        created_by, created_at, updated_at, completed_at (nullable)

AITool: ai_tool_id, name (Claude, ChatGPT, Copilot, Cursor, Lovable, Bolt),
        version_or_model (optional)

AIUsageLog (preferred): log_id, ticket_id, ai_tool_id, used_by,
                        context_snapshot (Markdown), logged_at

Deliverable (placeholder): deliverable_id, name, description,
                           other fields to be decided
```

`urgency_state` is derived, not stored, from `due_date` and the current date. Ticket ID allocation must remain monotonic or otherwise retain deleted IDs so an ID can never be reused. `ai_tool_id` may represent the current/most recent tool; `AIUsageLog` preserves usage history.

## 7. Technical and delivery decisions

| Area | Requirement / decision |
|---|---|
| Framework | React via Vite, as provided by the starter. |
| Styling | Tailwind, as configured in the starter. |
| Hackathon operation | No deployment is needed to complete the hackathon build. |
| Assessment | The finished demo must be available at a public URL for Fernando's assessment. The URL is pending deployment. |
| Persistence | Keep the implementation proportionate to the hackathon. Seed the deployed demo; choose storage that preserves the required behavior in the assessment environment. The starter's localStorage approach is acceptable for a single-browser prototype, but does not provide shared accounts or data across browsers. |
| Authentication | Nice to have. If implemented, use email/password or GitHub OAuth; store password hashes, never plaintext passwords. |

## 8. Deliverables and open detail

Tickets link to a deliverable, but the exact deliverable catalog and fields are still to be decided. The starter's four anchor slots—Presentation, Demo, Report, and Documentation—are a useful initial proposal, not a locked schema. Keep the relationship extensible until the deliverable requirements are settled.

## 9. Board workflow

The board has four columns with these exact labels:

1. **To Do**
2. **In Progress**
3. **Review**
4. **Done**

Tickets can be reordered within columns. The selected unique interaction should be visible in the demo; drag-and-drop with column ordering is the current example.

## 10. Visual design, accessibility, and security

- Bugs and safe changes are distinct through an icon plus color or pattern; color alone is insufficient.
- Due-date states cover overdue, due within 24 hours, due within 3 days, and on track. Thresholds are configurable constants.
- Each urgency/color state has a text label and icon. Done tickets should have a clear completed state.
- Meet WCAG AA contrast, support full keyboard navigation, and provide screen-reader labels and appropriate ARIA attributes.
- Keep a short design-decision log that maps choices to usability principles.
- Security is not a critical hackathon focus. If accounts are implemented, hash passwords and provide basic role-based access control.

## 11. Solo project details

- **Mode:** solo development; team roster and milestone ownership assignments do not apply.
- **Project owner:** the person developing this repository.
- **Project name and tagline:** use the product name, Vibecoding Project Tracker; a separate tagline is optional for this solo task.
- **Public assessment URL:** pending deployment.

## 12. Scope and priorities

**Core:** ticket IDs, board workflow, assignment fields, due dates and urgency, Markdown context display, copy handoff block, AI tool tracking, deliverable link, accessibility requirements, and seeded demo data.

**Nice to have:** account login and detailed role-based permissions. A public assessment deployment is required for assessment, though deployment is not required to complete the hackathon build itself.

## 13. Definition of done

- Tickets support the required fields and workflow, and IDs remain unique and are never reused.
- AI context renders as Markdown and the one-click copy produces the specified handoff block.
- AI tool usage is recorded, preferably as a history.
- Bug/safe-change and urgency states are distinguishable without relying on color alone.
- Keyboard operation, screen-reader labels, ARIA attributes, and WCAG AA contrast are addressed.
- A unique interaction is demonstrated and design decisions are briefly documented against usability principles.
- The deployed public assessment demo is seeded and opens with sample users, roles, tickets, and tools.
- Login may be omitted if time does not permit it.

---

*PRD version: solo requirements update · derived from the hackathon starter and project-owner requirements.*
