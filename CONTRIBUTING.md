# Contributing

Thank you for looking. This is a small project with a few firm rules.

## Rules that do not bend

1. **Nothing sends email.** No send, reply, forward or delete call may appear in `src/`. `test/static.test.js` enforces this.
2. **AI output is data.** It may fill empty text fields and create proposals. Only a person's click applies a change. If your change lets model output reach `Store.updateLead` without going through the Approvals queue, it will not be merged.
3. **Everything from outside is hostile**: email text, form fields, AI answers, and cells in the Approvals tab. Validate in `Core.js`, write through `Store`, which makes text safe for the Sheet.
4. **One file per outside service.** Only `Mail.gs` touches Gmail, only `Ai.gs` makes web requests, only `Cal.gs` reads the calendar, only `Store.gs` touches sheet data. A test checks this.
5. **No new permission without a reason written in SETUP.md and PRIVACY.md.**
6. **Honest docs.** Do not write that something works on Google's side unless you ran it there. Add it to "Still not verified" in `STATUS.md` instead.

## Working on it

```
npm test         # all tests, Node 20+, no dependencies
npm run check    # syntax check of every .gs file
```

- Logic that does not need a Google service belongs in `src/Core.js`, with a test in `test/core.test.js`.
- The stand-ins for Google services are in `test/mocks/gas.js`. They are deliberately small. If you need a new Google call, add the smallest stand-in that lets you test your logic, and say in your pull request that the real call is unverified.
- Keep `src/` free of build steps and dependencies. People install this by pasting files.
- ES5-style code in `src/` (`var`, `function`) is intentional: it keeps the files readable for people who are new to Apps Script and runs anywhere.

## Pictures in the README

They are drawn from sample data, not captured from Google Sheets.

```
node tools/screens-build.js      # writes docs/screenshots/today.html and approvals.html
```

Then open each HTML file in a browser and save a picture, or render it with a headless browser. `src/Board.html`, `src/App.html` and `companion/local-ai.html` show sample data when opened as plain files.

## Words

Plain verbs, sentence case, no hype. See `brand/BRAND.md`, "Voice". Sample people are always made up and use `.example` addresses.

## Reporting a security problem

See [SECURITY.md](SECURITY.md). Please do not open a public issue for it.

## Licence

By contributing you agree that your contribution is released under the MIT licence of this project.
