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
   - *Site URL*: your live domain, e.g. `https://partners.obclub.co`
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

Deploy to Vercel (or any Node host) with the same three environment variables. Set `NEXT_PUBLIC_SITE_URL` to the live URL.

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
