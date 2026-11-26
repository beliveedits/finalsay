# Architecture

## In one picture

```
 Gmail (threads with your label)        Website form / webhook        Local AI page / MCP server
            |                                    |  intake token                 |  API token
            v                                    v                               v
        Mail.gs  ----------+                Intake.gs  (doPost) -----------------+
     (read, draft)         |                     |                               |
                           v                     v                               v
   Cal.gs (optional) --> Code.gs  <----------------------------------------> proposals only
   Ai.gs  (optional) -->   |  capture, Today, approvals, board, triggers
   Docs.gs  ------------>  |
                           v
                       Core.js      pure rules: parse, rank, validate, describe
                           |
                           v
                       Store.gs     the storage adapter
                           |
                           v
                   the Google Sheet:  Leads | Today | Approvals | Activity | Settings
```

Everything runs inside the user's Google account as a script bound to the Sheet. There is no other server.

## Files

| File | Job | Talks to |
|---|---|---|
| `src/Core.js` | Pure logic with no Google calls. Runs in Apps Script, Node and a browser. | nothing |
| `src/Store.gs` | Storage adapter. The only file that reads or writes sheet data. | SpreadsheetApp |
| `src/Mail.gs` | Gmail adapter. Read labelled threads, save drafts. Two backends. | GmailApp or the Gmail API |
| `src/Cal.gs` | Optional read-only calendar adapter. | CalendarApp |
| `src/Ai.gs` | The only file that makes a web request. | UrlFetchApp |
| `src/Docs.gs` | Proposal documents from a template. | DocumentApp, optionally DriveApp |
| `src/Code.gs` | Menu, setup, capture, Today, approvals, board and phone app functions, triggers. | the files above |
| `src/Intake.gs` | Web endpoint (`doPost`). | the files above, CacheService |
| `src/Board.html` | The board. One file, no libraries. | `google.script.run` |
| `src/App.html` | The phone app for iPhone and Android browsers. One file, no libraries. Served by `doGet`; `?view=board` serves the board instead. | `google.script.run` |
| `src/appsscript.json` | Permissions. | |

A test (`test/static.test.js`) fails if any file reaches a service that is not its own.

## The tabs

**Leads**: ID, Name, Email, Company, Source, Stage, Value, Next Step, Next Date, Last Contact, Last Direction, Wants, Budget, Deadline, Thread ID, Notes, Created. Optional columns, used if a header with that text exists: Phone, Pipeline. Users may add any other columns.

**Today** (generated, overwritten on each refresh): Priority, Lead, Stage, Why, Next step, Lead ID.

**Approvals**: ID, Created, Lead ID, Lead, Type, What it will do, Payload, Status, Applied.

**Activity** (append-only): When, Lead ID, Lead, Kind, Detail, Message ID, By. It doubles as the record of which message ids have been processed, so capture never handles a message twice.

**Settings**: Setting, Value, What it does.

Columns are found by header text. A lead update writes single cells, never a whole row, so user formulas survive.

## Capture

1. Take the script lock, so two runs cannot overlap.
2. Give IDs to rows typed by hand.
3. Ask `Mail` for threads with the label. A missing label is reported and nothing else happens.
4. For each message whose id is not in Activity:
   - Work out whether it is inbound or outbound, and who the other person is.
   - Automated or unreadable addresses are logged as skipped.
   - New person: add a lead. Known person: update Last Contact and Last Direction if this message is newer.
   - Log it in Activity with the message id.
   - If AI is on and the message is inbound: ask for an extraction and fill **empty** fields only. A failure is logged and capture carries on.
   - If you replied to a lead that is still "New": queue a proposal to move it to "Talking". This is a plain rule, not AI, and it is queued only once.
5. Optional calendar step.
6. Rebuild Today.

A run stops itself after 4.5 minutes, because Apps Script ends a run at 6. The next run continues from the Activity record.

## Approvals as a state machine

```
            (script queues)            (person sets Status)             (script)
   proposal  ------------->  Pending  -------------------->  Approve  --------->  Applied   + timestamp + log
                                |                               |
                                |                               +--------------->  Error     + reason, lead untouched
                                +------------------------->  Reject   --------->  Rejected  + log
```

