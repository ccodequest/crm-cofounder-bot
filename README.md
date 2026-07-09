# CRM Co-Founder Telegram Bot

AI-powered CRM bot that manages team tasks, leads, and reviews with a strict AI co-founder persona.

## Setup

### Prerequisites
1. Node.js 20+
2. Supabase project
3. NVIDIA API key (build.nvidia.com)
4. Telegram Bot Token (from @BotFather)

### Environment Variables
Copy `.env.example` to `.env` and fill in:
- `TELEGRAM_BOT_TOKEN` — from @BotFather
- `TELEGRAM_WEBHOOK_SECRET` — random string for webhook security
- `SUPABASE_URL` — your Supabase project URL
- `SUPABASE_SERVICE_KEY` — Supabase service role key
- `OWNER_TELEGRAM_ID` — Your Telegram user ID
- `FOUNDER_TELEGRAM_ID` — Founder's Telegram ID (for escalation)
- `NVIDIA_API_KEY` — from build.nvidia.com
- `NVIDIA_MODEL` — Model ID (default: nvidia/nemotron-3-ultra-550b-a55b)
- `CRON_SECRET` — Secret for cron endpoint auth
- `DEFAULT_TONE` — Default bot tone (brutal/strict/neutral/gentle)

### Database
Run migration: `npm run db:migrate`
Or run the SQL in `supabase/migrations/001_initial.sql` directly in Supabase dashboard.

### Deploy to Vercel
1. Fork/clone repo
2. Connect to Vercel
3. Set environment variables
4. Set webhook:
   ```
   curl -F "url=https://your-domain.vercel.app/api/telegram/webhook" \
        -F "secret_token=YOUR_SECRET" \
        https://api.telegram.org/bot<TOKEN>/setWebhook
   ```

### First Use
1. Add bot to group
2. Send /start
3. Add team members: `/team add @username role`
4. Set tones: `/persona @username brutal`
5. Create pipeline: `/pipeline create "Sales" stages:"New,Contacted,Qualified,Deal,Won,Lost"`
6. Start assigning tasks: `/assign @username "Fix login bug" due:2025-01-20`

## Commands

### Team & Work
- `/assign @user "task" due:date` — Assign work
- `/done "details"` — Report completion
- `/status @user` — View workload
- `/overdue` — List overdue items
- `/followup "lead" cadence:"weekly"` — Schedule followup

### Lead Management
- `/lead "company, contact, info"` — Create lead
- `/research "domain"` — Deep AI research
- `/capture_lead` — (reply) Capture lead from message
- `/assign_lead @user "lead"` — Assign lead manually
- `/assign_lead_auto "lead"` — AI-recommended assignment

### Pipeline
- `/pipeline create "name" stages:"S1,S2,S3"` — Create pipeline
- `/stage "lead" "stage"` — Move lead stage
- `/pipeline_list` — List pipelines

### Review (Owner only)
- `/review` — Co-founder reviews pending reports
- `/approve` — Approve report
- `/revise "feedback"` — Request revision
- `/call_founder` — Escalate to founder with AI summary

### Admin (Owner only)
- `/team add @user role skills` — Add team member
- `/team list` — List team members
- `/team role @user role` — Change role
- `/persona @user brutal|strict|neutral|gentle|auto` — Set tone
- `/persona list` — Show member tones
- `/schema create "table" fields:"f1:text,f2:number"` — Create custom table
- `/schema list` — List custom tables
