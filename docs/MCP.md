# MCP connector (experimental)

The Model Context Protocol (MCP) lets an AI assistant call tools you give it. `mcp/server.js` is a small reference server that gives an assistant two abilities: **read** your Finalsay leads and **queue suggestions**.

**Status: experimental. Not verified live.** The server passes its tests against a local stand-in for the web endpoint. It has not been connected to a real Sheet or a real MCP client.

## The design in one sentence

Every write tool creates a proposal that waits in the Approvals tab, and there is no tool that applies, edits, deletes or sends.

## Why it is built this way

An assistant connected to a CRM reads text written by strangers: lead names, what they asked for, sometimes whole emails. That text can contain instructions aimed at the assistant. If the assistant could edit leads directly, one hostile email could change your pipeline.

So the connector keeps the same rule as the rest of Finalsay. The assistant proposes. A person approves, in the Sheet, where the proposal is shown as one plain sentence. The worst a manipulated assistant can do is queue a bad suggestion that you then see and reject.

## Tools

| Tool | What it does |
|---|---|
| `finalsay_today` | Leads that need attention, with the reason |
| `finalsay_leads` | All leads: name, company, stage, next step, next date. No email addresses. |
| `finalsay_approvals` | Suggestions still waiting |
| `finalsay_propose_stage_change` | Queue: move a lead to another stage |
| `finalsay_propose_next_step` | Queue: set a next step and an optional date |
| `finalsay_propose_note` | Queue: add a note |
| `finalsay_propose_reply_draft` | Queue: a reply. If approved it becomes a Gmail draft to the lead. Never sent. |
| `finalsay_lead_context` | The last messages of one lead's thread. **Off unless you set `FINALSAY_ALLOW_THREADS=1`.** |

The server checks arguments and passes only the fields each proposal type may carry. The Sheet validates everything again.

## Should the assistant see email text?

By default it does not. Turning on `finalsay_lead_context` sends the text of your clients' emails to the company that runs the assistant, and puts untrusted text into the assistant's context. Suggestions will be better informed. Decide per client whether that is acceptable. The local AI page gives you the same help without the text leaving your computer.

## How it talks to the Sheet

The server sends a POST request to your web app address with the **API token** in the body. That token can read and queue. It cannot apply. The server refuses any address that is not a Google Apps Script web app address, so the token is not sent elsewhere by a typing mistake.

```
assistant  <-- stdio, JSON-RPC -->  mcp/server.js  -- HTTPS POST -->  Intake.gs (doPost)  -->  Approvals tab
```

No dependencies: the server implements the small part of JSON-RPC it needs. Node 20 or newer.

## Set up

1. SETUP.md step 9 for the web app, then **CRM > More > New API token**.
2. In your MCP client's configuration, add a server like this (the exact file and format depend on the client):

```json
{
  "mcpServers": {
    "finalsay": {
      "command": "node",
      "args": ["/full/path/to/finalsay/mcp/server.js"],
      "env": {
        "FINALSAY_URL": "https://script.google.com/macros/s/YOUR-ID/exec",
        "FINALSAY_API_TOKEN": "paste-the-api-token"
      }
    }
  }
}
```

3. Ask the assistant something like "Which leads need me today?" Then "Suggest a next step for L-0002." Check the Approvals tab.

The configuration file holds your token in plain text. Keep that file private.

## Limits

- Read tools return up to 500 leads.
- The endpoint's rate limits apply (Settings > Intake per minute, Intake per day).
- Only the stdio transport is implemented. There is no hosted or remote version.
- Protocol versions answered: 2025-06-18, 2025-03-26, 2024-11-05.
- Not published to npm. Run it from the repository.

## Ideas not built

- A hosted connector, so web-based assistants could use it. That needs an OAuth flow and a server, which this project does not have.
- Resources and prompts (other MCP features). Only tools are implemented.
