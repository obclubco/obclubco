# OBC Partnership Program

Private learning site for OB Club partners. Partners log in with an email and password the OBC team creates for them, then
work through video courses on **sales, business building and personal branding**. Every lesson ends with a short quiz,
and passing it unlocks the next lesson.

Built with **Next.js 16 (App Router, static export)**, **Tailwind CSS 4** and **Supabase** (auth, database and
optional video storage). The site is plain static files, hosted on GitHub Pages; all access control happens in Supabase.

---

## 1. Set up Supabase (one time)

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor** → paste all of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) → **Run**.
3. Run [`supabase/migrations/0002_public_pages.sql`](supabase/migrations/0002_public_pages.sql) the same way
   (powers the public About and Coaches pages).
4. Optional: run [`supabase/seed.sql`](supabase/seed.sql) to load an example course (change the emails first).
5. **Authentication → Sign In / Providers**: keep **Email** enabled and turn **off** "Allow new users to sign up",
   so only the OBC team can create accounts (step "Managing partners" below).
6. **Authentication → URL Configuration** → *Site URL*: `https://partner.obclub.co`.

## 2. Run the site

```bash
cp .env.example .env.local   # fill in the URL + anon key from Supabase → Project Settings → API
npm install
npm run dev                  # http://localhost:3000
```

## 3. Put it live on partner.obclub.co (GitHub Pages)

The site is fully static, so GitHub Pages hosts it for free. Every push to the `partner` branch rebuilds it
automatically (see [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)). The main obclub.co site isn't touched.

**a. Add the Supabase settings to GitHub**
Repo → **Settings → Secrets and variables → Actions → Variables tab → New repository variable**:
- `NEXT_PUBLIC_SUPABASE_URL`: from Supabase → Project Settings → API
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: the `anon` / publishable key from the same page (it's safe to be public; the database rules protect the data)

Then **Actions → Deploy to GitHub Pages → Run workflow** (or push to `partner`). This creates the `gh-pages` branch.

**b. Point GitHub Pages at the built site**
Repo → **Settings → Pages**:
- *Source*: **Deploy from a branch** → branch **`gh-pages`**, folder **`/ (root)`** → Save
- *Custom domain*: `partner.obclub.co` → Save

**c. Add the DNS record** wherever obclub.co's DNS is managed (registrar, Cloudflare, or your website builder).
Only add this one record; don't change the existing `obclub.co` / `www` records:

| Type | Name / Host | Value / Target |
| --- | --- | --- |
| `CNAME` | `partner` | `obclubco.github.io` |

Cloudflare users: set it to **DNS only** (grey cloud) so GitHub can issue the certificate.

**d. Turn on HTTPS**
"Domain is not eligible for HTTPS at this time" means GitHub can't see the DNS record yet. Once the record is
live, GitHub issues the certificate automatically (usually within an hour, occasionally up to 24 hours).
Then tick **Enforce HTTPS** in Settings → Pages. If the message doesn't go away after the DNS record is in place,
remove the custom domain in Settings → Pages, save, and add it again. This restarts the certificate request.

**e. Point Supabase at the site**
Supabase → **Authentication → URL Configuration** → *Site URL*: `https://partner.obclub.co`.

---

## Managing partners (Supabase → Table Editor)

| Task | How |
| --- | --- |
| **Add a partner** | 1. **Table Editor → `allowed_emails`** → insert a row: their email in **lowercase**, optional `full_name`.<br>2. **Authentication → Users → Add user → Create new user**: same email, a password, tick **Auto Confirm User**.<br>3. Send them the email and password. They log in at partner.obclub.co. |
| **Make someone an admin** | Set `is_admin = true` on their `allowed_emails` row. Admins see the **Admin** page (partner progress) and can preview draft courses. |
| **Change a password** | **Authentication → Users** → the user's menu → **Update password** (or delete and re-create the user). |
| **Revoke access** | Delete their `allowed_emails` row. They lose access to all content immediately (delete the user under Authentication → Users too, to remove the account). |

Order matters: add the `allowed_emails` row **before** creating the user. The database refuses to create an account
for any email that isn't on the list (you'd see "Database error creating new user").

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

