---
name: teacher-planner
description: Read and write the Teacher Planner app's Firestore database directly. Use whenever the user asks to add, list, update, complete, or delete tasks, projects, key dates, ideas, or routine tasks in their planner — e.g. "add a task to mark Year 9 books", "create a project for the school play", "what tasks do I have this week", "mark the reports task as done", "add a key date for parents evening".
---

# Teacher Planner Firestore Skill

This skill writes directly to the same Firestore database the Teacher Planner
app uses, so anything created here appears in the app immediately (the app
re-fetches on load/refresh).

All operations go through one script:

```bash
node .claude/skills/teacher-planner/scripts/planner.mjs <command> [options]
```

Run it with no arguments to see full usage. Output is always JSON:
`{"ok":true,...}` on stdout, or `{"ok":false,"error":"..."}` on stderr.

## Setup (first run only)

The script authenticates with a Firebase **service account key**. If it exits
with "No service account key found", walk the user through this once:

1. Open [Firebase Console](https://console.firebase.google.com/project/school-apps-52c7d/settings/serviceaccounts/adminsdk) → Project settings → Service accounts.
2. Click **Generate new private key** and download the JSON file.
3. Save it as `.claude/skills/teacher-planner/service-account.json` (this path
   is gitignored — never commit it), or set the env var
   `TEACHER_PLANNER_SERVICE_ACCOUNT` to its path.

The script needs network access to `oauth2.googleapis.com` and
`firestore.googleapis.com`.

## Commands

| Intent | Command |
|---|---|
| Show projects | `list-projects` |
| Show open tasks | `list-tasks` (add `--all` to include completed, `--project <name>`, `--status <status>`) |
| Show calendar/key dates | `list-keydates [--from YYYY-MM-DD] [--to YYYY-MM-DD]` |
| Show ideas / routines / categories | `list-ideas`, `list-routines`, `list-categories` |
| Create a project | `add-project --name <name> [--description <text>] [--category <name>]` |
| Create a task | `add-task --title <t> [--project <name>] [--priority High\|Medium\|Low] [--scheduled YYYY-MM-DD] [--deadline YYYY-MM-DD] [--description <text>]` |
| Create a calendar event | `add-keydate --title <t> --date YYYY-MM-DD [--time HH:MM] [--notes <text>]` |
| Capture an idea | `add-idea --text <t> [--project <name>]` |
| Create a recurring routine | `add-routine --title <t> --type daily\|weekly [--days Mon,Wed,Fri] [--priority ...]` |
| Mark task done | `complete-task --id <task_id>` |
| Edit a task | `update-task --id <task_id> [--title ...] [--status ...] [--priority ...] [--scheduled ...] [--deadline ...] [--project ...]` |
| Delete something | `delete --type task\|project\|keydate\|idea\|routine --id <id>` |

## Conventions and gotchas

- **Dates**: always `YYYY-MM-DD`. Resolve relative dates ("tomorrow", "next
  Friday") to a concrete date yourself before calling — check today's date
  with `date +%F` if unsure.
- **Projects by name**: `--project` accepts a project name (case-insensitive,
  unique-substring match) or id. If the script reports an ambiguous/unknown
  project, it lists the available names — pick the right one or ask the user.
  A task with no `--project` is a standalone "global" task, which is fine.
- **Updating/completing/deleting needs an id**: run the relevant `list-*`
  command first and match by title. If several tasks could match what the
  user said, ask rather than guessing.
- **Defaults**: tasks start as `Uncompleted` with `Medium` priority; key dates
  without `--time` are all-day events. Don't ask the user for fields they
  didn't mention — defaults are correct.
- **Quoting**: titles and descriptions usually contain spaces — always quote
  them in the shell command.
- Weekly routines require `--days` (day names or 0=Sun..6=Sat numbers).
- **Bulk requests** ("add these five tasks"): just call `add-task` once per
  task.
- After a write, confirm to the user what was created/changed using the
  script's JSON output (it echoes the created document). No need to re-list
  to verify.

## Data model reference (matches `types.ts` in this repo)

Collections: `teacher_planner_projects`, `teacher_planner_tasks`,
`teacher_planner_categories`, `teacher_planner_key_dates`,
`teacher_planner_ideas`, `teacher_planner_routine_tasks`. Documents are stored
with their `id` field as the document ID. The script already produces
app-compatible documents — only touch Firestore through the script, not with
ad-hoc REST calls, so the shapes stay consistent with the app.
