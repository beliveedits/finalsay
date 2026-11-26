# Finalsay brand kit

Version 0.1, 26 November 2026. The same content, with live examples, is in `brand-guide.html`.

## The one idea

**AI writes in pencil. You sign in ink.**

Anything the AI proposes is drawn as a dashed outline: hollow, dim, easy to erase. Anything a person approved is solid. This is not decoration. It is how the Approvals tab and the board behave, so the brand and the product teach the same thing.

There are two layers, and they do different jobs:

- **Paper layer** (logo, documents, tables, the Sheet): graphite pencil and flat blue ink. Quiet.
- **Glow layer** (the board, landing page, social images, video): dark glass with glowing gradients in lime, pink and violet. Vibrant. Here "solid" means lit. See "Product look".

The owner asked for the product screen to be vibrant, with gradients and glow, on 26 November 2026. The glow layer is that decision.

## Logo

The mark is a spreadsheet cell drawn in pencil with one ink square on its corner. The square is the decision: the click, the full stop, the handle you pull to apply a value. The dot of the i in the wordmark is the same square.

| File | Use |
|---|---|
| `logo/finalsay-lockup.svg` | Primary. Use this first. |
| `logo/finalsay-lockup-reversed.svg` | On dark backgrounds. |
| `logo/finalsay-mark.svg` | When the name is already nearby. |
| `logo/finalsay-wordmark.svg` | When there is no room for the mark. |
| `logo/*-mono-black.svg`, `*-mono-white.svg` | One colour, for print, stamps and photo backgrounds. |
| `logo/finalsay-app-tile.svg` | App tile and avatar. Use at 32 px and below, where dashes cannot survive. |

- Clear space: one ink square on every side.
- Smallest lockup: 96 px wide on screen, 25 mm in print. Smallest mark with dashes: 24 px.
- Do not stretch, tilt, round, fill the pencil cell, recolour the ink square, or add glows, shadows or gradients.
- Do not place the mark beside a Google, Sheets or Gmail logo as if they were one product. Finalsay runs inside a Google account. It is not made by Google.

The wordmark is set in Atkinson Hyperlegible Next ("final" at weight 500, "say" at weight 800) and converted to outlines, so the files need no font installed.

## Colour

