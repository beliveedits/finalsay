# Set up Finalsay

You need a Google account and a browser on a computer (not a phone) for the first setup. **Faster: [make a copy of the template Sheet](https://docs.google.com/spreadsheets/d/1jbdAclzRHwDlG3_HTqy22Lj9X7BOMD6DRSLsGFZrvhU/copy).** The script comes with the copy, so you can skip step 1 and go straight to step 2. On 27 Nov 2026 I ran CRM > Set up on a copy of the template with a second Google account of mine: 11 self-checks passed, 0 failed, 4 skipped. It is still my own account, so a second person has not tried it.

Steps 1 to 5 and step 8 were followed once on a real personal Gmail account on 26 Nov 2026. The other steps have not been checked on a live account. Where a button name could differ from what you see, it says so.

## 1. Make the Sheet and add the script

1. Go to sheets.new to make a blank spreadsheet. Name it, for example, "Finalsay".
2. Open **Extensions > Apps Script**. A script editor opens in a new tab.
3. In the editor, delete the sample `Code.gs` content. Then create these files and paste the matching file from `src/` into each:

   | Make this file (use **+ > Script**) | Paste from |
   |---|---|
   | `Core` | `src/Core.js` |
   | `Store` | `src/Store.gs` |
   | `Mail` | `src/Mail.gs` |
   | `Cal` | `src/Cal.gs` |
   | `Ai` | `src/Ai.gs` |
   | `Docs` | `src/Docs.gs` |
   | `Code` | `src/Code.gs` |
   | `Intake` | `src/Intake.gs` |

   And two with **+ > HTML**: one named `Board`, pasted from `src/Board.html`, and one named `App`, pasted from `src/App.html`.

   **Quicker: one paste instead of eight.** `dist/Finalsay.gs` is all the script files joined into one. Paste it over the contents of the `Code` file the editor starts with, then add the two HTML files and the manifest as above. This is the route that was used for the live test.
4. Open **Project Settings** (the gear) and tick **Show "appsscript.json" manifest file in editor**. Go back to the editor, open `appsscript.json`, and replace its content with `src/appsscript.json`. This file lists the permissions, so nothing more is requested than what is written there.
5. Save. Close the editor tab and reload the Sheet. A **CRM** menu appears after a few seconds.

Developers can do steps 2 to 4 with [clasp](https://github.com/google/clasp), Google's command-line tool for Apps Script, using `src` as the root directory. Command names differ between clasp versions, so follow its own README. This route is not verified.

## 2. First run and the "Google hasn't verified this app" screen

Choose **CRM > Set up**. Google asks you to authorise the script.

Because this is your own private copy of a script and not an app from Google's store, Google shows a warning screen titled **"Google hasn't verified this app"**. That is expected. Google's documentation says this screen appears for scripts with sensitive permissions used by anyone outside the publisher's Google Workspace organisation, which includes every personal Gmail account ([source](https://developers.google.com/apps-script/guides/client-verification)).

What to click. This is the order seen on a personal Gmail account on 26 Nov 2026. Google changes these screens, so yours may differ a little:

1. A box in the Sheet says **Authorization required**. Click **OK**. A Google window opens.
2. **Google hasn't verified this app.** Click **Advanced**, then **Go to (your project name) (unsafe)**. "Unsafe" here means "not reviewed by Google", and the project is the one you just pasted in yourself.
3. **Sign in to (your project name).** Click **Continue**.
4. **(Your project name) wants access to your Google Account.** There is a list with a tick box next to each permission, and **none of them is ticked**. Tick **Select all**, scroll down and click **Continue**. The window closes by itself.

If you press Continue without ticking everything, Google gives the script only part of what it needs. Set up notices this and shows the permission window again ("wants additional access"). Tick **Select all** there.

Then choose **CRM > Set up** once more. In one go it:

1. Makes the five tabs.
2. Makes the Gmail label `CRM` if you do not have one, so you never create it by hand.
3. Asks once whether to turn on daily automation (step 5). Answer Yes unless you have a reason not to.
4. Runs a **self-check** against your own Google account and tells you how many checks passed. The full list is in the new **Self-check** tab.

### The self-check

You do not have to test Finalsay by hand. It tests itself:

- **Set up** runs the light version: the tabs, the time zone, that text which looks like a formula stays text, the private storage for the key, the Gmail label, triggers, and that Google tells the script who you are.
- **CRM > More > Run self-check** runs the full version. It also saves **one draft addressed to yourself** and makes **one small Google Doc**, both named "Finalsay self-check (safe to delete)", and asks the AI one question if AI is on. Run it again and it reuses the same draft and document.

It never sends, never deletes and never touches a lead. Every line says Pass, Fail or Skipped with the reason in plain words. If something fails, that list is what to copy into a bug report.

What it cannot check: the phone app on a real phone, and a real client email arriving. Those need a person.

If your organisation's administrator blocks unverified apps, you will not be able to continue. Ask them, or see [docs/BUSINESS.md](docs/BUSINESS.md).

### What each permission is for

| Permission Google shows (usual wording, it may differ) | Why Finalsay asks | Where it is used |
|---|---|---|
| View and manage spreadsheets that this application has been installed in | Read and write the five tabs of **this one spreadsheet**. Your other spreadsheets are not reachable. | `Store.gs` |
| **Read, compose, send and permanently delete all your email from Gmail** | Read threads that carry your label, make that label if it is missing, and save drafts. **Finalsay never sends and never deletes.** Google's simple Gmail service only comes with this broad permission. To ask for less, see step 12. | `Mail.gs` only |
| See, edit, create and delete all your Google Docs documents | Read your proposal template and make proposal documents | `Docs.gs` only |
| Connect to an external service | Call the AI provider you chose. Not used while AI is off. | `Ai.gs` only |
| Allow this application to run when you are not present | The daily capture and the approve-on-edit trigger, if you turn automation on | `Code.gs` |
| Display and run third-party web content in prompts and sidebars | The CRM menu, dialogs and the board | `Code.gs` |
| See your primary Google Account email address | Know which messages are yours, and write who approved what in the Activity log | `Mail.gs`, `Store.gs` |

There is no Drive permission and no Calendar permission unless you add them yourself (steps 13 and 14).

## 3. Capture your first lead

1. In Gmail, add the label `CRM` to an email thread from a client. (Set up already made the label.)
2. In the Sheet, choose **CRM > Capture emails now**.
3. Open the **Leads** tab. The sender is there, with the date of last contact. Open **Today** to see who needs you.

To try it without touching Gmail, use **CRM > More > Add sample leads (made-up people)**.

You can also just type leads by hand: a name and a next step are enough. They get an ID the next time Today is refreshed.

**Next Date** is typed as `YYYY-MM-DD`, for example `2026-12-03`. It is kept as text on purpose, so that no time zone setting can move it to another day.

## 4. Approvals

When there is a suggestion, it appears in the **Approvals** tab with a plain sentence under "What it will do".

- Set **Status** to `Approve` or `Reject`.
- Then choose **CRM > Apply approvals now**, or turn on automation (next step) and it happens as soon as you change the cell.
- An approved reply is saved in Gmail as a **draft**. Open Gmail, read it, and send it yourself if you want to.

If a row shows `Error`, the reason is in the Applied column. The lead was not changed.

## 5. Daily automation

Set up asks about this once. If you said Yes, it is already on. Otherwise **CRM > Turn on daily automation** does the same thing. It creates two triggers that run as you:

1. Capture once a day, at the hour set in Settings ("Daily run hour", spreadsheet time zone).
2. Apply a row in Approvals as soon as its Status is set to Approve or Reject.

**CRM > Turn off automation** removes both.

## 6. AI (optional)

1. Get an API key from your provider. For Gemini, keys are made in Google AI Studio.
2. **CRM > Set AI key** and paste it. It is stored in Script Properties, not in the Sheet.
3. Finalsay asks whether to turn AI on now. If you say Yes, it switches **AI on** to `TRUE` and asks the provider one test question straight away, so a wrong key or model name shows up immediately.

To use another provider or model, change **AI provider** and **AI model** in the **Settings** tab first.

Read this first:

- When AI is on, the text of each newly captured inbound email (sender, subject and up to 6,000 characters of the body) is sent to that provider. "Suggest next move" sends up to the last six messages of the thread.
- The default model name (`gemini-3.5-flash-lite`) was on Google's model list on 26 Nov 2026. Names change. If the AI stops answering, check the current list and edit the setting.
- For another provider, set **AI provider** to `openai-compatible`, set **AI base URL** (it must start with `https://`) and the model name that provider uses.

Then: select a lead row and choose **CRM > Suggest next move (selected lead)**. Suggestions land in Approvals.

## 7. Proposal documents (optional)

Select a lead row and choose **CRM > Create proposal doc (selected lead)**. The first time, Finalsay makes a starter template and puts its link in Settings. Edit that document to look like your proposals, then run the menu item again.

Placeholders you can use: `{{name}}`, `{{first_name}}`, `{{email}}`, `{{company}}`, `{{wants}}`, `{{budget}}`, `{{deadline}}`, `{{value}}`, `{{stage}}`, `{{next_step}}`, `{{next_date}}`, `{{today}}`, `{{my_name}}`.

A placeholder with no value for that lead is left as it is, and the finished dialog lists them.

The default copy method needs no Drive permission, but it copies paragraphs, lists and tables only. Headers, footers and page setup are not copied. For an exact copy, see step 14.

## 8. The phone app (iPhone and Android), and the board

On a computer, **CRM > Open board** shows leads by stage, plus anything waiting for your approval. **CRM > More > Open phone app view** shows the phone app in a small window so you can try it first.

The Google Sheets phone app does not show script menus, so on a phone you use Finalsay through a web address from your own Google account. It is a web page, not an app from the App Store or Google Play. The same page serves iPhone and Android.

**Turn it on (once, on a computer):**

1. In the script editor: **Deploy > New deployment > Web app**.
2. The dialog already shows **Web app**, **Execute as: Me** and **Who has access: Only myself**, because the manifest says so. Leave them as they are and click **Deploy**. (For a team, choose your organisation instead and read step 11.)
3. Copy the web app address. Send it to your own phone (email it to yourself, for example). It is set to open only for you, but treat the address as private anyway.

**Put it on your home screen:**

- **iPhone (Safari):** open the address, sign in to Google if asked, tap **Share**, then **Add to Home Screen**. On recent iOS versions leave **Open as Web App** switched on. Tap **Add**.
- **Android (Chrome):** open the address, sign in to Google if asked, tap the **three-dot menu**, then **Add to Home screen** (choose **Create shortcut** if Chrome asks). Tap **Add**.

Menu names change between phone software versions. If yours differ, look for "Add to Home Screen" in the browser's share or main menu.

**What you can do in the phone app:**

| Tab | What it does |
|---|---|
| Today | Who needs you, with the reason, and who to answer first |
| Your say | Approve or reject what the AI suggested. Nothing changes until you tap |
| Leads | Search, open a lead, call or email, change the stage, set the next step and date, add a note, ask the AI for a next move |
| Add | Type in a new lead, for example straight after a call |

**Check email** (top right) reads your labelled Gmail threads, the same as **Capture emails now** in the Sheet.

**The wide board on a phone or tablet:** add `?view=board` to the end of the web app address.

**Limits, so nothing surprises you:**

- It needs an internet connection. There is no offline mode.
- No notifications. Open it to see what is new. The daily run (step 5) still keeps the Sheet up to date.
- Google shows a grey bar at the top: "This application was created by a Google Apps Script user". It cannot be removed.
- If you are signed in to several Google accounts in the phone browser, Google may open the page with the wrong one and show an error. Open it in a private tab and sign in with the right account, or make that account the first one you sign in with.
- Setup, the AI key, proposal documents and tokens stay in the Sheet menu on a computer.
- It was opened in desktop Chrome on a real account and worked there (reading leads, opening one, saving a note). It has not been tried on a real iPhone or Android phone yet. See [STATUS.md](STATUS.md).

The pages are shown only to the account the script runs as, or to an editor of the Sheet. Anyone else gets a line of plain text. Every action the pages can take checks the same rule again.

## 9. Leads from your website form or Meta Lead Ads (optional)

This turns on a web address that accepts new leads.

1. **CRM > More > New intake token**. Copy the token. It is shown once.
2. In the script editor: **Deploy > New deployment > Web app**. **Execute as: Me. Who has access: Anyone.** Copy the address ending in `/exec`.
3. Send a POST request to that address:

```html
<form id="lead">
  <input name="name" placeholder="Your name" required>
  <input name="email" type="email" placeholder="Email" required>
  <textarea name="message" placeholder="What do you need?"></textarea>
  <input name="fax_number" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
  <button>Send</button>
</form>
<script>
document.getElementById('lead').addEventListener('submit', function (e) {
  e.preventDefault();
  var data = Object.fromEntries(new FormData(e.target));
  data.token = 'PASTE-YOUR-INTAKE-TOKEN';
  data.source = 'Website form';
  fetch('PASTE-YOUR-WEB-APP-ADDRESS', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // plain text avoids a preflight request Apps Script cannot answer
    body: JSON.stringify(data)
  }).then(function (r) { return r.json(); }).then(function (j) {
    alert(j.ok ? 'Thank you. We will reply soon.' : 'That did not go through: ' + j.error);
  });
});
</script>
```

- `fax_number` is a hidden trap field. People never fill it. Many bots do, and those posts are dropped.
- Accepted fields: `name` (or `full_name`, or `first_name` + `last_name`), `email` (or `email_address`), `company` (or `company_name`), `phone` (or `phone_number`), `message` (or `notes`), `source`. Those extra names match what Meta Lead Ads usually sends.
- **Meta Lead Ads** need a connector in between. Use a webhook tool (Zapier, Make, Pabbly and similar) with "POST JSON to URL", the address above, and the fields above plus `token`. Not verified with any of these tools.
- The token in a web page is visible to anyone who reads the page source. That is acceptable for this token: all it can do is add a lead, and posts are validated, limited (10 a minute and 300 a day by default, see Settings) and screened. Never put the **API** token in a web page.
- Apps Script always answers with HTTP 200. Read `ok` in the JSON.

## 10. Local AI page (experimental)

See [docs/LOCAL-AI.md](docs/LOCAL-AI.md). It needs the web app from step 9 and an **API token** (**CRM > More > New API token**).

## 11. Teams

See [docs/BUSINESS.md](docs/BUSINESS.md) for roles, shared drives, Workspace domains, backups and deleting data.

## 12. Narrower Gmail permission (experimental)

This replaces "read, compose, send and delete all your email" with two smaller permissions: read-only, and manage drafts.

1. In the script editor: **Services (+) > Gmail API > Add**.
2. Replace `appsscript.json` with `src/appsscript.narrow-gmail.json`.
3. **Project Settings > Script Properties > Add**: name `MAIL_BACKEND`, value `gmailapi`.
4. Run **CRM > Capture emails now** and authorise again.

This path has only been tested against a stand-in for the Gmail API. If it fails, delete the `MAIL_BACKEND` property and restore `src/appsscript.json`.

## 13. Calendar capture (optional, experimental)

When a lead is a guest on an event in the next 14 days, Finalsay proposes that event as the next step. It is a proposal like any other.

1. In `appsscript.json`, add `"https://www.googleapis.com/auth/calendar.readonly"` to `oauthScopes`.
2. In Settings, set **Calendar capture** to `TRUE`.

## 14. Exact template copies with Drive (optional)

1. In `appsscript.json`, add `"https://www.googleapis.com/auth/drive"` to `oauthScopes`. This is full access to your Drive, which is why it is not the default.
2. In Settings, set **Proposal copy method** to `drive-copy`.

## 15. Remove Finalsay

1. **CRM > Turn off automation**.
2. Script editor: **Deploy > Manage deployments** and archive any web app.
3. Go to myaccount.google.com/permissions, find the project and remove its access.
4. Delete the Sheet, or keep it. It is an ordinary spreadsheet with your data in it.

Saved keys and tokens live in the script's properties and are deleted with the Sheet. To delete them alone: Script editor > Project Settings > Script Properties.

## If something does not work

| What you see | What to do |
|---|---|
| No CRM menu | Reload the Sheet and wait ten seconds. Check that the `Code` file was saved. |
| "The Leads tab is missing" | Run **CRM > Set up**. |
| "Gmail label CRM not found" | Run **CRM > Set up** again (it makes the label), or change **Gmail label** in Settings. |
| Something else looks wrong | Run **CRM > More > Run self-check** and read the lines that say Fail. |
| Capture adds nothing | The thread must carry the label, and the sender must not be an automated address such as `no-reply@`. Skipped messages are listed in the Activity tab. |
| "Finalsay is busy with another run" | Another run is still going. Wait a minute. |
| AI errors in the Activity tab | The lead was still captured. Check the key, the model name and the provider. |
| A row in Approvals says Error | Read the Applied column. Fix the cause or reject the row and ask for a new suggestion. |
| "Stopped early to stay inside the time limit" | Run capture again. It continues where it stopped. |
| The phone shows "Finalsay. Nothing to see here." or "Not allowed." | The Google account signed in on the phone does not own or edit the Sheet. Sign in with the account that does. |
| The phone shows a Google error page instead of the app | Often caused by several Google accounts in one browser. Open the address in a private tab and sign in with the right account. |
| Call or Email does nothing on the phone | Not yet tried on real phones. The number and address are shown on the lead, so you can copy them. Please report it. |
| After changing the script, the phone still shows the old version | A deployment keeps the version it was made with. In the editor: **Deploy > Manage deployments**, edit the deployment and choose **New version**. |
