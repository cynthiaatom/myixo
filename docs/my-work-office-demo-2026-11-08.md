# My Work — Office presentation walkthrough (2026-11-08)

## Launch
Preview branch `feature/my-life-my-work-foundation`; do not promote to production before authenticated QA.

## Five-minute executive demonstration
1. Open MY iXo, switch from **My Life** to **My Work**. Show that the personal experience is preserved.
2. Click **Load executive demo**. This loads **fictional** Northstar Growth Group records. Never describe these as connected company data.
3. Show **Executive Brief** and three summary metrics. They recalculate from the opportunity, decision and task registers.
4. Open **Opportunities**. Add a new opportunity, change its status, return to Executive Brief and demonstrate the updated pipeline.
5. Open **Decisions**. Add a question, resolve it, return to the brief to show the pending count change.
6. Open **My AI Team**. Choose AI CMO, CRO or Operations; assign a planning task; mark it done. These are **manual planning assignments**, not running AI agents.
7. Return to **Overview**, move Business Improvement Calculator sliders, explain illustrative contribution and time-value estimates and double-counting caveat.
8. Click **Export session**. The JSON export can be imported again in the preview. There is no cloud sync; the file contains whatever was entered, so keep it private.

## Accurate statements
- Working: My Life/My Work tabs, executive dashboard derived from current session data, company profile, opportunity register, decision register, team planning assignments, scenario calculator, fictional demo loader, JSON import/export, responsive UI.
- Not working yet: secure durable multi-device business storage, native iXo work memory, connected CRM/finance/project data, autonomous AI specialist execution, enterprise roles and permissions, live source-backed business recommendations.
- Preview is not enterprise ready. Do not enter confidential customer data.
- Never claim a production release until separately approved and verified.

## Engineering QA
- `npm run build` verified locally on authorized laptop at commit `8fa6560de8ac97b0d3e3a93a85c157e4678b44d0`.
- Vercel preview deploy `dpl_3rY8jtF5B29FNsjoopc92amcFJyd` created; verify READY before demonstrating.
- Authenticated end-to-end tests and cross-tenant tests not yet completed. No production promotion.
