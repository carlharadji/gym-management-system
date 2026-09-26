# Gym Management System

A local-first member management application for a single gym branch. It replaces paper-based member records with a searchable database, automatic membership status calculation, and a straightforward dashboard for front-desk or manager use.

The full application is designed primarily to run on the gym's own computer and does not require cloud services. The separate portfolio demo is a static, sample-data build.

## Portfolio Demo

[Open the interactive demo](https://carlharadji.github.io/gym-management-system/). It uses fictional sample records stored only in your browser tab. You can add or edit members, renew memberships, check in members, and explore reports. Use **Reset sample data** to restore the starting state. No gym database or API key is deployed with the demo; its assistant uses local rule-based answers, not an LLM.

The full local-first application below uses the Node API and persistent SQLite storage. GitHub Pages only hosts the separate static demo build.

## Features

- Dashboard totals for all, active, and expired members
- Clickable dashboard cards that open filtered member lists
- Search by member number, name, email, discount type, or membership type
- Add, view, edit, and delete members
- Student and regular member categories
- Daily and monthly memberships with calculated expiration dates
- Automatic Active or Expired status based on the latest membership
- Membership updates that preserve prior membership history
- Persistent SQLite storage and optional sample data
- Member check-in with active membership validation and a five-minute duplicate guard
- Today's attendance, searchable attendance history, and member visit history
- Expiring membership counts and practical visit reports
- Read-only admin assistant for supported membership and attendance questions
- Responsive desktop-first interface suitable for tablets

> **Authentication note:** The current "System Admin" text is a UI label only. This version does not include login, authentication, or role-based authorization and should not be exposed directly to an untrusted network.

## Technology Stack

- React and TypeScript
- Vite
- Node.js HTTP server and REST API
- SQLite through Node's built-in `node:sqlite` module
- CSS and Lucide icons
- pnpm

## Prerequisites

- Node.js 22.12 or newer
- pnpm 10 or newer

The repository records the intended package manager version in `package.json`. If Corepack is available, run `corepack enable` before installation.

## Installation

```bash
git clone https://github.com/carlharadji/gym-management-system.git
cd gym-management-system
pnpm install
```

Optionally seed realistic sample records:

```bash
pnpm seed:sample
```

The seeder is idempotent and does not duplicate its sample member numbers.

## Local Development

Start the API and Vite development server together:

```bash
pnpm dev
```

Open `http://127.0.0.1:5173/`.

Individual commands are also available:

```bash
pnpm dev:api
pnpm dev:client
pnpm start:local
```

`pnpm start:local` starts detached local services for the existing desktop-shortcut workflow. Development is usually easier with `pnpm dev`, which keeps logs in the terminal.

## Checks and Build

```bash
pnpm typecheck
pnpm build
pnpm build:demo
pnpm test:smoke
```

After building, run the production-style local server with:

```bash
pnpm start
```

Then open `http://127.0.0.1:3001/`.

## Configuration

The server reads configuration from environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3001` | Local HTTP port for the API and built frontend |
| `DB_PATH` | `data/gym.sqlite` | Path to the SQLite database file |
| `CORS_ORIGIN` | local Vite origins | Optional comma-separated additional allowed browser origins |
| `OPENAI_API_KEY` | unset | Optional backend-only key for AI-selected data operations |
| `OPENAI_MODEL` | `gpt-4.1-mini` | Optional model name when the API key is configured |

PowerShell example:

```powershell
$env:PORT = "3100"
$env:DB_PATH = "C:\\gym-data\\gym.sqlite"
pnpm start
```

Database files are local runtime data and are intentionally excluded from Git. Back them up separately before moving computers or making operational changes.

The assistant works without a key for common supported questions through local matching. With `OPENAI_API_KEY` set on the server, an AI model selects one of seven fixed read-only operations and receives that operation's structured result to compose its answer. The key stays on the backend; the question and relevant result data are sent to the AI provider. No model-generated SQL is executed. This app still has no authentication, so keep it on the trusted local machine.
