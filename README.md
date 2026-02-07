# CreatorPixel - Setup Guide

## What You're Getting

This is the Phase 1 MVP codebase for the Creator Data Platform. It includes:

- **Smart Link Engine** — Tracked redirects with browser fingerprinting and analytics
- **Link-in-Bio Pages** — Customizable bio pages with built-in tracking (Linktree replacement)
- **Analytics Dashboard** — Real-time click analytics with geographic, device, and referrer breakdowns
- **Visitor Identity Tracking** — Anonymous visitor profiles with fingerprint-based identity stitching
- **Full Auth System** — Email/password + Google OAuth via Supabase

---

## STEP 1: Set Up Supabase (Your Database)

You already have a Supabase account. Follow these steps:

### 1a. Create a New Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **"New Project"**
3. Name it something like `creatorpixel`
4. Set a strong database password (save this somewhere safe)
5. Choose the region closest to your users (US East if unsure)
6. Click **"Create new project"** and wait ~2 minutes for it to spin up

### 1b. Run the Database Schema

1. In your Supabase dashboard, click **"SQL Editor"** in the left sidebar
2. Click **"New Query"**
3. Open the file `supabase/migrations/001_initial_schema.sql` from this project
4. Copy the ENTIRE contents and paste into the SQL editor
5. Click **"Run"** (the green play button)
6. You should see "Success. No rows returned" — that means it worked

### 1c. Get Your API Keys

1. In Supabase, go to **Settings** → **API**
2. You'll need three values:
   - **Project URL** (looks like `https://abc123.supabase.co`)
   - **anon public key** (the long string under "Project API keys")
   - **service_role key** (click "Reveal" — keep this SECRET, never expose in frontend code)
3. Save these somewhere — you'll need them in Step 3

### 1d. Enable Google OAuth (Optional but Recommended)

