# Stitch Project — Screen Designs

Reference for the [Google Stitch](https://stitch.withgoogle.com) project that holds the initial UI designs for this app. Generated from `docs/screens.md` via the Stitch MCP server.

## Project

| Field | Value |
|---|---|
| Title | Household Shopping List |
| Project ID | `6429965739002496495` |
| Resource name | `projects/6429965739002496495` |
| URL | <https://stitch.withgoogle.com/projects/6429965739002496495> |
| Device type | Mobile (375px viewport) |
| Design system | Warm Domesticity |

## Design System — Warm Domesticity

| Token | Value |
|---|---|
| Primary (sage green) | `#6B8E6D` |
| Secondary (terracotta) | `#E68A6E` |
| Background (cream) | `#fafaf5` |
| Color mode | Light |
| Color variant | Fidelity |
| Roundness | Round 8 (with pill-shaped primary buttons) |
| Headline / body / label font | Plus Jakarta Sans |
| Spacing scale | Normal (container-padding 20px, gutter 16px) |

## Screens

| Screen | Title in Stitch | Screen ID |
|---|---|---|
| Sign-In | Sign In - Household | `5329fd08f7884485b62a423f937d19fe` |
| Shopping List (home) | Shopping List - Household | `457d10352e2f40aab6232ad277d56be1` |
| Add One-Off Item modal | Add Item Modal - Household | `4ab3428c15844458ba6089317f4e970b` |
| Staples | Staples - Household | `391e518de1b14604b62255023645908e` |
| Add / Edit Staple modal | Edit Staple Modal - Household | `505a9ccbf7894b788eb835dcfa78c8f6` |
| Household Settings | Household Settings | `d45223d119704aee84afcb3feaa8d88e` |
| Pending Invite | Pending Invite | `7d31009286c24e09b3787380cfab1ac0` |

Resource name format for any tool that needs it: `projects/6429965739002496495/screens/{screen-id}`.

## Working with Stitch via MCP

The `user-stitch` MCP server exposes tools for iterating on these designs without leaving the editor. Useful ones:

- `get_screen` — fetch a single screen (returns screenshot + HTML download URLs).
- `list_screens` — list all screens in the project.
- `edit_screens` — apply a text-prompt edit to one or more existing screens.
- `generate_variants` — create style variants of an existing screen.
- `generate_screen_from_text` — add a brand-new screen from a prompt.
- `update_design_system` — tweak the shared Warm Domesticity tokens (re-applies to all screens).
