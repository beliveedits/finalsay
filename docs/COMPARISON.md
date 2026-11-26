# Finalsay next to the alternatives

Written 26 November 2026. Star counts and requirements are quoted from the pages linked, on the dates given. They change. Check before you repeat them.

This is not a ranking. These tools solve different sizes of problem.

## The short answer

- **You work alone or in a small team, live in Gmail, and do not want to run a server:** Finalsay fits.
- **You need a real multi-user CRM with permissions, custom objects and reporting, and you can run a server:** use Twenty, Krayin or NocoBase.
- **You want to remember people in your personal life:** Monica is built for exactly that.
- **You already pay for Google Workspace Business Standard and want Gemini inside Sheets:** Google's own route may be enough.

## Database CRMs you host yourself

| | What it is | What it needs | Stars, as stated by the source |
|---|---|---|---|
| **Twenty** | Open-source CRM, an alternative to the big hosted ones | A server you run | 37.3k |
| **Monica** | Personal relationship manager | A server you run | 23.8k |
| **Krayin** | Open-source CRM | A server you run | 20.6k |
| **NocoBase** | No-code platform you can build a CRM on | A server you run | 20.8k |

Source for the four rows: NocoBase's own roundup, dated 21 December 2025: https://www.nocobase.com/en/blog/top-10-open-source-ai-crm-projects-with-the-most-github-stars

**Where they are better than Finalsay:** real databases, real user accounts and permissions, many more records, richer features, large communities.
**Where Finalsay is different:** nothing to host, install by copying a Sheet, and your data sits in a spreadsheet you already know how to use.

**Relaticle** is another self-hosted, AI-focused CRM with its own assistant and MCP server. Its guide lists five services for a core deployment (the app, a queue worker, a scheduler, PostgreSQL and Redis) and warns about small local models claiming actions they did not perform: https://relaticle.com/blog/self-hosting-an-ai-native-crm-in-2026. That warning is one reason Finalsay never lets a model apply anything.

## Other CRMs built on Google Sheets

| | What its page says (read 26 Nov 2026) | Source |
|---|---|---|
| **Sheety CRM** | "A stateless, open-source CRM built on Google Sheets". 39 stars, marked beta, MIT. Uses a Next.js front end, a FastAPI back end and Google sign-in, and suggests hosting the two parts on separate services. | https://github.com/sdntsng/sheety-crm |
| **Sovereign Sheets CRM** | Self-hosted, single-tenant, with a local SQLite database and optional Apps Script integration. 0 stars, MIT. Its README describes its release state as "not production-admitted". | https://github.com/LeonidMajbits/sovereign-sheets-crm |
| **Finalsay** | Apps Script bound to the Sheet. No front end or back end to host. Version 0.1, run once on one real Google account (26 Nov 2026). | this repository |

**Where Sheety is better:** a designed web interface, and a conventional web stack that many developers already know.
**Where Finalsay is different:** there is nothing to deploy, and AI suggestions go through an approval tab.

Be fair when you repeat this: all three are young projects. Finalsay is the newest and the least proven.

## Google's own route: Gemini in Sheets

A published guide to building a CRM with Gemini inside Sheets says it needs Google Workspace Business Standard, because that is where Gemini runs inside Sheets: https://theaiadvantage.ca/free-google-sheets-crm-gemini/

**Where that is better:** made and supported by Google, and no script to authorise.
**Where Finalsay is different:** works on a free Gmail account, lets you choose the AI provider or use none, captures from a Gmail label, and keeps an approval step and a log.

## Hosted CRMs

Not compared here in detail. They are finished products with support teams, mobile apps and integrations, and Finalsay is a small open-source script. The reasons someone picks Finalsay instead are narrow and specific: they want the data in their own Sheet, they do not want another login or subscription, and they want to see each AI suggestion before it counts.

## What Finalsay cannot do that most of the above can

- Hide one user's records from another
- Hold tens of thousands of records comfortably
- Custom stages, custom objects, reports and dashboards
- A native mobile app from the App Store or Google Play (Finalsay's phone app is a web page you add to your home screen)
- Send email or run sequences (by design)
