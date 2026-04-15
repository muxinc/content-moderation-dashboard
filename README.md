# Content Moderation Dashboard

A content moderation dashboard for [Mux](https://mux.com) video assets. Automatically analyzes videos for sexual and violent content using the [Mux Robots API](https://docs.mux.com/api-reference/video#tag/Robots), with configurable thresholds, auto-reject rules, Q&A questions, and webhook notifications.

Built with [Next.js](https://nextjs.org), [Convex](https://convex.dev), and [Mux](https://mux.com).

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmuxinc%2Fcontent-moderation-dashboard&project-name=content-moderation-dashboard&repository-name=content-moderation-dashboard&demo-title=Content%20Moderation%20Dashboard&demo-description=A%20content%20moderation%20dashboard%20for%20Mux%20video%20assets%20using%20the%20Mux%20Robots%20API&products=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22convex%22%2C%22productSlug%22%3A%22convex%22%2C%22protocol%22%3A%22storage%22%7D%5D&env=MUX_TOKEN_ID,MUX_TOKEN_SECRET,ADMIN_PASSWORD&envDescription=Mux%20API%20credentials%20and%20admin%20password%20for%20the%20dashboard&envLink=https%3A%2F%2Fdocs.mux.com%2Fguides%2Fmake-api-requests)

Clicking the button above will:

1. Clone this repo to your GitHub account
2. Prompt you to install the **Convex integration** (provisions a Convex project and sets `CONVEX_DEPLOY_KEY` automatically)
3. Prompt you for your **Mux API credentials** (`MUX_TOKEN_ID` and `MUX_TOKEN_SECRET`) and an **admin password** for the dashboard
4. Deploy the app to Vercel

Your Mux credentials are automatically pushed to Convex during the build. The admin password protects the dashboard — you'll use it to log in.

### After deploying: set up the Mux webhook

Your Convex HTTP endpoint URL is shown in the [Convex dashboard](https://dashboard.convex.dev) under your project's deployment URL. Configure a Mux webhook in the [Mux dashboard](https://dashboard.mux.com/settings/webhooks) pointing to:

```
https://<your-project>.convex.site/mux/webhook
```

Then copy the webhook signing secret from Mux and add it as the `MUX_WEBHOOK_SECRET` environment variable in your [Vercel project settings](https://vercel.com/docs/environment-variables). Trigger a redeploy and the secret will be pushed to Convex automatically.

## What it does

- **Automatic moderation** -- when a video is uploaded or a webhook fires for `video.asset.ready`, the app runs a Mux Robots moderation job and stores sexual/violence scores
- **Custom Q&A questions** -- configure yes/no questions (e.g. "Is this an animated video?") that get asked about every video via Mux Robots
- **Configurable thresholds** -- set review and reject thresholds per dimension; videos are dynamically classified as Pass, Review, or Reject
- **Auto-reject** -- when a reject threshold is set, assets exceeding it are automatically rejected and the rejected webhook fires
- **Q&A rules** -- reject or bypass auto-reject based on Q&A answers (e.g. "reject if 'Is this a professional sports broadcast?' is YES")
- **Rejected webhook** -- configurable URL that receives a POST when any asset is rejected (auto, rule-based, or manual), with optional authentication header
- **Bulk actions** -- select multiple assets and approve, reject, or re-run moderation in batch
- **Asset detail drawer** -- click any row to open a side panel with a Mux video player, full moderation scores, per-frame thumbnails, and Q&A answers
- **Import** -- import existing assets from your Mux environment with a modal that shows your current configuration
- **Webhook-driven** -- uses the Mux CLI webhook forwarder for local dev; in production, configure a webhook endpoint in the Mux dashboard

## How moderation works

### Classification vs Decision

The system separates two concepts:

**Classification** is computed dynamically from scores and your current thresholds. It updates instantly when you change thresholds. Classifications are never stored -- they're a function of `(scores, thresholds)`:

| Classification | Condition |
|---|---|
| **Pass** | All scores below the review threshold |
| **Review** | Any score between the review and reject thresholds |
| **Reject** | Any score at or above the reject threshold |

**Decision** is a historical action that was taken on an asset. Decisions don't change when thresholds change:

| Decision | Meaning |
|---|---|
| **Unreviewed** | No action taken yet |
| **Auto-rejected** | Automatically rejected by the system (score threshold or Q&A rule) |
| **Rejected** | Manually rejected by a human |
| **Approved** | Manually approved by a human |

### The moderation pipeline

1. An asset becomes ready (via upload or webhook)
2. `runModeration` sends a `POST /robots/v1/jobs/moderate` request to Mux Robots
3. `pollModeration` checks job status every 5 seconds; when complete, stores scores
4. In parallel, `runAskQuestions` sends configured Q&A questions to Mux Robots
5. `pollAskQuestions` stores answers when the job completes
6. The **auto-action coordinator** runs after both jobs finish:
   - If a reject threshold is set and any score exceeds it, check bypass rules, then auto-reject
   - If any Q&A rejection rule matches, auto-reject
   - On auto-reject, fire the rejected webhook
7. Results appear in the dashboard in real-time (Convex queries are reactive)

### When thresholds change

If you change thresholds, the dashboard UI updates immediately -- assets reclassify based on the new values. But historical decisions stay. Assets that were previously "review" and now classify as "reject" won't be auto-rejected retroactively. You can use **bulk actions** to reject them manually, or **bulk re-run** moderation to re-evaluate with the new thresholds.

## Configuration

Click **Configuration** in the header to open the settings modal.

### Thresholds

Set review and reject thresholds (0--100) for each moderation dimension:

| Dimension | Review | Reject |
|---|---|---|
| Sexual | Score above this needs human review | Score above this triggers auto-reject (optional) |
| Violence | Score above this needs human review | Score above this triggers auto-reject (optional) |

The **review threshold** defaults to 90. The **reject threshold** is optional -- leave it blank to disable auto-reject for that dimension. When a reject threshold is set, auto-reject is implicitly enabled.

### Q&A Questions

Add custom yes/no questions that are asked about every video using the Mux Robots API. Examples:

- "Is this an animated video?"
- "Does this video contain a person speaking on camera?"
- "Is there text or a watermark overlaid on the video?"

Answers appear as columns in the moderation results table and in the asset detail drawer.

### Q&A Rules

Rules automate decisions based on Q&A answers. There are two types:

**Reject rules** trigger rejection regardless of scores:
> "Reject if 'Is this a professional sports broadcast?' is YES"

Use case: a platform that doesn't allow reposted sports content, regardless of sexual/violence scores.

**Bypass rules** prevent score-based auto-reject when matched:
> "Don't auto-reject if 'Is this a person doing exercise?' is YES"

Use case: a fitness platform where exercise videos may score high on violence (due to physical activity) but should not be rejected.

Both rule types are evaluated by the auto-action coordinator after moderation and Q&A complete.

### Rejected Webhook

Configure a URL to receive a POST request whenever an asset is rejected. The webhook fires on:

- **Auto-reject** -- score exceeds the reject threshold
- **Rule-based reject** -- a Q&A rejection rule matched
- **Manual reject** -- a human clicked Reject or used Bulk Reject

The request body:

```json
{
  "event": "rejected",
  "muxAssetId": "abc123...",
  "trigger": "auto-reject",
  "timestamp": "2025-01-15T12:00:00.000Z"
}
```

The `trigger` field is one of: `auto-reject`, `rule`, or `manual`.

You can add a **custom header** for authentication (e.g. `X-Webhook-Secret: whsec_...`). Click "Generate Secret" to create a random secret value.

All webhook calls are logged with the HTTP status and response body for debugging.

### Customizing the reject action

The rejected webhook is the integration point for your application. When you receive a webhook POST, you can:

- Delete or disable the asset in your application
- Move it to a quarantine queue
- Notify a moderator via Slack, email, or your internal tools
- Log it to your audit system

To set this up:

1. Create an endpoint in your application that handles POST requests
2. Enter the URL in Configuration > Rejected Webhook
3. Optionally add a secret header for authentication
4. Your endpoint will receive the payload above for every rejection

## Importing existing assets

Click **Import Assets** in the header. The modal shows your current configuration and lets you choose:

- **Run moderation on imported assets** (default: on) -- schedules moderation jobs for each asset
- **Include video metadata** (default: on) -- syncs metadata from Mux

Imported assets always skip auto-reject to prevent accidental mass rejections before your thresholds are tuned. After importing, review the results and adjust thresholds as needed.

## Prerequisites

- [Node.js](https://nodejs.org) 18+
- A [Mux](https://dashboard.mux.com) account with an API Access Token (Token ID + Secret)
- A [Convex](https://convex.dev) account
- (Optional) [Mux CLI](https://github.com/muxinc/cli) for local webhook forwarding

## Local development

### 1. Clone and install

```bash
git clone <this-repo>
cd content-moderation-dashboard
npm install
```

### 2. Set up Convex

```bash
npx convex dev
```

This will prompt you to log in to Convex and create or link a project. It will sync your functions and output your deployment URL.

### 3. Set environment variables

Set your Mux credentials in Convex:

```bash
npx convex env set MUX_TOKEN_ID <your-mux-token-id>
npx convex env set MUX_TOKEN_SECRET <your-mux-token-secret>
```

If you're using the Mux CLI webhook forwarder, it generates its own signing secret when you run `mux webhooks listen`. Set that:

```bash
npx convex env set MUX_WEBHOOK_SECRET <signing-secret-from-forwarder>
```

Your `.env.local` should have (created automatically by `npx convex dev`):

```
CONVEX_DEPLOYMENT=dev:<your-project>
NEXT_PUBLIC_CONVEX_URL=https://<your-project>.convex.cloud
```

### 4. Run the dev servers

You need three processes running:

**Terminal 1** -- Convex dev server:
```bash
npx convex dev
```

**Terminal 2** -- Next.js dev server:
```bash
npm run dev
```

**Terminal 3** -- Mux webhook forwarder (optional, for receiving real-time webhook events):
```bash
mux webhooks listen --forward-to https://<your-project>.convex.site/mux/webhook
```

The webhook forwarder will print a signing secret -- make sure `MUX_WEBHOOK_SECRET` in Convex matches it.

Then open [http://localhost:3000](http://localhost:3000).

## Architecture

```
convex/
  schema.ts              Database schema
  moderation.ts          Moderation queries, mutations, auto-action coordinator
  moderationActions.ts   Mux Robots API integration, polling, webhook firing
  settings.ts            Configuration (thresholds, rules, webhook URL)
  questions.ts           Q&A question CRUD
  muxWebhook.ts          Mux webhook handler
  migrations.ts          Asset import/backfill
  uploads.ts             Direct upload URL creation
  videoQueries.ts        Asset queries with moderation join
  http.ts                HTTP routes (webhook endpoint)

src/
  app/page.tsx                         Main page with tabs, drawer, config modal
  components/
    AllAssetsView.tsx                   All Assets tab
    ModerationResultsView.tsx          Moderation Results tab with dual filters + bulk actions
    TableShell.tsx                     Shared table with checkboxes, scores, Q&A columns
    AssetDrawer.tsx                    Detail drawer with player, scores, thumbnails, Q&A
    ConfigurationModal.tsx             Full-page config: thresholds, rules, webhook
    BackfillPanel.tsx                  Import modal with config summary
    UploadForm.tsx                     Video upload
```
