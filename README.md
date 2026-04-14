# Content Moderation Dashboard

A content moderation dashboard for [Mux](https://mux.com) video assets. Automatically analyzes videos for sexual and violent content using the [Mux Robots API](https://docs.mux.com/api-reference/video#tag/Robots), with configurable review/reject thresholds and custom Q&A questions.

Built with [Next.js](https://nextjs.org), [Convex](https://convex.dev), and [Mux](https://mux.com).

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmuxinc%2Fcontent-moderation-dashboard&project-name=content-moderation-dashboard&repository-name=content-moderation-dashboard&demo-title=Content%20Moderation%20Dashboard&demo-description=A%20content%20moderation%20dashboard%20for%20Mux%20video%20assets%20using%20the%20Mux%20Robots%20API&products=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22convex%22%2C%22productSlug%22%3A%22convex%22%2C%22protocol%22%3A%22storage%22%7D%5D)

Clicking the button above will:

1. Clone this repo to your GitHub account
2. Prompt you to install the **Convex integration** (provisions a Convex project and sets `CONVEX_DEPLOY_KEY` automatically)
3. Deploy the app to Vercel

### After deploying

Set your Mux credentials as Convex environment variables. You can do this from the [Convex dashboard](https://dashboard.convex.dev) or via the CLI:

```bash
npx convex env set MUX_TOKEN_ID <your-mux-token-id> --prod
npx convex env set MUX_TOKEN_SECRET <your-mux-token-secret> --prod
```

Then configure a Mux webhook in the [Mux dashboard](https://dashboard.mux.com/settings/webhooks) pointing to your Convex HTTP endpoint:

```
https://<your-project>.convex.site/mux/webhook
```

Set the webhook signing secret in Convex:

```bash
npx convex env set MUX_WEBHOOK_SECRET <signing-secret-from-mux-dashboard> --prod
```

## What it does

- **Automatic moderation** -- when a video is uploaded or a webhook fires for `video.asset.ready`, the app runs a Mux Robots moderation job and stores sexual/violence scores
- **Custom Q&A questions** -- configure yes/no questions (e.g. "Is this an animated video?") that get asked about every video via Mux Robots
- **Configurable thresholds** -- set review and reject thresholds per dimension; videos are classified as Clear, Needs Review, or Auto-reject
- **Asset detail drawer** -- click any row to open a side panel with a Mux video player, full moderation scores, per-frame analysis, and Q&A answers
- **Backfill** -- import existing assets from your Mux environment and run moderation on all of them
- **Webhook-driven** -- uses the Mux CLI webhook forwarder for local dev; in production, configure a webhook endpoint in the Mux dashboard

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

### 5. Import existing assets

Start the dev servers, then either:

- Click **Import Assets** in the header bar, or
- Run manually:

```bash
npx convex run migrations:backfillMux '{"includeVideoMetadata": true, "runModeration": true}'
```

This fetches all assets from your Mux account, syncs them into Convex, and schedules moderation jobs for each one.

## Configuration

Click **Configuration** in the header to open the settings panel:

### Thresholds

Set review and reject thresholds (0-100) for each moderation dimension:

| Dimension | Review (suggested) | Reject (suggested) |
|-----------|-------------------|-------------------|
| Sexual    | 30                | 70                |
| Violence  | 40                | 80                |

- Scores below **Review** = Clear
- Scores between **Review** and **Reject** = Needs human review
- Scores above **Reject** = Auto-reject

### Q&A Questions

Add custom yes/no questions that are asked about every video using the Mux Robots ask-questions API. Examples:

- "Is this an animated video?"
- "Does this video contain a person speaking on camera?"
- "Is there text or a watermark overlaid on the video?"

Answers appear as additional columns in the moderation results table.

## Architecture

```
├── convex/                  # Convex backend
│   ├── schema.ts            # Database schema
│   ├── moderation.ts        # Moderation queries & mutations
│   ├── moderationActions.ts # Robots API integration (moderate + ask-questions)
│   ├── settings.ts          # Threshold settings
│   ├── questions.ts         # Q&A question CRUD
│   ├── muxWebhook.ts        # Webhook handler
│   ├── migrations.ts        # Asset backfill
│   ├── uploads.ts           # Direct upload URL creation
│   ├── videoQueries.ts      # Asset queries with moderation join
│   └── http.ts              # HTTP routes (webhook endpoint)
├── src/
│   ├── app/page.tsx         # Main page with tabs, drawer, config
│   └── components/
│       ├── AllAssetsView.tsx          # All Assets tab
│       ├── ModerationResultsView.tsx  # Moderation Results tab (filterable)
│       ├── TableShell.tsx             # Shared table with dynamic Q&A columns
│       ├── AssetDrawer.tsx            # Side drawer with video player + details
│       ├── ThresholdSettings.tsx      # Threshold configuration
│       ├── QuestionManager.tsx        # Q&A question management
│       ├── UploadForm.tsx             # Video upload button
│       └── BackfillPanel.tsx          # Import assets button
```

### How moderation works

1. An asset becomes ready (via upload or webhook)
2. `runModeration` creates a `POST /robots/v1/jobs/moderate` job and schedules polling
3. `pollModeration` checks the job status every 5s; when complete, stores scores
4. In parallel, `runAskQuestions` sends configured Q&A questions to `POST /robots/v1/jobs/ask-questions`
5. `pollAskQuestions` stores the answers when the job completes
6. Results appear in the dashboard in real-time (Convex queries are reactive)
