# Changelog

Dates are YYYY-MM-DD. This project follows semantic versioning once it reaches 1.0.

## 0.1.0 (2026-11-26)

First complete build and first public release. It has been run once on one personal Gmail account; STATUS.md lists what is verified and what is not.

### Added

- Core logic (`src/Core.js`): sender parsing, the Today list with plain reasons, strict parsing of AI answers, the approval queue, template merging.
- Apps Script layer: setup, Gmail label capture, Today, Approvals with approve-on-edit, "Suggest next move", proposal documents, the board, daily automation.
- Storage adapter (`src/Store.gs`) with a documented interface.
- Mail adapter (`src/Mail.gs`) with two backends: GmailApp (default) and the Gmail API with narrower permissions (experimental).
- Web endpoint (`src/Intake.gs`) for website forms and webhook tools, with separate intake and API tokens, validation, rate limits and spam handling.
- Optional calendar capture (`src/Cal.gs`), off by default.
- Team helpers: approvals change log in Activity, "Lock down for a team".
- Experimental: local AI page (`companion/local-ai.html`), reference MCP server (`mcp/server.js`).
- Phone app (`src/App.html`) for iPhone and Android browsers: Today, Your say (approve or reject), Leads (search, call, email, edit, note, ask the AI), Add a lead, Check email. The web address now opens the phone app; `?view=board` opens the board.
- Every function a page can call now checks who is asking, not only the page itself.
- A Phone column is added to Leads the first time a phone number arrives (from the phone app or a form).
- One-click setup: **Set up** now also makes the Gmail label, asks once about daily automation, and runs a self-check.
- Self-check (`CRM > More > Run self-check`, report in a Self-check tab): tests this copy against the real Google services and reports Pass, Fail or Skipped per line. The full run saves one draft to yourself and one small document and reuses them. It never sends or deletes.
- **Set AI key** can switch AI on in the same step and asks the provider one test question.
- First live run on a real Google account (26 Nov 2026). Found and fixed: permissions that were only partly ticked on Google's screen (Set up now asks again, and the self-check has a Permissions line); a Yes to automation that failed was never asked again; the self-check report showed the day without the time. SETUP.md step 2 now describes the permission screens as they really are.
- `dist/Finalsay.gs`: all script files in one, for installing with one paste (`npm run build`).
- 125 tests against Node stand-ins for the Google services.
- Brand kit: name research, logo set, tokens, brand guide.
- Board look: dark glass with glowing gradients (lime, pink, violet), a light strip for today's numbers, and an "Answer first" card.

### Changed from the first core file

- Today list: a brand-new lead who wrote today now appears straight away ("New lead wrote today"). Before, a new lead only appeared after the reply window had passed.
- Proposal descriptions only end in "…" when the draft text was actually cut.
- Empty notes and empty reply drafts are refused when a proposal is validated.

### Security

- Text from emails, forms and AI answers is written to the Sheet so that it cannot become a formula.
- Draft recipients come from the Leads row, never from AI output. Subjects and recipients are forced onto one line.
- A row in Approvals is refused if its "What it will do" text no longer matches its payload.
