# Harness UI

Harness UI is the shared look of a suite of personal apps: dark by default, quiet neutrals, one neon signature hue per app, a mid-tone that joins the two, and typography that does the work decoration usually does.

This folder holds what code consumes: `tokens.css` and `ui.css`. Load `tokens.css` first. Both are plain CSS, so a React app and a server-rendered app use the same files. The hub owns this folder and sync delivers it to every project, so change it in `claude-harness-hub` only.

The live reference, with every token and component rendered in dark and light, is https://claude.ai/artifact/3oDGNem4W16ah61RnmcbQp. A change to a token or component goes to both places in the same piece of work. Load the two hosted faces from Google Fonts: Newsreader (400, 500) and JetBrains Mono (400, 500).

## What holds everywhere, and what an app decides

Six rules are the floor. They hold in every app with no exceptions.

1. Colour comes from tokens. No hex or oklch value in a component.
2. Text holds 4.5:1 on its ground in both themes. Text on an accent fill uses `on-accent`.
3. State is never shown by colour alone. A word, tick or icon goes with it.
4. Focus is always visible: a 2 px `focus` outline, offset 2 px.
5. Tappable controls are at least `touch-phone` (44 px) tall below 640 px.
6. Every screen is designed in dark and light, at phone and desktop width.

Everything else on this page is a default. An app follows it unless it has a reason not to, and writes that reason in one line in its own `docs/design-profile.md`.

An app always decides these for itself: its signature hue, its density preset, its own states, its content layouts, and any component this system does not have.

## Colour

Three layers, in fixed proportions. Neutrals carry about 85% of a screen, the mid-tone about 10%, the accent about 5%.

**Neutrals.** A zinc ramp with a slight cool bias. `bg` is the page, `surface` is anything that sits on it, `surface-raised` is anything that floats, `surface-sunken` is anything you type into. In dark mode, height is shown by a lighter surface, so shadows only support it. Never use pure black or pure white: `bg` and `text` stop short of both, which is what keeps dark mode from glaring.

**Accent.** Each app claims one signature hue from the neon set: `neon-violet`, `neon-magenta`, `neon-azure`, `neon-cyan`, `neon-lime`. Set it once with `data-accent` on `<html>`. Violet is the default. Components only ever read `accent`.

- In dark mode the accent is bright and its fill takes dark `on-accent` ink, like a lit sign. In light mode the same hue deepens and takes white ink.
- Spend the accent on four things: the primary button, links, the current navigation mark, and selection. Nothing else.
- `glow-accent` is the one glow. Use it on at most one element per screen. No gradients, no glowing text, no neon borders on ordinary cards.
- Two apps should sit at least 40° of hue apart, so the suite reads as a set.

**Mid-tone.** `mid`, `mid-line` and `mid-text` are the accent mixed into the neutrals: 20% into `surface-raised`, 40% into `line`, 50% into `text`. They soften the jump from gray to neon. Use them for hover fills, selected rows, quiet pills and informational notices. When an app changes its accent, `ui.css` derives its mid-tone with the same recipe.

**State.** `good`, `warn` and `bad` are fixed in every app and under every accent, each with a `-tint` fill. They are never used as an app's signature, and the accent is never used as a state.

## Typography

Three faces, three jobs. The contrast between them is the main visual device of the suite.

- **Display: Newsreader.** A serif, set large and light with tight tracking. Use `display-xl`, `display-lg` and `display-md` for the page title, section titles, dialog titles and the app name. One display title per screen is the loudest thing on it.
- **Text: the system sans.** Utilitarian on purpose, and free to load. Use `heading`, `body`, `body-compact` and `caption` for everything a person reads or operates.
- **Mono: JetBrains Mono.** Use `label` in uppercase for eyebrows above fields and sections, and `data` with tabular numerals for counts, dates, durations and IDs. This is where the technical character comes from.

Rules:

- Differentiate with face, size and weight before reaching for colour or a box.
- Never set body copy or controls in the display face. Never set a paragraph in mono.
- Semibold (600) is the only emphasis weight in the sans. The display face stays at 400 or 500.
- Keep running text within `measure` (68 characters). Give titles `text-wrap: balance`.
- Two density presets and nothing between: comfortable uses `body` (15 px), compact uses `body-compact` (13 px). Display and mono sizes do not change with density.

## Shape, depth and motion

