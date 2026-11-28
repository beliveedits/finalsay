# Status

Last updated: 28 November 2026. Version 0.1.

Finalsay is new. This page says plainly what has been run against real Google services and what has not. If something here is wrong for your account, please open an issue and paste the lines from the Self-check tab.

## Tests

`npm test` runs 127 tests (28 core rules, 76 for the Apps Script files, 10 for the mail adapter, 10 checks on the files themselves, 3 for the MCP server). They run against small stand-ins for the Google services in `test/mocks/gas.js`. They check Finalsay's logic. They do not prove that Google behaves the way the stand-ins do.

## Verified live on 26 November 2026

The maintainer's copy was installed and run once on one personal Gmail account, in Chrome on Windows. One run on one account is evidence, not proof for every account.

**Self-check on the real account: 13 passed, 0 failed, 2 skipped** (AI and calendar were off).

| What | What was seen |
|---|---|
| Install | One code file (`dist/Finalsay.gs`), two HTML files and the manifest were added in the Apps Script editor and saved. The CRM menu appeared after reloading the Sheet. |
| Permission screens | The real order is: "Authorization required" (OK), "Google hasn't verified this app" (Advanced, then "Go to Finalsay CRM (unsafe)"), "Sign in to Finalsay CRM" (Continue), then a list with **one tick box per permission, none ticked**, a "Select all" box, and Continue. The six permission texts match the table in SETUP.md. SETUP.md step 2 now describes this. |
| Partly ticked permissions | The first pass ended with only the Sheet permission granted. Set up then made the tabs and reported, in plain words, that Gmail and triggers were not allowed. This is how the gap was found. Set up now stops and asks Google to show the screen again until everything is ticked; that was seen working ("Finalsay CRM wants additional access"). |
| `spreadsheets.currentonly` | Enough for the menu, the tabs, settings, dropdowns, dialogs, reading and writing, and the web app pages. |
| Formula guard | Text starting with `=` written through the guard was read back as text, with no formula. |
| Gmail | The script made the label `CRM`. A real thread with two messages carrying the label was captured: one new lead, then one update, with sender name, address, date, direction and thread ID. A reply draft was saved **inside that thread** and nothing was sent. The self-check draft was saved. |
| Today | After capture: "They wrote 3 days ago, you have not replied". After a next step was approved: "Follow-up due today". |
| Approvals and the edit trigger | Typing Approve in the Status cell applied the row within a few seconds, wrote Applied in bold ink with the date, and logged it in Activity. Both a reply draft and a next step were applied this way. |
| Triggers | Both automation triggers were created. The self-check made and removed its test trigger. |
| Google Docs | One document was created and written to. |
| Phone app and board as a web app | Deployed as "Execute as: Me, Who has access: Only myself". In desktop Chrome the phone app loaded real data, opened a lead and saved a note to the Sheet; `?view=board` showed the board. Google's grey "created by a Google Apps Script user" bar is shown on top. |

Three bugs were found by this run and fixed: half-ticked permissions were not handled; a Yes to automation that failed was never asked again; the self-check report showed the day without the time.

## Still not verified

1. **A real phone.** The phone app was only opened in desktop Chrome. Not tried: iPhone or Android, adding it to the home screen, Google sign-in inside the home-screen icon, several Google accounts in one phone browser, the Call and Email buttons inside Google's frame.
2. **AI.** No key was added, so Gemini, the default model name `gemini-3.5-flash-lite` and any OpenAI-compatible provider are untested. The self-check tests the key once one is added (CRM > Set AI key).
3. **The daily run actually firing** at 8:00, and the 6-minute limit.
4. **Other people.** That a second Google account is refused by the phone app and board. Only the owner's account was used.
5. **Approve and Move buttons inside the board and phone app.** Approving was tested in the Sheet, not from the pages. Saving a note from the phone app was tested.
6. **Email details**: threads where you already replied, HTML-only emails, send-as aliases. One two-message thread was read.
7. **Platform notifications from no-reply senders.** The thread used in the test was a marketplace message notification that arrives from a reply address, and it became a lead. Notifications sent from no-reply addresses are skipped by design, so those would not become leads. Not tested.
8. **Web endpoint** for forms (POST from another site, webhook tools), **proposal documents from a template**, **"Lock down for a team"**, the **pencil tint on waiting rows** (the bold ink on applied rows was seen; the tint was not clearly visible).
9. **Narrow Gmail permission path**, **calendar capture**, **local AI page**, **MCP server**, **clasp**, and **Hugging Face** hosting.

## Known gaps

- There is a template Sheet to copy (made 27 November 2026). Making a copy brings the script along and the CRM menu appears. On 27 November 2026 CRM > Set up was run once on a copy, with a second Google account of the author: 11 self-checks passed, 0 failed, 4 skipped (AI and calendar were off, and the draft and Docs checks only run from CRM > More > Run self-check). Email capture, AI and the Approve buttons were not run on the copy, and it is still the same person, not a second user. Pasting the script (SETUP.md step 1) is still the route that was followed end to end on a real account.
- Pressing CRM > Set up twice in quick succession made two runs collide on a real copy (27 November 2026): one Self-check line failed with a message that a sheet named Self-check already exists. The cause was that both runs looked for the Self-check tab, found none, and both tried to make it. The code now uses the tab the other run made (`ensureSheet_` in `src/Store.gs`). Two tests reproduce the collision against the stand-ins. This has **not** been run again on a real Google account, and the template Sheet and the v0.1.0 release file still carry the earlier code until they are refreshed. Until then, press Set up once and wait for the result.
- Five fixed stages. English only. No database adapter, only the interface for one (ARCHITECTURE.md).
- Three steps cannot be done by code, because Google only lets a signed-in person do them: approving the permission screen, deploying the web app address for the phone, and making an AI key.
- The phone app has no offline mode and no notifications. Setup, the AI key, proposal documents and tokens are only in the Sheet menu.
- Notifications from no-reply senders are skipped, so messages that reach you only that way do not become leads.

## Risks to know about

1. **Google's side was run once, on one account.** Workspace accounts, several sign-ins in one browser and strict administrators could behave differently.
2. **The Gmail permission is broad.** Google offers its simple Gmail service only with full mailbox access. Finalsay reads labelled threads and saves drafts, and a test fails the build if any send or delete call is added. A narrower path exists (SETUP.md step 12) and is the least tested part.
3. **A Google Sheet is not a database.** Past a few thousand leads or a few dozen people, use something else.