## Public pages: About and Coaches

- **About** (`/about/`) shows a summary of every **published** course automatically: title, subtitle,
  description, number of lessons and total minutes. Nothing about lessons, videos or quiz answers is public.
- **Coaches** (`/coaches/`) lists rows from the **`coaches`** table (Table Editor → `coaches`):
  - `name`, `role` (e.g. "Founder & Sales Coach"), `photo_url` (square image link; shown in black and white,
    in colour on hover), `bio` (short intro)
  - `experience`: longer text, line breaks are kept
  - `highlights`: short badges, e.g. `{"12 years in B2B sales","€10M+ closed"}`
  - `portfolio`: links as JSON, e.g. `[{"label": "LinkedIn", "url": "https://…"}, {"label": "Case study", "url": "https://…"}]`
  - `sort_order` for the order, `is_published` to hide someone without deleting them

  There's a ready-to-edit example at the bottom of `0002_public_pages.sql`.

## How it works

- **Log in**: email + password (Supabase Auth). Accounts are created by the OBC team; there is no public sign-up.
- **Lesson flow**: watch the video → "I've watched it" (uploaded videos mark themselves as watched when they finish) →
  answer the questions → the score is checked in the database → pass to unlock the next lesson.
  Partners can retake quizzes; the best score is kept.
- **Security**: row-level security on every table. Partners can't read the answer key (`correct_option` and
  `explanation` are hidden from the API), and quizzes are graded by the database function `submit_quiz`,
  so progress can't be faked from the browser.

## Branding

The design follows obclub.co: near-black background with a faint grid and stars, a floating bordered nav,
pill badges, white pill buttons, a heavy serif for headlines (Fraunces) and a wide-tracked sans for text (Geist).
Motion (always on, including for visitors whose device asks for reduced motion):
- **Background** ([`components/Backdrop.tsx`](components/Backdrop.tsx), [`components/Starfield.tsx`](components/Starfield.tsx)):
  stars with depth that drift, twinkle, shift with scroll and cursor, move away from the cursor, plus the occasional
  shooting star; a spotlight and brighter grid lines around the cursor; a slowly breathing top light.
- **Entrances and scroll reveals** ([`app/globals.css`](app/globals.css), [`components/Motion.tsx`](components/Motion.tsx)):
  add `className="enter"` (with `style={{ "--d": "200ms" }}` to delay) for on-load entrances, `data-reveal` to reveal
  on scroll, and [`<SplitWords>`](components/SplitWords.tsx) for headlines that rise in word by word.
- **Interactions**: buttons glow and nudge their arrow; `glow-card` makes a light follow the cursor around a card;
  `lift` floats clickable cards; the nav turns solid on scroll; quiz scores count up and check marks draw in.
Colors live in [`app/globals.css`](app/globals.css) (the `@theme` block), fonts in [`app/layout.tsx`](app/layout.tsx),
and the log in page text in [`components/LoginScreen.tsx`](components/LoginScreen.tsx).
To change the browser-tab icon, replace [`app/icon.png`](app/icon.png) (square PNG, 512×512 is ideal) and
[`app/apple-icon.png`](app/apple-icon.png) (180×180).

## Project layout

```
app/
  page.tsx                         first page: opening intro + partner log in (email + password)
  about/, coaches/                 public pages: course summary, coaches' experience and portfolio
  login/                           same log in page, kept so older /login/ links still work
  icon.png, apple-icon.png         browser-tab and home-screen icons
  no-access/                       shown to signed-in users who aren't on the allowlist
  (app)/dashboard/                 partner home: courses + progress
  (app)/course/?slug=…             course overview
  (app)/lesson/?course=…&id=…      video + quiz
  (app)/admin/                     partner progress (admins only)
components/                        UI, log in gate (MemberGate), lesson player + quiz
lib/                               Supabase client, data queries, video URL handling
.github/workflows/deploy.yml       builds and publishes to GitHub Pages
supabase/migrations/0001_init.sql  database schema, security rules, grading functions
supabase/seed.sql                  example content
```
