# Contributing to waycairn

waycairn is early-stage and active. Issues and PRs are welcome.

## Setup

```
npm install
```

This also installs the `ui` workspace (the diagram viewer).

## Running tests

```
npm test
```

Runs `tsc --noEmit` (typecheck) followed by the vitest suite. Both must
pass before a PR is merged; CI runs this on every push and PR.

## Commit conventions

This repo uses [Conventional Commits](https://www.conventionalcommits.org/):
`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:`. Look at `git log`
for examples. Keep the subject line short and in the imperative mood
("add X", not "added X").

## Making a PR

1. Fork the repo and create a branch off `main`.
2. Make your change, keeping it focused — unrelated fixes belong in their
   own PR.
3. Make sure `npm test` passes locally.
4. Open a PR describing what changed and why. Link any related issue.
