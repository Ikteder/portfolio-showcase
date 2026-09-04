# Decision 0001: Separate static showcase

Date: 2026-09-04

## Decision

Build the interactive experience as a sibling project using plain HTML, CSS, and JavaScript.

## Why

- It leaves the established portfolio and its root GitHub Pages deployment untouched.
- It can be reviewed locally before any public publishing action.
- It has no dependency installation or build pipeline, reducing maintenance and deployment risk.
- It can later be published as a GitHub project site or connected from the primary portfolio.

## Trade-off

The project intentionally favors a focused, hand-authored showcase over a reusable component framework.