- A proposal is validated **before** it is queued (`CRM.proposalChanges`) and **again** when it is approved.
- At approval, the sentence in "What it will do" is rebuilt from the payload and compared with the row. A mismatch is an Error.
- `Applied` and `Rejected` are written only by the script. A finished row is restored if someone edits its status. An `Error` row can be fixed and approved again.
- The four types: `stage_change`, `next_step`, `note`, `reply_draft`. There is no type that deletes, and no type that sends.

## Time zones

Core's day arithmetic uses the local fields of a `Date`. Apps Script's own time zone may differ from the spreadsheet's. So `Code.gs` converts every instant through the **spreadsheet** time zone first (`sheetLocal_`, built on `Utilities.formatDate`) and hands Core a date whose local fields are the wall clock in that zone.

- **Next Date** is stored as text, `YYYY-MM-DD`. A date typed into a date-formatted cell is also understood.
- **Last Contact** and **Created** are real dates.
- The daily trigger is created in the spreadsheet time zone.

## Storage adapter (the seam for a bigger deployment)

`Code.gs`, `Intake.gs` and the rest never call SpreadsheetApp for data. They call `Store`, which today is `SheetStore`. To put a database behind Finalsay, write an object with the same methods and point `Store` at it.

```
init()                               create whatever is missing; safe to run twice
listLeads() -> Lead[]                Lead: { id, name, email, company, source, stage, value, nextStep,
                                             nextDate ('YYYY-MM-DD' or Date), lastContact (Date),
                                             lastDirection ('in'|'out'|''), wants, budget, deadline,
                                             threadId, notes, created (Date), phone?, pipeline? }
getLead(id) -> Lead | null
addLead(fields) -> Lead              assigns the ID
fillMissingIds() -> number           gives an ID to rows a person typed by hand
updateLead(id, changes) -> boolean   writes only the fields given
logActivity({ leadId, lead, kind, detail, messageId })     append-only
seenIds() -> { [messageId]: true }
listApprovals() -> Approval[]        Approval: { id, created, leadId, lead, type, description,
                                                 payloadText, status, applied }
addApproval(proposal, leadName, description)
setApproval(id, { status?, applied?, description? }) -> boolean
replaceToday(items)
getSettings() -> object              with defaults filled in
setSetting(label, value)
timeZone() -> string                 IANA name used for day arithmetic
```

Three more methods are about the Sheet as a user interface and may be empty in another adapter: `applyMode(mode)`, `lockDown(approvers)`, `activeLead()`.

What an adapter must guarantee:

1. `updateLead` changes only the fields it is given.
2. `logActivity` only ever appends.
3. `addLead` and `addApproval` are safe when two runs overlap. `SheetStore` relies on the script lock taken by its callers; a database adapter should use transactions.
4. Text is stored as text. `SheetStore` uses `CRM.safeCell`; a database needs parameterised queries.

What is **not** provided: a database adapter, a migration tool, or multi-tenant hosting. The seam exists so that the rules in `Core.js` and the approval flow can be reused. A deployment with hundreds of users needs real access control, which a Sheet cannot give. Say so to anyone who asks.

## Limits to design around

From Google's quota page, checked 26 November 2026 (https://developers.google.com/apps-script/guides/services/quotas). Google says these can change without notice.

| | Free Gmail account | Google Workspace |
|---|---|---|
| One run | 6 minutes | 6 minutes |
| Trigger runtime per day | 90 minutes | 6 hours |
| Web requests per day | 20,000 | 100,000 |
| Email reads and writes per day | 20,000 | 50,000 |
| Documents created per day | 250 | 1,500 |
| Script property reads and writes per day | 50,000 | 500,000 |
| One script property | 9 KB | 9 KB |

How the code respects them: capture looks at a set number of threads per run (30 by default), AI calls per run are capped (20 by default), a run stops early at 4.5 minutes, and the rate limiter for forms uses the cache instead of script properties.

## Tests

`npm test` runs five groups with no dependencies:

- `test/core.test.js`: the pure rules.
- `test/app.test.js`: the `.gs` files, loaded into Node against stand-ins for the Google services (`test/mocks/gas.js`), with a fake mail adapter that holds canned threads and has no way to send.
- `test/mail.test.js`: `Mail.gs` against stand-ins for GmailApp and the Gmail API.
- `test/static.test.js`: syntax of every `.gs` file, the "never sends" rule, one service per file, permissions in the manifests, no outside resources in HTML, no secrets.
- `test/mcp.test.js`: the MCP server against a local stand-in for the web endpoint.

The stand-ins check our logic. They do not prove Google behaves the way we assume. That list is in `STATUS.md`.
