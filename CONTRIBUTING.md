# Contributing to Anime Tracker

Thanks for your interest in contributing! Anime Tracker is an open-source anime watchlist tracker with a Chrome extension and a Next.js web app.

## Getting Started

See [docs/getting-started.md](docs/getting-started.md) for setup instructions for both the web app and Chrome extension.

## How to Contribute

1. **Fork** the repository
2. **Create a branch** from `main`:
   - `feature/your-feature` for new features
   - `fix/description` for bug fixes
   - `docs/description` for documentation changes
3. **Make your changes** and commit
4. **Open a pull request** targeting `main`

## Development Workflow

- A **pre-commit hook** (via Husky) runs Vitest with coverage on every commit
- Coverage must stay above **80%** (we aim for 90%+)
- Never use `--no-verify` to skip the hook -- fix the issue instead
- When adding new files in `lib/`, add corresponding tests

### Running Tests

```bash
cd web
npx vitest run           # run all tests
npx vitest run --coverage # with coverage report
```

## Code Style

### Web App (`web/`)

- **TypeScript** throughout
- **Tailwind CSS v4** for styling (dark theme only)
- Client components use the `'use client'` directive
- No em-dashes in user-facing strings (use colons, commas, or periods instead)
- Default to writing no comments -- only add one when the "why" is non-obvious

### Chrome Extension (`ext/`)

- **Vanilla JS** with ES modules (`import`/`export`)
- No build step, no TypeScript, no framework
- No external dependencies

### General

- Prefer editing existing files over creating new ones
- Don't add error handling for scenarios that can't happen
- No premature abstractions -- three similar lines is better than a helper nobody needs yet

## Pull Request Process

1. **Describe what changed and why** in the PR description
2. **Include screenshots** for UI changes
3. **Tests must pass** (the pre-commit hook enforces this)
4. One approval from a maintainer is required before merging

## Reporting Bugs

Open a [GitHub issue](https://github.com/Samyc2002/AnimeTracker/issues) with:

- What happened vs. what you expected
- Browser and device info
- Screenshot or screen recording if it's a UI issue

## Feature Requests

Open a [GitHub issue](https://github.com/Samyc2002/AnimeTracker/issues) with the **enhancement** label. Describe the use case, not just the solution.

## Project Structure

| Directory | What it is |
|-----------|-----------|
| `ext/` | Chrome Extension (Manifest V3, vanilla JS) |
| `web/` | Next.js web app (TypeScript, Tailwind, Supabase) |
| `functions/` | Netlify scheduled/background functions |
| `docs/` | Contributor documentation |
| `scripts/` | Admin scripts (gitignored) |

See the [docs/](docs/) folder for detailed guides on [architecture](docs/architecture.md), the [web app](docs/web-app.md), the [extension](docs/extension.md), [database](docs/database.md), and [data providers](docs/providers.md).
