# OBC Partnership Program

Private learning site for OB Club partners. Partners sign in with an email the OBC team has approved, then
work through video courses on **sales, business building and personal branding**. Every lesson ends with a short quiz,
and passing it unlocks the next lesson.

Built with **Next.js 16 (App Router)**, **Tailwind CSS 4** and **Supabase** (auth, database and optional video storage).

---

## 1. Set up Supabase (one time)

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor** → paste all of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) → **Run**.
3. Optional: run [`supabase/seed.sql`](supabase/seed.sql) to load an example course (change the emails first).
4. **Authentication → URL Configuration**
   - *Site URL*: your live domain, `https://partners.obclub.co` (see step 3)
   - *Redirect URLs*: add `https://partners.obclub.co/auth/callback` and `http://localhost:3000/auth/callback`
5. **Authentication → Email Templates → Magic Link**: so partners can also type a code (handy when they open
   the email on another device), add the code to the template, for example:
   ```html
   <h2>Your OB Club Partners sign-in</h2>
   <p><a href="{{ .ConfirmationURL }}">Sign in</a></p>
   <p>Or enter this code: <strong>{{ .Token }}</strong></p>
   ```
6. For real email volume, set up custom SMTP (**Authentication → Emails → SMTP**). Supabase's built-in sender is rate-limited.

## 2. Run the site

```bash
cp .env.example .env.local   # fill in the URL + anon key from Supabase → Project Settings → API
npm install
npm run dev                  # http://localhost:3000
```

## 3. Put it live on partners.obclub.co

The partner site runs as its own app on the subdomain, so the main obclub.co site is not touched.

**a. Deploy the app (Vercel is easiest, free tier is fine)**
1. [vercel.com/new](https://vercel.com/new) → import the `obclubco/obclubco` GitHub repo (framework: Next.js, settings unchanged).
2. Before deploying, add the environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`: from Supabase → Project Settings → API
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: from the same page
   - `NEXT_PUBLIC_SITE_URL` = `https://partners.obclub.co`
3. Deploy. You'll get a temporary `*.vercel.app` address to test with.

**b. Attach the subdomain**
1. Vercel project → **Settings → Domains** → add `partners.obclub.co`.
2. Vercel shows the DNS record to create. It's normally:

   | Type | Name / Host | Value / Target |
   | --- | --- | --- |
   | `CNAME` | `partners` | `cname.vercel-dns.com` |

   Use the exact value Vercel shows if it differs (newer projects get a project-specific target).
3. Add that record wherever obclub.co's DNS is managed (your domain registrar, Cloudflare, or your website
   builder's domain settings). Only add the new `partners` record; don't change the existing records for
   `obclub.co` or `www`.
   - **Cloudflare:** set the record to **DNS only** (grey cloud) so Vercel can issue the SSL certificate.
4. Wait a few minutes (it can take up to 48 hours) until Vercel shows the domain as **Valid**. HTTPS is set up automatically.

**c. Point Supabase at the new address**
Supabase → **Authentication → URL Configuration**:
- *Site URL*: `https://partners.obclub.co`
- *Redirect URLs*: `https://partners.obclub.co/auth/callback` (keep `http://localhost:3000/auth/callback` for local development)

Without this step, sign-in links won't bring partners back to the site.

**d. Optional:** link to the partner site from obclub.co (for example a "Partner login" button to `https://partners.obclub.co/login`).

Other hosts (Netlify, Railway, a server of your own) work the same way: deploy, add the domain in the host's
settings, then create the DNS record the host gives you.

---

## Managing partners (Supabase → Table Editor)

| Task | How |
| --- | --- |
| **Authorise a partner** | Add a row to `allowed_emails` (email in **lowercase**, optional `full_name`). They can sign in right away. |
| **Make someone an admin** | Set `is_admin = true`. Admins see the **Admin** page (partner progress) and can preview draft courses. |
| **Revoke access** | Delete their `allowed_emails` row. They lose access to all content immediately. |

Anyone whose email isn't on the list can't create an account. The database blocks it, not only the website.

## Adding courses

All content lives in three tables. Add rows in the Table Editor (or with SQL, see `supabase/seed.sql`).

**`courses`**
- `slug`: used in the URL, lowercase with dashes (`sales-foundations`)
- `title`, `subtitle`, `description`, `cover_image_url` (optional image link)
- `category`: `sales`, `business`, `personal_branding` or `other`
- `sort_order`: display order · `pass_percentage`: quiz pass mark (default 70)
- `is_published`: partners only see published courses; admins see drafts too

**`lessons`**
- `course_id`: the course's `id`
- `title`, `description`, `duration_minutes`, `sort_order` (lessons unlock in this order)
- `video_url`, which can be:
  - a YouTube, Vimeo (including unlisted links) or Loom link
  - a direct `.mp4` link
  - `storage:folder/file.mp4` for a file uploaded to the private **`lesson-videos`** bucket
    (Supabase → Storage). Only signed-in partners can play these.

**`questions`** (multiple choice, shown after the lesson video)
- `lesson_id`: the lesson's `id`
- `prompt`: the question
- `options`: a JSON list of answers, e.g. `["Pitch every feature", "Listen first", "Send a proposal"]`
- `correct_option`: the number of the right answer, **counting from 1** (`2` = the second option)
- `explanation`: optional, shown after the partner submits
- `sort_order`

A lesson with no questions is complete once the partner marks the video as watched.

## How it works

- **Sign-in**: passwordless email link or 6-digit code (Supabase Auth).
- **Lesson flow**: watch the video → "I've watched it" (uploaded videos mark themselves as watched when they finish) →
  answer the questions → the score is checked in the database → pass to unlock the next lesson.
  Partners can retake quizzes; the best score is kept.
- **Security**: row-level security on every table. Partners can't read the answer key (`correct_option` and
  `explanation` are hidden from the API), and quizzes are graded by the database function `submit_quiz`,
  so progress can't be faked from the browser.

## Branding

Every color and font is in [`app/globals.css`](app/globals.css) (the `@theme` block) and
[`app/layout.tsx`](app/layout.tsx) (fonts). Change them there to match obclub.co exactly. Landing page text is in
[`app/page.tsx`](app/page.tsx).

## Project layout

```
app/
  page.tsx                         public landing page
  login/                           email link / code sign-in
  auth/callback, auth/signout      auth routes
  no-access/                       shown to signed-in users who aren't on the allowlist
  (app)/dashboard                  partner home: courses + progress
  (app)/courses/[slug]             course overview
  (app)/courses/[slug]/lessons/…   video + quiz
  (app)/admin                      partner progress (admins only)
lib/                               Supabase clients, data queries, video URL handling
supabase/migrations/0001_init.sql  database schema, security rules, grading functions
supabase/seed.sql                  example content
```