Tokens live in `tokens.css` and `tokens.json`. Light is the default.

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--fs-paper` | #F6F7F9 | #0F1220 | Page background |
| `--fs-sheet` | #FFFFFF | #171B2E | Cells, tables, raised surfaces |
| `--fs-text` | #121628 | #ECEEF6 | Body text and headings (blue-black) |
| `--fs-text-muted` | #5A6070 | #A3AABB | Secondary text, column headers |
| `--fs-ink` | #2438C8 | #9DABFF | Approved things, the primary action, links |
| `--fs-on-ink` | #FFFFFF | #0F1220 | Text on an ink fill |
| `--fs-ink-wash` | #E9ECFB | #1D2447 | Selected row, focus halo |
| `--fs-pencil` | #7A8090 | #8E95A8 | Dashed outlines of proposed things |
| `--fs-rule` | #DADDE4 | #2B3049 | Grid lines and dividers |
| `--fs-overdue` | #B4311A | #FF9E8A | Overdue follow-ups and errors only |
| `--fs-won` | #17694A | #7FD6AE | Won deals only |

Blue, because a blue signature is the traditional way to tell a signed original from a photocopy. These colours are the paper layer. The glow layer is below.

### Measured contrast (WCAG 2)

Computed by `build/tokens-build.js` from the values above. Text needs 4.5 or more. Outlines and icons need 3 or more.

| Pair | Light | Dark |
|---|---|---|
| text on paper | 16.73 | 16.07 |
| text on sheet | 17.93 | 14.71 |
| text-muted on paper | 5.86 | 8.00 |
| text-muted on sheet | 6.28 | 7.32 |
| ink on paper | 7.92 | 8.60 |
| ink on sheet | 8.49 | 7.87 |
| on-ink on ink | 8.49 | 8.60 |
| text on ink-wash | 15.25 | 12.99 |
| pencil on paper | 3.68 | 6.22 |
| pencil on sheet | 3.95 | 5.69 |
| overdue on sheet | 6.19 | 8.53 |
| won on sheet | 6.65 | 9.84 |
| rule on sheet | 1.36 | 1.32 |

Pencil passes for outlines and is not used for body text. Rule lines are decoration and are not meant to pass.

## Type

One family in two cuts, both on Google Fonts, both SIL OFL 1.1.

- **Atkinson Hyperlegible Next** for words.
- **Atkinson Hyperlegible Mono** for data: cell values, IDs, dates, code.

Why: it was drawn so similar characters cannot be confused (I, l and 1; O and 0), which matters on pages full of email addresses, IDs and dates read by people in many languages.

| Role | Cut | Weight | Size |
|---|---|---|---|
| Page heading | Next | 800 | 37 to 74 px |
| Section heading | Next | 800 | 26 to 35 px |
| Proposed text | Next | 500 | 17 px |
| Body | Next | 400 | 17 px, line height 1.55, about 68 characters a line |
| Labels, approved text | Next | 700 | 15 to 17 px |
| Cell values, IDs, dates, code | Mono | 400 | 16 px |

Sentence case everywhere, including buttons and headings. Mono is for real data only.

## Shape (paper layer)

- **Spacing:** a 4 px base. Steps: 4, 8, 12, 16, 24, 32, 48, 72.
- **Corners:** things that hold data are square, like cells. Things you press have a 3 px corner.
- **Lines:** 1.5 px. Solid rule line for data. Dashed pencil line for proposed things, never filled. Solid ink fill for approved things.
- **Shadow:** none on the page. One shadow for things that float (menus, dialogs): `0 8px 24px` at 14% blue-black.
- **Icons:** 24 px grid, 2 px lines, square ends and corners, outlines only. The single filled shape allowed in an icon is the ink square.
- **Motion:** only in answer to a person's action. When someone approves a row, it turns from dashed to ink. Respect "reduce motion".

## Product look (the glow layer)

Dark glass with soft glowing gradients. It should feel alive. The rule still holds: a suggestion is dim and dashed, and what you approve lights up.

| Token | Value | Job |
|---|---|---|
| `--fs-night` | #0A0B10 | Backdrop |
| `--fs-night-text`, `--fs-night-muted` | #F3F4F8, #A9AEBE | Text on night |
| `--fs-day` | #F2F3F6 | The one light strip at the top (today's numbers) |
| `--fs-glow-lime` | #E3FF8A to #B6F04A to #6FDB3A | The primary action and anything approved |
| `--fs-glow-pink` | #FFC2D9 to #FF7FAE to #FF9E7A | The one thing to look at first. One pink card per screen. |
| `--fs-glow-violet` | #B9C2FF to #8D9BFF to #5B4BFF | Charts and new leads |
| `--fs-amber` | #FFB648 | Overdue text on night |
| `--fs-on-lime`, `--fs-on-pink` | #10150A, #2A0916 | Text on a glow |

Rules:

- Glow is light behind or inside a card: a blurred colour or a gradient fill. Never a hard neon outline.
- Three glow colours, each with one job. Do not add a fourth.
- Proposed: dashed outline, dim, a faint lime glow at the bottom edge. Approved: solid and lit.
- Corners are round here: 20 px for cards, 28 px for panels, full pills for buttons.
- One light strip at the top, the rest dark.
- The logo itself never glows. Place it flat, on night or on paper.

Measured contrast (WCAG 2):

| Pair | Ratio |
|---|---|
| night-text on night | 17.89 |
| night-muted on night | 8.88 |
| amber on night | 11.27 |
| on-lime on lime (lightest stop) | 16.70 |
| on-lime on lime (darkest stop) | 10.47 |
| on-pink on pink (lightest stop) | 12.16 |
| on-pink on pink (darkest stop) | 7.74 |

The reference for this look is `src/Board.html`. `brand/social/` in the brand kit holds images captured from it.

## Voice

Finalsay talks like a careful colleague who tells you what happened and what to do next.

- Say what the thing does. "Capture emails now", not "Sync".
- Say what did not happen when it matters. "Saved as a draft. Nothing was sent."
- An error names the problem and the next step. It does not apologise and it is never vague.
- The product is Finalsay, one word, capital F. The reader is "you". The AI is "the AI". It has no name and no personality.
- No numbers without a source. No "trusted by". No testimonials we were not given.
- If something has not been tested on a real Google account, say "not verified live".
- Words we do not use: seamless, effortless, supercharge, revolutionary, magic, unlock, 10x, game-changing.

| Instead of | Write |
|---|---|
| Supercharge your pipeline with AI-powered automation. | It reads the emails you label and fills in the lead for you. |
| Oops! Something went wrong. | Gmail label "CRM" not found. Create the label, add it to a thread, then run Capture emails again. |
| Reply sent! | Saved as a Gmail draft. Nothing was sent. |
| Trusted by thousands of teams. | New project. Tell us where it breaks. |
| Scales to any business. | A Google Sheet is not a database. Past a few thousand leads or a few dozen people, use something else. |

## Posts

Three square templates (1080 px) in `social/templates/` (part of the brand kit download; the code repository carries only the logo, favicons, tokens and this guide):

- `post-proposal-1080`: dashed frame. Ideas, questions, work in progress.
- `post-shipped-1080`: solid ink. Something that shipped.
- `post-before-after-1080`: what the AI proposed, what you approved.

These three are still in the paper style. The preview images (`github-social`, `og`, `producthunt-gallery`) are in the glow style, captured from the real board.

The template files hold placeholder text as outlines. To set real text, open the SVG in a vector editor, delete the placeholder and type in Atkinson Hyperlegible Next.

Words to start from:

- Shipped: "Finalsay 0.2 is out. [What changed, one line.] [Why it helps, one line.] Free, open source, runs in your own Google account."
- How it works: "How Finalsay picks your Today list: [the rule]. There is no AI in that part."
- Honest limit: "Where Finalsay breaks: [the limit]. If that is you, [what to use instead]."
- Question: "If you keep clients in a Google Sheet, which column could you not live without?"

Posts go out under the name Bhavesh Vaghela. Share what was built and what was learned. Do not pitch.

## Rebuilding the files

`build/` holds the scripts that made everything here (also part of the brand kit download, not the code repository). From `brand/build/`:

```
npm install
node tokens-build.js ..
node brand-build.js ..
./brand-render.sh ..        # needs rsvg-convert
node guide-build.js ..
node social-build.js ..     # needs Playwright and Chrome; captures the preview images from src/Board.html
```
