# Interactive MCQ Video Assessment Platform

A production-ready, anonymous browser-based video assessment and interactive quiz application built with **React 18**, **TypeScript 5**, **Vite 5**, **Supabase PostgreSQL**, and deployed on **Netlify**.

---

## 🌟 Key Features

1. **Integrated Video Player & 10 MCQ Checkpoints**
   - HTML5 streaming video player with native byte-range scrubbing.
   - Anti-skip checkpoint locks: Students cannot jump past unanswered questions.
   - Smooth pause & auto-resume at each of the 10 learning checkpoints.

2. **100% Anonymous Participant Tracking**
   - Cryptographically secure UUIDs generated in the browser and persisted in `localStorage`.
   - **Zero Personal Identifiable Information (PII)**: No student names, roll numbers, emails, phone numbers, or device fingerprinting.
   - Deterministic anonymous display labels (e.g. `Student 1`, `Student 2`, etc.).

3. **Graduated Submission Scoring (Phase 3 Rules)**
   - **1st submission**: 1.0 mark
   - **2nd submission**: 0.8 marks
   - **3rd submission**: 0.6 marks
   - **4th submission**: 0.4 marks
   - **5th submission**: 0.2 marks
   - **6th+ submission**: 0.0 marks
   - **Maximum Score**: 10.0 marks for 10 questions.
   - **Accuracy Rate**: `(Correct final answers / Total questions answered) × 100`.

4. **Persistent Attempt History & Option C (Latest & Best Tracking)**
   - Every completed quiz attempt is recorded as a separate record (never overwritten).
   - Tracks **Latest Attempt Score** (by completion timestamp).
   - Tracks **Best Attempt Score** (highest score; tiebreaker is shorter completion duration).
   - "Try Again" allows students to repeat the assessment while preserving complete history.

5. **Private Owner CSV Export for Microsoft Excel**
   - Protected server-side Netlify Function (`/.netlify/functions/export-csv`).
   - Secured with a private administrator passcode (`QUIZ_ADMIN_KEY`).
   - Formula injection protection: Sanitizes values starting with `=`, `+`, `-`, `@`, `\t`, `\r` to prevent spreadsheet formula execution.
   - Generates two comprehensive sections:
     1. **Attempt-Level Summary**: Participant ID, Student Label, Attempt #, Status, Score, Accuracy, Duration, Latest/Best Scores.
     2. **Question-Level Details**: Question #, Category, Submissions Required, Marks Awarded, Time Spent, Timestamps.

6. **Secure Database Permissions (Row Level Security)**
   - Public anonymous users can only interact via trusted `SECURITY DEFINER` RPC functions.
   - Anonymous participants cannot query or list other students' records.
   - Privileged operations and full database exports run exclusively through the server-side Netlify Function using the Supabase Service Role key.

7. **Resilient Offline / Local Storage Fallback**
   - If Supabase is unreachable or unconfigured, the app automatically falls back to `localStorage`.
   - Results, attempt counts, and latest/best scores function locally without throwing runtime exceptions.
   - Results screen clearly indicates database sync status.

---

## 🏗️ Project Architecture

```
├── .env.example                     # Environment variable templates
├── netlify.toml                     # Netlify build and functions configuration
├── package.json                     # Dependencies and scripts
├── public/
│   └── video.mp4                    # Master educational video asset (61.5 MB)
├── netlify/
│   └── functions/
│       └── export-csv.ts            # Protected server-side CSV export function
├── supabase/
│   └── migrations/
│       └── 001_quiz_tracking.sql    # Supabase PostgreSQL schema, RPCs, & RLS
└── src/
    ├── App.tsx                      # Main application & assessment session coordinator
    ├── main.tsx                     # Entry point
    ├── index.css                    # VS Code dark theme styling
    ├── types.ts                     # TypeScript definitions
    ├── vite-env.d.ts                # Vite environment typings
    ├── config/
    │   └── quizConfig.ts            # Video metadata & 10 MCQ questions
    ├── utils/
    │   └── scoring.ts               # Graduated scoring logic
    ├── services/
    │   ├── participant.ts           # Anonymous UUID & local storage service
    │   └── supabase.ts              # Supabase PostgreSQL API client & offline fallback
    └── components/
        ├── VideoPlayer.tsx          # Video player with anti-skip & auto-resume
        ├── QuizPopup.tsx            # Slide-up modal for answering questions
        ├── CompletionScreen.tsx     # Final results screen with breakdown & stats
        ├── ReviewModal.tsx          # Question review dialog
        ├── VSCodeStatusBar.tsx      # VS Code status bar with Student label & Owner button
        └── AdminExportModal.tsx     # Owner passcode prompt for CSV download
```

---

## 🚀 Setup Instructions

### 1. Supabase PostgreSQL Setup
1. Create a free account and new project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor** in your Supabase dashboard.
3. Open `supabase/migrations/001_quiz_tracking.sql`, copy all contents, paste into the SQL Editor, and click **Run**.
4. Go to **Project Settings** -> **API**:
   - Copy **Project URL**
   - Copy **anon public key**
   - Copy **service_role secret key** *(Keep this private!)*

### 2. Environment Configuration
Create a `.env` file in the project root:

```env
# Client-Side (Vite)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key

# Server-Side (Netlify Functions)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-secret-key
QUIZ_ADMIN_KEY=create-a-strong-passcode-for-owner-csv-download
```

### 3. Local Development
```bash
# Run local Vite dev server
npm run dev

# Or run with Netlify CLI to test server-side functions locally
npx netlify dev
```

---

## 🌐 Netlify Deployment Guide

### Option A: Deploy via GitHub / GitLab Repository
1. Push this repository to GitHub.
2. In Netlify, click **Add new site** -> **Import an existing project**.
3. Select your repository.
4. Netlify will automatically detect settings from `netlify.toml`:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Functions directory**: `netlify/functions`
5. Under **Site configuration** -> **Environment variables**, add:
   - `VITE_SUPABASE_URL` = `https://your-project-id.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `<your-anon-key>`
   - `SUPABASE_URL` = `https://your-project-id.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = `<your-service-role-key>`
   - `QUIZ_ADMIN_KEY` = `<your-chosen-admin-passcode>`
6. Click **Deploy Site**.

### Option B: Deploy via Netlify CLI
```bash
# Login to Netlify
npx netlify login

# Link and deploy
npx netlify init
npx netlify deploy --prod
```

---

## 📊 How to Export Results (Owner CSV)

1. Open your live application in the browser.
2. In the bottom VS Code status bar (bottom right), click **Owner Export**.
3. Enter your secret `QUIZ_ADMIN_KEY` passcode.
4. Click **Download Database CSV**.
5. The browser will download `quiz_results_YYYY-MM-DD.csv`, which opens directly in **Microsoft Excel**, **Apple Numbers**, or **Google Sheets**.