- Radius follows role: `radius-control` for things you press or type in, `radius-card` for things that hold content or float, `radius-dialog` for modals, `radius-pill` for pills and dots.
- Borders separate surfaces before shadows do. Only floating surfaces take a shadow: `shadow-pop` for menus, popovers and toasts, `shadow-dialog` for dialogs.
- Every floating surface is the same object: `surface-raised`, a `line` border, `radius-card`, `shadow-pop`. Menu, Popover and Toast must look related.
- Spacing moves in 4 px steps from `space-1` to `space-12`. Lay out with gap, not margins.
- Motion is short and functional: `duration-fast` for hover and colour, `duration-enter` for surfaces arriving. Under `prefers-reduced-motion`, transitions turn off.

## Layout

- Design the phone screen and the desktop screen together. Neither is derived from the other at the end.
- Three breakpoints: `bp-sm` 640 px, `bp-md` 768 px, `bp-lg` 1100 px.
- Navigation is the AppShell: a sidebar from `bp-lg`, a bottom tab bar below it, the same destinations in both.
- A record's detail view is a split view from `bp-lg`, a slide-over from `bp-md`, and a bottom sheet on phones.
- A dialog is a centred card from `bp-sm` and a bottom sheet below it.
- The page body never scrolls sideways. Wide tables scroll inside their own container.

## Iconography

- Lucide only, as inline SVG so it works without React. Stroke 1.75, round caps and joins, no fills.
- 16 px inside controls and pills, 20 px in the tab bar and headers.
- Icons take the colour of their text. Only a state icon or the current navigation mark takes a colour of its own.
- The app icon is a rounded square filled with the app's accent, holding one lucide glyph in `on-accent`. No logo files exist yet, so the app name is set in the display face beside it.

## Interface fundamentals

- Missing data is shown as missing, in `text-faint`, with words: "Not known yet", "No date yet". Never a plausible default.
- Reversible actions happen at once and offer Undo in a Toast. Only irreversible ones open a confirming Dialog.
- A warning always carries its way forward as a button.
- An empty screen says it is empty and how to start. No sample data.
- Labels are sentence case and name the action: "Delete list", not "OK".
- One primary button per view.

## Components

Each component is a set of `ui-` classes in `ui.css`. Use them before building a new pattern. When an app needs a component that is not here, build it from the tokens, give it the same floating surface, radius and focus rules, and offer it back to the hub once a second app needs it.

### AppShell

The skeleton every app shares: a sidebar on wide screens and a bottom tab bar on phones.

You provide the app mark, the app name, up to five top-level destinations, and the page content.

- From 1100 px (`bp-lg`) the shell is `ui-sidebar` beside `ui-main`. Below it the sidebar is hidden and `ui-tabbar` sticks to the bottom.
- The same destinations appear in both, in the same order, with the same lucide icons. More than five destinations means the fifth tab is "More".
- The current destination sets `aria-current="page"`. Its icon takes `accent`. In the sidebar the row also takes `accent-tint`.
- The app mark is a rounded square at `radius-control`, filled with `accent`, holding one lucide glyph in `on-accent`. The favicon and home-screen icon use the same formula.
- The app name beside the mark is set in the display face.
- Every page opens the same way: an eyebrow, then one display title, then the content. That title is the only large type on the screen.
- Detail views follow the width: a split view from 1100 px, a slide-over from 768 px, a bottom sheet below that.
- The page body never scrolls sideways. The side gutter is `space-4` on phones.

### Button

The one text button, in four variants, plus the icon-only button and the inline link.

You provide the label, an optional leading lucide icon, and `type`. Write `type="button"` unless the button submits a form.

- `ui-btn ui-btn--primary`: the single most likely action in a view. One per view. Its fill is `accent` and its text is `on-accent`, never literal white.
- `ui-btn`: every other action. Hover moves it onto `mid`.
- `ui-btn ui-btn--ghost`: low-stakes actions such as Cancel.
- `ui-btn ui-btn--danger`: irreversible actions only. It is outlined in `bad`, never filled, so it cannot be mistaken for the primary.
- `ui-icon-btn`: icon only. `aria-label` is required and the same words go in `title`.
- `ui-link`: inline links inside running text.

Labels are a verb plus an object in sentence case: "Delete list", "Look again". Never "OK" or "Submit".

Height is `touch-phone` below 640 px and `touch-desktop` above. Do not set a height yourself.

### Field

