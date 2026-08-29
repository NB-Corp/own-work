<div align="center">

# Own Work

**Tasks, roadmaps, and specs that survive the session.**

[![ci](https://github.com/NB-Corp/own-work/actions/workflows/ci.yml/badge.svg)](https://github.com/NB-Corp/own-work/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22.13-brightgreen.svg)](https://nodejs.org)

[Install](#install) · [absorb-anything (study half)](https://github.com/NB-Corp/absorb-anything)

</div>

---

Own Work is a local-first CLI for tracking what you build. It exists because the chat scrollback has quietly become a system of record: the task list lives in a conversation, the acceptance criteria live in a prompt, and both evaporate at the next session. Own Work keeps them where they belong — plain files with stable ids, owned by your repo.

```bash
ownwork init                                           # one .absorb/ folder, right in your repo
ownwork task create --title "Port the scheduler"       # one durable outcome, one Task
ownwork roadmap create --title "Pulse-level control"   # an intended outcome, not a work plan
ownwork system register ./packages/engine --primary    # what you are actually building
```

> Status: 0.1.0, pre-release, not on npm yet. Build from source with the steps below. The commands above are the committed surface for the first release, and every one of them is run against the CLI before it ships.

## Install

Requires Node >= 22.13 and pnpm 11. Own Work builds against its sibling [`absorb-anything`](https://github.com/NB-Corp/absorb-anything), so clone both next to each other:

```bash
git clone https://github.com/NB-Corp/absorb-anything
git clone https://github.com/NB-Corp/own-work
cd absorb-anything && pnpm install && pnpm build && cd ..
cd own-work && pnpm install && pnpm build
```

The CLI is now at `packages/own-work/dist/cli.js`. Put it on your PATH however you like — an alias is enough:

```bash
alias ownwork="node $PWD/packages/own-work/dist/cli.js"
```

## A Task is one outcome, not one attempt

The reason a task list needs a CLI instead of a checkbox file is identity. When you abandon an approach and start over, that is the same Task on its second attempt — not a new row. When a session ends and the context is gone, the id is what the next session (or the next agent) resolves against.

```console
$ ownwork task create --title "Port the scheduler"
Task: task-0001-port-the-scheduler
Path: .absorb/tasks/task-0001-port-the-scheduler
Title: Port the scheduler
Status: active
Revision: 0
Archived: no

PRD:
# Port the scheduler

## Goal

Port the scheduler

## Acceptance Criteria

- [ ] The intended outcome is complete and backed by recorded verification evidence.

Handoff: (none)
Hint: One durable outcome is one Task; a new attempt at the same outcome is not a new Task.
```

The PRD is a real file on disk from the moment the Task exists, pre-seeded with an acceptance criterion you are expected to replace. It is yours to edit in your editor; the CLI reads it back rather than owning it.

Lifecycle never propagates by accident. Finishing a Task accepts nothing above it, and linking two Tasks transfers no authority between them — the link records that they are related, not that one now owns the other's fate.

## A Roadmap item is an outcome, not a plan

Roadmap items answer "what should become true," and Tasks answer "what are we doing about it." Keeping those separate is why a roadmap survives a change of approach: you can throw away every Task under an item without touching the item itself.

```bash
ownwork roadmap create --title "Pulse-level control"
ownwork roadmap link-task roadmap-0001-pulse-level-control --task task-0001-port-the-scheduler
```

Linking writes nothing into the Task. A finished Task does not mark the roadmap item delivered; someone still has to decide that.

## A Spec outlives the work that produced it

The constraint you discovered while building is the part worth keeping, and it is the first thing lost when the task is archived. `spec promote` moves it out of the work and into an addressable record:

```bash
ownwork spec create --title "Scheduler timing contract" --scope project --strength required
ownwork spec promote --title "Scheduler timing contract" --scope project --strength required \
  --body contract.md --from-task task-0001-port-the-scheduler --task-file prd.md
```

Activating a Spec validates that it is structurally complete. That is not the same as agreeing with it, and the CLI will not let the two be confused.

## The System registry says what you are actually building

A workspace can track several codebases; exactly one of them is primary. The registry records where each lives and which is current, so "the project" resolves to a directory instead of an assumption.

```bash
ownwork system register ./packages/engine --primary
ownwork system list
```

## It is just files

```text
.absorb/
  tasks/task-0001-port-the-scheduler/
    task.json      # id, status, revision, relations
    prd.md         # goal and acceptance criteria, yours to edit
  project/
    roadmap/roadmap-0001-pulse-level-control/
    specs/spec-0001-scheduler-timing-contract/
  systems-registry.json
  events/2026-08.jsonl
```

No server, no database, no account. `task.json` carries the identity and the revision that makes concurrent writes safe; everything else is text you can read in a diff. The whole state of the project is reviewable in a pull request, and it belongs to the repo it describes.

## Part of a pair

Own Work is the build half of a two-tool suite. [`absorb-anything`](https://github.com/NB-Corp/absorb-anything) is the study half: it turns whatever you study — code, papers, reference projects — into durable evidence, on the same on-disk workspace format. Use Own Work alone if you only need execution tracking, or run both over one `.absorb/` directory when decisions should trace back to the evidence behind them.

**Absorb anything. Build Your Own.**

## License

MIT.
