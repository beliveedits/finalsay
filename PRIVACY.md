# Privacy

Short version: Finalsay is a script that runs inside your own Google account. The people who wrote it never see your data, because there is no Finalsay server and no telemetry. Your leads leave your Google account in one case only: when you turn the AI on, and then they go to the AI provider you chose.

This page describes what the code does. It is not legal advice. If you handle other people's personal data for work, you are responsible for following the laws that apply to you.

## Where your data lives

| Data | Where it is kept |
|---|---|
| Leads, notes, the Today list, proposals waiting for approval, the activity log, settings | The Google Sheet you installed Finalsay in |
| Your AI key, the intake token, the API token | That Sheet's script properties. Never in a cell. |
| Proposal documents | Your Google Docs |
| Reply drafts | Your Gmail drafts |
| Short-lived counters for the form endpoint (rate limits, double-submit check) | Google's script cache, for up to six hours |

Nothing is stored anywhere else by this project.

The phone app and the board are pages sent by your own copy of the script. They load nothing from other sites, and they save nothing on the phone or computer: close the page and the lead data is gone from the device. Your phone's browser handles the page like any other page you visit while signed in to Google.

## What Finalsay reads

- **Gmail:** only threads that carry your label (default `CRM`). Set up makes that label if you do not have it. The self-check, when you run it from the menu, saves one draft addressed to yourself and one small document, both named "Finalsay self-check (safe to delete)". For each message: sender, recipients, date, subject and the plain-text body. It also reads your own address and send-as aliases, to tell your messages from theirs.
- **Calendar:** nothing, unless you turn on calendar capture and add the permission yourself. Then: the title, start time and guest addresses of events on your default calendar in the next 14 days.
- **Docs:** the proposal template you point it to.

## What leaves your Google account

| When | What is sent | To whom |
|---|---|---|
| AI is **off** (the default) | Nothing | Nobody |
| AI is on, during capture | Sender, subject and up to 6,000 characters of the body of each newly captured inbound email | The AI provider set in Settings |
| AI is on, "Suggest next move" | Your name from Settings, the lead's name and stage, and up to the last six messages of the thread (1,500 characters each) | The same provider |
| You use the local AI page | A few lead fields and the last six messages of one thread | Your own browser, then a model on your own computer |
| You connect the MCP server | Lead names, companies, stages, next steps and proposals. Email text only if you set `FINALSAY_ALLOW_THREADS=1`. | The AI assistant you connected, and whoever runs it |

**Read your provider's data terms before turning the AI on.** Whether a provider stores prompts, uses them to improve its models, or lets staff review them depends on the provider, the plan and the settings of your account with them. This project has not verified any provider's terms and makes no claim about them.

The emails you label contain other people's words and details. Turning the AI on means sharing those with a third party. Decide whether that is acceptable for your clients.

## Permissions, and why the Gmail one is broad

SETUP.md lists every permission and the file that uses it. Two deserve a plain explanation here.

**Gmail.** By default Finalsay uses Google's simple Gmail service (`GmailApp`). Google offers that service only with the scope `https://mail.google.com/`, and the consent screen describes it as reading, composing, sending and permanently deleting all your email. Finalsay uses it to read labelled threads and to save drafts. It does not send, forward or delete, there is no code for that in the project, and a test fails if such code is added. If you would rather grant less, SETUP.md step 12 switches to the Gmail API with read-only plus drafts. That path is experimental.

**Docs.** The Docs permission covers all your Google Docs, because Google has no "only this template" permission for scripts. Finalsay opens the template you set and creates new proposal documents.

There is no Drive permission and no Calendar permission in the default setup. The spreadsheet permission covers only the one Sheet the script is attached to.

## Other people who can see your data

- **Anyone you share the Sheet with.** Viewers can read every lead. Editors can change anything.
- **Anyone who has your API token** can read lead names, stages and next steps, and the recent emails of a lead, through the web endpoint. Treat it like a password. The intake token cannot read anything.
- **Google**, as the host of your account, under your agreement with Google.

## Keeping and deleting data

Finalsay never deletes a lead by itself. To remove one person:

1. Delete their row in **Leads**.
2. In **Activity** and **Approvals**, filter by their Lead ID and delete those rows.
3. Delete any proposal documents and Gmail drafts made for them.
4. The Sheet's version history still holds old copies. To remove those too, use **File > Make a copy**, check the copy, and delete the original.

To remove everything, follow "Remove Finalsay" in SETUP.md.

For teams there is a fuller checklist in [docs/BUSINESS.md](docs/BUSINESS.md).

## What this project does not do

- No analytics, tracking pixels or usage reporting
- No account with the author, no sign-up, no email list
- No sale or sharing of data, because the author never has it

## Questions

Open an issue once the repository is public. Do not put personal data in an issue.