A labelled text input with a help line beneath it.

You provide the label text, the input, and the help line. Give the input an `id` and point the label's `for` at it.

- The label is an eyebrow: mono, uppercase, `text-muted`. It sits above the input, never inside it.
- The input fill is `surface-sunken` and its border is `line-strong`, which holds 3:1 against the surface.
- A missing value shows a placeholder in `text-faint` that says so ("Not known yet"). Never prefill a guess.
- The help line carries save status ("Saving…", "Saved · just now", "Couldn't save · Try again") or a hint.
- An invalid field sets `aria-invalid="true"` and the help line switches to `ui-help--bad` with words that say how to fix it. The red border is never the only signal.
- Input text is 16 px on phones so the browser does not zoom, 14 px from 640 px up.

### Pill

A small rounded label for one short fact or state.

You provide the words and, for a state, its icon.

- `ui-pill`: neutral facts such as a media type.
- `ui-pill ui-pill--mid`: the app's own states that are neither good nor bad. This is the mid-tone at work.
- `ui-pill--good`, `ui-pill--warn`, `ui-pill--bad`: state. Each one always carries a word and an icon, so the colour is never the only signal.
- Never use `accent` for a pill. The accent means "this app" and "act here", not a state.

Define each app's states once, in one map of label, icon and tone, and render every pill from it.

### Notice

A message that stays in the page: a result, a caveat or a warning.

You provide the tone, the icon, the sentence, and the actions.

- Default tone sits on `mid`. Use it for plain information.
- `ui-notice--warn` and `ui-notice--bad` use `role="alert"`. The others use `role="status"`.
- A warning or error always offers the way forward as a button: "Save anyway", "Skip", "Try again". A notice that only complains is not finished.
- Say what failed in the person's terms. No "Oops", no "Something went wrong".
- Use a Toast instead when the message confirms something the person just did and needs no decision.

### Toast

A brief confirmation that floats above the page, with at most one action.

You provide the message and, when the action can be reversed, an Undo handler.

- Wrap toasts in `ui-toasts`, a polite live region fixed to the bottom centre. On phones it clears the tab bar and the safe area.
- A toast stays for `duration-toast` (6 seconds). At most three show at once. Hovering or focusing a toast pauses its timer.
- Reversible actions (archive, remove from a list) act at once and show a toast with Undo. Do not ask first.
- One action only. A toast that needs two buttons is a Dialog.
- Errors that need a decision go in a Notice, where they stay until dealt with.

### Dialog

A modal surface: a centred card from 640 px up and a bottom sheet below it.

You provide the title, the body, and the footer buttons. You also provide the behaviour: move focus inside on open, trap Tab, close on Escape and on a press outside, and return focus to the opener.

- Markup is `ui-scrim` wrapping `ui-dialog`, with `ui-dialog__head`, `__body` and `__foot`.
- The title is set in the display face. It is the one place inside a component where the display face appears.
- Use `role="dialog"` with `aria-modal="true"`. A confirmation uses `role="alertdialog"`.
- A confirmation is only for what cannot be undone. Its title is a question, its body says what is lost and what is kept, and its button names the action. The safe choice is the ghost button on the left.
- On phones the same markup becomes a sheet: full width, top corners at `radius-dialog`, bottom padding for the safe area, at most 90% of the screen height.
- The surface is `surface-raised`. In dark mode the lighter surface shows the height and the shadow only supports it.

### Menu

A dropdown list opened from a button that shows the current choice.

You provide the trigger label, the options, and the behaviour: arrow keys move, Home and End jump, Enter picks, Escape closes, and focus lands on the current option when it opens.

- The trigger is a `ui-btn` with `aria-haspopup="listbox"` and `aria-expanded`. Its label shows the current value and ends in a chevron.
- The list is `ui-menu` with `role="listbox"`. Each row is a `ui-menu-item` with `role="option"`.
- The chosen row sits on `mid` and carries a tick. The tick is the signal, the tint supports it.
- A hint on the right is set in mono, in `text-muted`.
- Rows are `touch-phone` tall on phones. Below 640 px a long menu opens as a Dialog sheet instead of a floating list.
- A menu of actions (not choices) uses the same surface with `role="menu"` and `role="menuitem"`, and no ticks.

### Popover

A small anchored panel for help text or a short form.

You provide the trigger, the content, and the behaviour: open on hover for a fine pointer, pin on tap or Enter, close on Escape or a press outside.

