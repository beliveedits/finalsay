# Local AI page (experimental)

`companion/local-ai.html` lets a model on your own computer draft suggestions, so the text of your emails goes from your Google account to your browser and stops there.

**Status: experimental. Not verified live.** It has been run only with its built-in made-up data. The connection to a real Sheet, to Ollama and to Chrome's model are untested.

## What it does

1. Asks your Sheet which leads need you (the same list as the Today tab).
2. For the lead you pick, asks the Sheet for a few lead fields and the last six messages of the thread.
3. Builds the same prompt the Sheet would build, using `src/Core.js`.
4. Asks your local model.
5. Reads four fields from the answer (stage, next step, number of days, draft reply) with the same strict parser, and shows them to you as dashed cards.
6. Only when you click **Queue for approval** does it send that suggestion to the Approvals tab. There it waits for a person, like any other.

It cannot apply a change. The endpoint it talks to has no such action.

## Why the safety rules are stricter here

Small local models are more likely to invent things, including saying they have done something. A guide for another self-hosted AI CRM gives the same warning about small models claiming actions they never performed (https://relaticle.com/blog/self-hosting-an-ai-native-crm-in-2026). Finalsay ignores all prose in the answer. If the answer has no usable fields, nothing is queued.

## Set up

1. Deploy the web app and make an **API token**: SETUP.md step 9 (deployment) and **CRM > More > New API token**.
2. Open `companion/local-ai.html` from the Finalsay folder in a desktop browser. It needs `src/Core.js` where it is, or a copy next to the page.
3. Paste the web app address and the token. The page keeps them in memory only.
4. Choose a model:

**Ollama.** Install Ollama, pull a model, and type its name (or press "Show my models"). The page only talks to `localhost`.

- A page opened as a file or served from localhost is normally accepted by Ollama.
- If you host the page on another site, start Ollama with that site allowed: `OLLAMA_ORIGINS=https://your-site.example ollama serve`. Recent Chrome versions also ask for permission before a website may reach your local network. Allow it for this page only.

**Chrome's built-in model.** The option appears only if your Chrome offers the Prompt API. According to Google's documentation (https://developer.chrome.com/docs/ai/prompt-api, read 26 Nov 2026): it is listed for web pages from Chrome 148, works on Windows 10 or 11, macOS 13 or later, Linux and Chromebook Plus, and does not work in Chrome on Android or iOS. It needs at least 22 GB of free disk space and either a graphics card with more than 4 GB of memory, or 16 GB of RAM and 4 processor cores. The first use downloads the model.

5. Press **Try with made-up data** first to see the whole flow without a Sheet or a model.

## What to know before using it

- The API token lets its holder read your leads and the recent emails of each lead. Do not use this page on a shared computer.
- Whether a browser page on one site may call your web app depends on Google answering with the right cross-origin headers. This is not verified. If the page says it cannot reach the Sheet, that is the likely reason.
- A laptop model can take a minute or more per suggestion.
