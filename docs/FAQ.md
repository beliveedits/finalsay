# Questions people ask

**Is it really free?**
Yes. The code is MIT licensed and there is no paid tier. You may pay other companies: an AI provider if you use one beyond its free allowance, and Google if you want a Workspace plan. Finalsay itself asks for nothing.

**Where is my data?**
In a Google Sheet in your own Google account, plus drafts in your Gmail and proposals in your Google Docs. There is no Finalsay server. See [PRIVACY.md](../PRIVACY.md).

**Does it read all my email?**
It reads the threads you put your label on (default `CRM`). The default permission Google makes you grant is broader than that, and SETUP.md explains why and how to grant less.

**Will it ever send an email?**
No. It can save a draft after you approve one. You open Gmail and send it yourself. There is no send code in the project and a test fails if any is added.

**Can the AI change my leads?**
It can fill fields that are empty when a new email is captured (company, what they want, budget, deadline). Everything else it suggests waits in the Approvals tab until you approve it.

**Do I need the AI?**
No. With the AI off you still get capture, the Today list, the board and proposal documents. The Today list uses plain rules, not AI.

**Which AI can I use?**
Gemini, or any provider with an OpenAI-compatible API. There is also an experimental page for a model running on your own computer.

**What does Google's "hasn't verified this app" screen mean?**
That the script is your own copy and has not been through Google's review, which is for apps published to many people. SETUP.md shows what to click and lists every permission.

**How many leads can it hold?**
It is meant for up to a few thousand leads and a handful of people. A Google Sheet slows down well before a database would. If you need more, use a database CRM. See [COMPARISON.md](COMPARISON.md).

**Can my team use it?**
A small team in one Google Workspace organisation, yes, with the limits in [BUSINESS.md](BUSINESS.md). Roles are Sheet sharing plus protected ranges. Everyone with edit access is trusted.

**Does it work on my phone?**
Yes, on iPhone and Android, through a phone app that runs in the browser. You deploy it once as a web app from your own Google account and add it to your home screen (SETUP.md step 8). There you can see who needs you today, approve or reject suggestions, call or email a lead, update a lead and add a new one. As of version 0.1 it has not been tried on real phones. The Sheet itself also opens in the Sheets app, but the CRM menu does not run there.

**Is it in the App Store or on Google Play?**
No. A store app would need a developer account, Google's security review for Gmail access, and a server in the middle that holds your data. That is the opposite of "it lives in your Google account". The phone app is a page from your own copy of the script. The cost: it needs a connection, it cannot send notifications, and Google may show a grey bar saying the page was made by an Apps Script user.

**Can I change the stages?**
Not in 0.1. The five stages are New, Talking, Quote sent, Won and Lost. You can add a Pipeline column to separate kinds of work.

**Can I add my own columns and formulas?**
Yes. Finalsay finds its columns by header text and writes single cells only.

**How do I get my data out?**
It is already out. File > Download gives you Excel or CSV. Or just keep the Sheet.

**How do I connect my website form or Meta Lead Ads?**
SETUP.md step 9. Forms post straight to a web address. Meta Lead Ads need a webhook tool in between.

**Has it been tested?**
It was run once on one real Google account on 26 Nov 2026 (see STATUS.md for what worked), and the logic has 127 automated tests that run against stand-ins for Google's services. AI, a real phone and several other parts have not been run live. The list is in [STATUS.md](../STATUS.md).

**Is this a Google product?**
No. It is an independent open-source project by Bhavesh Vaghela. It runs inside your Google account using Google's own scripting tool.

**Why "Finalsay"?**
Because the AI proposes and you have the final say.