- The panel is `ui-popover`: the same raised surface, border, radius and shadow as Menu and Toast. All floating surfaces match.
- Keep it under about 40 words. Longer explanations belong in the page.
- This is where explanations go. Keep them off button labels and out of placeholder text.
- A tooltip is the smallest popover: the name of an icon-only control, shown on hover and focus, and for 1.5 seconds after a touch.

## Adopting it in a project

The system is a starting kit, not a gate. Nothing in the harness checks a project against it.

### A new project

1. Serve `.harness/design-system/tokens.css` and `.harness/design-system/ui.css`, or copy their text into the app's stylesheet module when the app cannot read files at run time. A copy carries a comment naming this folder as its source.
2. Set `data-accent` on `<html>` to the app's signature hue. Pick one at least 40° from the other apps.
3. Load Newsreader and JetBrains Mono.
4. Write `docs/design-profile.md`: the accent, the density preset, the voice warmth, the app's states (label, icon and tone for each), and any default the app departs from, with its reason.
5. Build the first screen from AppShell, Button and Field. Add other components when a change needs them.

### An existing project

Adopt on touch. When a change opens a screen, move that screen onto the tokens and the shared components in the same change. No migration project is needed.

### What stays free

- Content layouts: tables, card grids, timelines, whatever the data wants.
- App-only components. Build them from the tokens, and offer them back when a second app needs the same thing.
- Celebrations and warmth, set in the profile.
- A theme or accent picker. The system supports one and does not require it.

### What a profile may not change

The six floor rules at the top of the README.

### Current signature hues

| App | Hue today | Note |
| --- | --- | --- |
| LiveArchive | Violet | Keeps `neon-violet`. |
| Job Application Tracker | Indigo | 16° from violet. Too close to read as a different app. Azure or cyan would separate it. |
| Media Recommendation | Blue | Maps to `neon-azure`, unless Job Tracker takes it. |

## Appendix: product principles

These sit behind the visual rules. They are defaults, ranked: when two conflict, the earlier one wins. An app may reorder them in its profile.

1. **Never guess.** Missing data stays missing and is labelled. No default dates, ratings or places. Empty is a valid answer.
2. **Capture beats completeness.** Saving never waits on a network call, research or a slow step.
3. **Your word wins.** The app suggests and never overwrites what the person typed. A suggestion applies only on a tap.
4. **Slow and costly work runs separately.** Enrichment, research and AI calls start on an explicit press or a schedule, on data already saved. A failure there never undoes the save.
5. **Flag, don't block.** Duplicates and incomplete captures get a warning and a choice.
6. **Fewest steps in, structure out.** One line, one paste or one click captures. New fields go on the detail view.
7. **Reversible by default.** Act at once and offer Undo. Ask first only when it cannot be undone.
8. **Calm by default.** Neutral surfaces carry almost everything. Colour is reserved for meaning.
9. **Meaning survives any theme.** State never depends on the accent, on light or dark, or on colour alone.
10. **Delight from small, reliable moments.** No extra screens, no demo data.

Three more fit apps that mix sourced facts with a personal log. Adopt them by name.

- **Every fact has a source.** Each value can show where it came from.
- **The world and you are separate.** Shared facts and the personal log are stored and shown apart.
- **No hardcoded knowledge.** No lists of real-world names in code.

## Appendix: voice

Every app is plain, specific and honest. Warmth is the one thing that varies.

1. Speak to the person as "you", and about their things as "your".
2. Say what happened in their terms. "Saved as a new row" beats "Operation completed".
3. Ask when something is missing. "When was it?" beats "Date required".
4. Be honest about absence, without apology. "No source listed a lineup. Add the acts you saw below."
5. Errors say what failed and offer the retry. "Couldn't save · Try again". No "Oops", no "Sorry".
6. Name actions by what they do, in sentence case. Never "OK" or "Submit".
7. Keep labels short. Explanations go in a Popover.
8. Claim only what the app can back up.

Avoid praise for ordinary actions, filler ("Just", "Simply"), cute errors, emoji and hype.

| Warmth | Character | Exclamation marks | Celebrations |
| --- | --- | --- | --- |
| Plain | A capable assistant handing you a filled-in form | None | None |
| Warm | A friend who was there with you | Earned milestones only | Brief, and skipped under reduced motion |

Warm adds to the rules above and never loosens them.