1. In Supabase, go to **Authentication** → **Providers**
2. Find **Google** and enable it
3. You'll need to create a Google OAuth app:
   - Go to [console.cloud.google.com](https://console.cloud.google.com)
   - Create a project → APIs & Services → Credentials → Create OAuth Client ID
   - Set authorized redirect URI to: `https://YOUR-PROJECT-ID.supabase.co/auth/v1/callback`
4. Paste the Client ID and Secret into Supabase
5. Click **Save**

---

## STEP 2: Open the Project in Cursor

### 2a. Install Prerequisites

Make sure you have these installed on your computer:

- **Node.js** (version 18 or later) — Download from [nodejs.org](https://nodejs.org)
- **Git** — Download from [git-scm.com](https://git-scm.com)
- **Cursor** — You already have this

To check, open Terminal (Mac) or Command Prompt (Windows) and run:
```bash
node --version    # Should show v18.x.x or higher
git --version     # Should show git version 2.x.x
```

### 2b. Unzip and Open in Cursor

1. Unzip the `creator-data-platform.zip` file to wherever you keep projects
   (e.g., `Documents/Projects/creator-data-platform`)
2. Open Cursor
3. Go to **File** → **Open Folder**
4. Navigate to the `creator-data-platform` folder and select it
5. Cursor will open with the full project

### 2c. Install Dependencies

1. In Cursor, open the terminal: **View** → **Terminal** (or press `` Ctrl+` ``)
2. Run:
```bash
npm install
```
3. Wait for it to finish (usually 30-60 seconds)

### 2d. Configure Environment Variables

1. In Cursor's file explorer (left sidebar), find the file `.env.local.example`
2. Right-click it → **Rename** → Change it to `.env.local`
3. Open it and fill in your Supabase values from Step 1c:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=CreatorPixel
```

4. Save the file

### 2e. Run the Development Server

In the Cursor terminal, run:
```bash
npm run dev
```

You should see:
```
▲ Next.js 14.2.x
- Local: http://localhost:3000
```

Open your browser and go to **http://localhost:3000** — you should see the landing page!

---

## STEP 3: Test It Out

### 3a. Create an Account
1. Click "Get Started Free" on the landing page
2. Sign up with email/password (or Google if you set it up)
3. Check your email for a confirmation link (Supabase sends this)
4. After confirming, you'll be redirected to the dashboard

### 3b. Create Your First Smart Link
1. Go to **Smart Links** in the dashboard
2. Click **"New Link"**
3. Enter a destination URL (e.g., your YouTube channel)
4. Give it a title (e.g., "My YouTube Channel")
5. Check "Show on Bio Page" if you want it on your bio
6. Click **Create Link**

### 3c. Test the Tracking
1. Copy the Smart Link URL (click the copy icon)
2. Open it in a different browser or incognito window
3. You should see a brief "Redirecting..." screen, then get sent to the destination
4. Go back to your dashboard — the click should appear in real-time!

### 3d. Set Up Your Bio Page
1. Go to **Bio Page** in the dashboard
2. Set your URL slug (e.g., "andrew")
3. Add a title and description
4. Click **Save**
5. Visit `http://localhost:3000/andrew` to see your bio page

---

## STEP 4: Deploy to Vercel (Make It Live)

### 4a. Create a Vercel Account
1. Go to [vercel.com](https://vercel.com) and sign up (use "Continue with GitHub")
2. If you don't have a GitHub account, create one at [github.com](https://github.com)

### 4b. Push Your Code to GitHub
In Cursor's terminal:
```bash
# Initialize git repo
git init

# Add all files
git add .

# Make first commit
git commit -m "Initial commit - CreatorPixel MVP"
```

Then go to GitHub:
1. Click **"New Repository"** (the + icon in the top right)
2. Name it `creator-data-platform`
3. Leave it **Private**
4. DON'T initialize with README (we already have one)
5. Click **Create Repository**
6. Copy the two commands GitHub shows you under "push an existing repository" and run them in Cursor's terminal

### 4c. Deploy on Vercel
1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **"Import"** next to your `creator-data-platform` repo
3. Vercel will detect it's a Next.js project automatically
4. **IMPORTANT**: Before clicking Deploy, click **"Environment Variables"**
5. Add these three variables:
   - `NEXT_PUBLIC_SUPABASE_URL` → your Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → your anon key
   - `SUPABASE_SERVICE_ROLE_KEY` → your service role key
6. Click **"Deploy"**
7. Wait 2-3 minutes. Vercel will give you a URL like `creator-data-platform.vercel.app`

### 4d. Update Your Environment
1. In Vercel, go to **Settings** → **Environment Variables**
2. Add: `NEXT_PUBLIC_APP_URL` = `https://your-app-name.vercel.app` (use the URL Vercel gave you)
3. Redeploy: go to **Deployments** tab → click the three dots on the latest → **Redeploy**

### 4e. Update Supabase Auth Redirect
1. In Supabase, go to **Authentication** → **URL Configuration**
2. Set **Site URL** to your Vercel URL: `https://your-app-name.vercel.app`
3. Add your Vercel URL to **Redirect URLs**: `https://your-app-name.vercel.app/**`

---

## STEP 5: Custom Domain (Optional)

### On Vercel:
1. Go to your project **Settings** → **Domains**
2. Add your domain (e.g., `creatorpixel.com`)
3. Follow the DNS instructions Vercel shows

### Update Environment:
1. Change `NEXT_PUBLIC_APP_URL` to your custom domain
2. Update Supabase redirect URLs

---

## Using Cursor Effectively

Cursor is an AI-powered code editor. Here's how to make the most of it:

### Ask Cursor to Help You
- Press **Cmd+K** (Mac) or **Ctrl+K** (Windows) to open the AI chat
- You can ask things like:
  - "Add a dark mode toggle to the bio page"
  - "Create a new API route that exports click data as CSV"
  - "Add a chart showing clicks over time using Chart.js"
  - "Add email notifications when a link gets 100 clicks"

### The Composer (Multi-File Edits)
- Press **Cmd+Shift+I** (Mac) or **Ctrl+Shift+I** (Windows)
- This lets you describe bigger changes and Cursor will edit multiple files at once
- Great for: "Add a new Settings page with plan upgrade options"

### Quick Tips
- **Cmd+P** — Quick file search (type any filename to jump to it)
- **Cmd+Shift+F** — Search across all files
- Select code → **Cmd+K** — Ask AI to modify just that selection
- The terminal is always at the bottom (`` Ctrl+` `` to toggle)

---

## Project Structure

```
creator-data-platform/
├── src/
│   ├── app/
│   │   ├── page.tsx                  # Landing page
│   │   ├── layout.tsx                # Root layout
│   │   ├── [slug]/page.tsx           # Public bio page
│   │   ├── r/[code]/page.tsx         # Smart link redirect
│   │   ├── auth/
│   │   │   ├── login/page.tsx        # Login/signup
│   │   │   └── callback/route.ts     # OAuth callback
│   │   ├── dashboard/
│   │   │   ├── layout.tsx            # Dashboard sidebar
│   │   │   ├── page.tsx              # Overview
│   │   │   ├── links/page.tsx        # Link management
│   │   │   ├── analytics/page.tsx    # Analytics
│   │   │   └── bio/page.tsx          # Bio editor
│   │   └── api/
│   │       ├── track/route.ts        # ← CORE: Tracking engine
│   │       └── links/route.ts        # Link CRUD
│   ├── lib/
│   │   ├── supabase/                 # Database helpers
│   │   ├── fingerprint.ts            # Browser fingerprinting
│   │   └── utils.ts                  # Utility functions
│   └── components/
│       └── bio/BioPageClient.tsx      # Bio page with tracking
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql    # Database schema
└── .env.local                        # Your secrets (never commit!)
```

---

## What to Build Next

Once Phase 1 is running, here's the priority order for Phase 2:

1. **Site Pixel** — Add a JavaScript snippet endpoint at `/api/pixel.js`
2. **Email Pixel** — Add a tracking pixel endpoint at `/api/px/[id].gif`
3. **Visitor Profiles Page** — Show identified visitors in the dashboard
4. **Webhook/Export** — Push identified contacts to CRM or email tools
5. **Custom Domains** — Let creators use their own domains for bio pages
