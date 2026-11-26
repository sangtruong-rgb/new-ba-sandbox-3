# Taste: Việc (todo-v1)

## Direction

- **Users and use:** one person, several times a day, on a laptop and a phone.
- **The one thing they look at most:** what is late and what is due today.
- **Direction:** "Mực xanh": cool white paper and navy ink; Literata serif for the app name, the date and the detail heading; Be Vietnam Pro for everything else; one ink-blue accent for actions; red only for what is late and for errors; the list and the detail side by side.
- **References and what was taken from each:** none. Direction A of three new ones the BA drew; Claude chose it on the user's behalf on 2026-11-26.
- **Themes:** light and dark, following the system.

## Tokens

| Token | Light | Dark |
|---|---|---|
| `--bg` | #f5f6f8 | #0e1320 |
| `--paper` | #ffffff | #151b2b |
| `--ink` | #16213a | #e6e9f2 |
| `--muted` | #566075 | #a1aabe |
| `--accent` | #1f4fd1 | #7da2ff |
| `--accent-ink` (text on an accent button) | #ffffff | #0e1320 |
| `--late` (late and errors) | #b4361c | #ff8a6b |
| `--line` | #dfe3ea | #28314a |
| `--brand` (sign-in brand panel) | #16213a | #1b2338 |
| `--brand-ink` | #f5f6f8 | #e6e9f2 |

- **Accent means:** the main action, the chosen tab, a checked task. `--late` means late (the due text and the title of a late task) or an error. Nothing else is coloured.
- **Type:** Literata 600 / Be Vietnam Pro 400, 600, from `@fontsource/literata` and `@fontsource/be-vietnam-pro`; scale 13 / 15 / 22 / 28 / 36 (56 on the brand panel)
- **Spacing:** 4 / 8 / 12 / 16 / 24 / 32
- **Radius:** 6 for fields and buttons; round for the task checkbox
- **Motion:** none
- **Breakpoint:** 1100px: list and detail side by side at and above, one column below

## Banned defaults

| id | Banned | Instead |
|---|---|---|
| B1 | Inter, Roboto, Arial or the system font as the face of the product | Literata + Be Vietnam Pro, embedded |
| B2 | Purple, indigo or blue-to-purple gradients; gradient text; glow | Flat colour from the tokens |
| B3 | A grid of identical rounded cards, each with an icon, a bold title and two lines | A ruled list |
| B4 | Everything centred, a narrow column with empty sides at 1440 | List and detail; the sign-in pages split 40 / 60 with an ink brand panel |
| B5 | Emoji as icons; icons in tinted tiles | No icons |
| B6 | Lorem ipsum, "John Doe", "Acme", "Item 1" | Vietnamese tasks real people write |
| B7 | Pastel badges and tinted banners on everything | Colour only where it means something |
| B8 | Shadows on every surface, a card inside a card | Lines and paper, no shadows |
| B9 | Dark mode as inverted light: pure black, grey-on-grey text | A navy night surface with its own contrast |
| B10 | Oversized padding and type on a working screen | Compact rows; the due time once per row |
| B11 | Generic empty states ("No items yet") with a clip-art illustration | An empty state that says what to do first |
