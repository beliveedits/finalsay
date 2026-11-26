# Finalsay for a team

This covers a small team inside one Google Workspace organisation. Read the limits first.

## Be honest with yourself about size

A Google Sheet is not a database.

- It suits **one to roughly ten people** and **up to a few thousand leads**.
- Two people editing the same cell at the same moment: the last one wins.
- Access control is Sheet sharing. It cannot hide one person's leads from another.
- Anyone with edit access can change any cell and read the saved keys (see "Roles").

If you need per-person visibility, field-level permissions, or records in the tens of thousands, use a CRM built on a database. [COMPARISON.md](COMPARISON.md) names some open-source ones.

## Roles

Finalsay has no user table. Roles are what Google Sheets sharing gives you.

| Role | Give this Sheet access | Can do |
|---|---|---|
| **Owner** | Owner | Everything, including Settings, keys, tokens and triggers |
| **Approver** | Editor, and listed under Settings > Approvers | Edit leads and decide rows in Approvals |
| **Editor** | Editor | Edit leads, run capture, ask for suggestions. After lock-down, cannot change the Status column or Settings. |
| **Viewer** | Viewer or Commenter | Read everything. Change nothing. |

**CRM > More > Lock down for a team** sets this up:

- **Settings** tab: only the owner can edit.
- **Approvals > Status** column: only the owner and the approvers can edit.
- **Activity** and **Today** tabs: a warning appears if someone edits them by hand.

What lock-down does **not** do, said plainly:

- An editor can still edit any other cell, including the Payload of a pending proposal. If they do, the row fails with an error when approved, because its sentence no longer matches. If they change both, the approver sees the new sentence and decides on that.
- An editor can open **Extensions > Apps Script**, read the script properties (AI key, tokens) and change the code. Editors are trusted people. Everyone else should be a viewer.
- Scripts started by an editor run as that editor. Automation triggers run as whoever turned them on. Let the owner turn automation on.

## Audit trail

- **Activity** records every captured email, every skipped message, every AI fill, every proposal queued from outside, every approval, rejection and error, and every stage moved on the board, with the time and the account that did it.
- It is append-only by design: the code only ever adds rows. A warning protection discourages hand edits. It does not prevent them.
- For stronger evidence use Google's own tools: **File > Version history** shows who changed which cell and when, and Workspace admins have the Drive audit log.

The "By" column shows the account the script ran as. For the daily trigger, that is the person who turned automation on.

## Deploying inside a Workspace organisation

Google's documentation says the "unverified app" screen is not shown when the script's owner and its users belong to the same Workspace organisation, including when it lives in that organisation's shared drive ([source](https://developers.google.com/apps-script/guides/client-verification)). Not verified live for this project.

Suggested layout:

1. Create the Sheet in a **shared drive**, so it belongs to the organisation and not to one person's account.
2. Paste the script as in SETUP.md. One person (the owner) authorises first.
3. Share the shared drive or the Sheet: editors for the people who work leads, viewers for everyone else.
4. Each editor authorises once, the first time they use the CRM menu.
5. **Whose mailbox?** Capture reads the Gmail of the person who runs it. For one shared record of leads, either:
   - one person (or a shared mailbox account) runs capture and turns on the daily trigger, or
   - each person labels their own client threads and runs **Capture emails now** themselves. Leads are matched by email address, so two people writing to the same client update the same row.
6. If the organisation restricts third-party access to Google data, an administrator may need to allow the script in the Admin console's API controls.

Workspace accounts have higher daily limits than free accounts. See ARCHITECTURE.md.

## Backup and restore

- **Backup:** **File > Make a copy** on a schedule you choose, into a folder only the owner can edit. The copy includes the script, but **not** the script properties, so keys and tokens must be set again in a restored copy.
- **Export:** **File > Download** gives Excel or CSV per tab. The Sheet is the export. There is no proprietary format.
- **Restore one mistake:** **File > Version history**, find the version before the mistake, and copy the cells back or restore that version.
- **Restore everything:** open the backup copy, authorise, set the keys, turn automation on. Message ids in the Activity tab travel with the copy, so nothing is captured twice.

## Keeping and deleting personal data

You decide how long to keep leads. Finalsay never deletes on its own.

To delete one person on request:

1. Note their Lead ID, then delete their row in **Leads**.
2. Filter **Activity** and **Approvals** by that Lead ID and delete the rows.
3. Search Google Docs for "Proposal - (their name)" and delete those documents.
4. Delete unsent drafts to them in Gmail. The original emails stay in your mailbox under your own mail retention rules. Remove the `CRM` label if you do not want them captured again.
5. Old versions of the Sheet still contain the data. If it must be gone, make a copy of the Sheet, move the team to the copy, and delete the original (and empty the bin).
6. If the AI was on, their email text was sent to your provider. Check the provider's deletion options.

To keep less by default: turn the AI off, keep notes short, and clear closed leads on a schedule.

## The road to something bigger

`src/Store.gs` is the single place that reads and writes data, with a documented interface in ARCHITECTURE.md. A team that outgrows the Sheet can keep the rules and the approval flow and write a database adapter. That adapter is not part of this project, and neither is the access control a larger deployment needs.
