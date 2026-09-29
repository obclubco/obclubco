# OB Club Networking

Private networking site for OB Club event guests, at **networking.obclub.co**. Every guest gets a login (email and
password) from the OBC team. Once logged in they see:

- **Their profile**: photo, role, company, a short bio, what they're looking for and how they can help, links. They
  edit it themselves and choose what to share.
- **Their event visits**: every OB Club event they've been to, and the upcoming ones they're on the list for.
- **The other guests**: everyone from those events, with their profiles. Searchable by name, company, city or
  interest, and filterable by event.

Admins (the OBC team) see every event and guest, and manage guest lists right on the site.

This branch (`networking`) is its own site, built the same way as the Partnership Program on the `partner` branch
(partner.obclub.co): **Next.js 16** (App Router, static export), **Tailwind CSS 4** and **Supabase** (logins,
database, profile photos), hosted as plain files on GitHub Pages. All access control happens in Supabase.

---

## 1. Set up Supabase (one time)

The networking site has its **own Supabase project**, so its logins are separate from the partner site's: the same
email can have one password for partner.obclub.co and another for networking.obclub.co. (It can also share the partner
project, but then each email has a single login for both sites.)

1. [supabase.com](https://supabase.com) → **New project** (e.g. `obc-networking`).
2. **SQL Editor** → paste all of [`supabase/migrations/0004_networking.sql`](supabase/migrations/0004_networking.sql)
   → **Run**. That's the only file the networking site needs (`0001` to `0003` belong to the partner site, on the
   `partner` branch).
3. Optional: run [`supabase/seed-networking.sql`](supabase/seed-networking.sql) for example events and guests. Change
   the first guest's email to your own before running it, so you're an admin.
4. **Authentication → Sign In / Providers**: keep **Email** on and turn **off** "Allow new users to sign up".
   **Authentication → URL Configuration** → *Site URL*: `https://networking.obclub.co`.

## 2. Run the site on your computer

```bash
cp .env.example .env.local   # fill in the URL + anon key from Supabase → Project Settings → API
npm install
npm run dev                  # http://localhost:3000
```

## 3. Put it live on networking.obclub.co

GitHub Pages can only serve one web address per repository, and this repository already serves partner.obclub.co.
So the networking site is built here and published to a second repository that only hosts it. Every push to the
`networking` branch rebuilds it (see [`.github/workflows/deploy-networking.yml`](.github/workflows/deploy-networking.yml)).
The partner site and the main obclub.co site aren't touched.

**a. Create the hosting repository**
GitHub → **New repository** → owner `obclubco`, name **`networking`**, **Public**, nothing else ticked → Create.
It will only ever hold the built site (no guest data: that stays in Supabase, behind the logins).

**b. Let this repository publish to it**
1. GitHub → your picture → **Settings → Developer settings → Personal access tokens → Fine-grained tokens →
   Generate new token**. Name: `networking deploy`. Expiration: the longest you're comfortable with (set a reminder
   to renew it). *Repository access*: **Only select repositories** → `obclubco/networking`.
   *Permissions → Repository permissions* → **Contents: Read and write** → Generate, and copy the token.
2. This repository (`obclubco/obclubco`) → **Settings → Secrets and variables → Actions → Secrets tab →
   New repository secret**: name `NETWORKING_PAGES_TOKEN`, value: the token.

**c. Supabase settings**
**Secrets and variables → Actions → Variables tab** → add `NETWORKING_SUPABASE_URL` and `NETWORKING_SUPABASE_ANON_KEY`
(the networking project's URL and anon / publishable key: Supabase → Project Settings → API). Without them the build
falls back to the partner site's `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, i.e. a shared project.

**d. Publish**
Every push to the **`networking`** branch runs **Actions → Deploy networking.obclub.co**, which builds the site and
creates the `gh-pages` branch in `obclubco/networking`. Runs before steps a–c stop at "Add the NETWORKING_PAGES_TOKEN
secret"; once they're done, open the latest run and click **Re-run all jobs**.

**e. Point GitHub Pages at it**
`obclubco/networking` → **Settings → Pages**:
- *Source*: **Deploy from a branch** → **`gh-pages`**, **`/ (root)`** → Save
- *Custom domain*: `networking.obclub.co` → Save

**f. Add the DNS record** where obclub.co's DNS is managed (same place as the `partner` record). Only add this one:

| Type | Name / Host | Value / Target |
| --- | --- | --- |
| `CNAME` | `networking` | `obclubco.github.io` |

Cloudflare users: **DNS only** (grey cloud).

**g. Turn on HTTPS**: once GitHub sees the DNS record it issues a certificate (usually within an hour). Then tick
**Enforce HTTPS** in `obclubco/networking` → Settings → Pages. Stuck on "not eligible for HTTPS"? Remove the custom
domain, save, and add it again.

---

## Managing events, guests and logins

| Task | How |
| --- | --- |
| **Add an event** | Supabase → **Table Editor → `events`** → Insert row: `title`, `starts_at` (date and time), optional `ends_at`, `location`, `description`, `cover_image_url` (an image link). Turn `is_published` off to prepare an event without guests seeing it. |
| **Put people on a guest list** | On the site, as an admin: **Events** → the event → **Manage the guest list** → paste email addresses, one per line (a column copied from a spreadsheet works). Someone new also needs a name: `Jane Doe, jane@company.com, Company`. They're added to the site and to the event in one go. **Remove** takes someone off the list: after an event, remove the no-shows so the list shows who was really there. |
| **Give someone a login** | Supabase → **Authentication → Users → Add user → Create new user**: the same email as on the guest list, a password, tick **Auto Confirm User**. Send them the email and password; they log in at networking.obclub.co and can change the password on their Profile page. The site's **Admin** page shows who has no login yet (**Copy … without a login**). |
| **Make someone an admin** | Table Editor → `guests` → set `is_admin` to true. Admins see every event and guest (hidden ones too), draft events, and the Admin page. |
| **Edit someone's profile** | Table Editor → `guests`. (Guests edit their own on the Profile page.) |
| **Change a password** | **SQL Editor** → `update auth.users set encrypted_password = extensions.crypt('NEW-PASSWORD', extensions.gen_salt('bf')) where email = 'their@email.com';` |
| **Remove someone** | Delete their `guests` row: they lose access and disappear from every guest list. Also delete the user under Authentication → Users to remove the login. |

Someone must be in the `guests` table **before** you create their login; otherwise Supabase refuses with "Database
error creating new user". (If the sites share one project, emails on the partner site's `allowed_emails` list work too.)
Emails are stored in lowercase automatically.

## What guests can see

- Only the events they're on the list for, and only the other guests of those events.
- Other guests' name, photo, role, company, city, bio, "looking for", "can help with", interests and links.
  **Email and phone only when that guest turns on "Share my email and phone".**
- A guest who turns off **"Show my profile to other guests"** is left out of every guest list (they still see others).
- Draft events (`is_published` off) and their guest lists are only visible to admins.

The database enforces all of this (row-level security). Other guests' profiles are served by `get_network()`, which
leaves out private fields; guests can only change their own profile fields, never their email or admin flag.
Profile photos go to the `guest-photos` storage bucket as public links, like any profile picture.

## Install as an app

The site is a Progressive Web App, like the partner site: **Install app** in the header (Chrome, Edge, Android) or
Safari → Share → **Add to Home Screen** on iPhone. On phones the sections sit in a tab bar at the bottom.
Pieces: [`app/manifest.ts`](app/manifest.ts), [`public/sw.js`](public/sw.js) (bump its `VERSION` after changing it;
it never stores logins or guest data) and [`components/InstallApp.tsx`](components/InstallApp.tsx).

## Look and feel

Same design as obclub.co and the partner site: near-black background with a grid and moving stars, a floating
bordered nav, pill badges, white pill buttons, Fraunces for headlines and Geist for text. Colours live in
[`app/globals.css`](app/globals.css), the log in page text in [`components/LoginScreen.tsx`](components/LoginScreen.tsx).

## Project layout

```
app/
  page.tsx                          log in (email + password)
  no-access/                        signed in, but not on the guest list
  (network)/home/                   overview: next event, your events, your profile, people you've met
  (network)/events/, event/?id=…    your events; one event with its guest list (plus admin tools)
  (network)/guests/, guest/?id=…    everyone you've met; one guest's profile and your events in common
  (network)/profile/                edit your profile and photo, privacy, change password
  (network)/manage/                 admin: all guests and events, who has a login
components/                         UI: GuestGate (login check), ProfileEditor, GuestListManager, cards…
lib/network.ts                      reading and saving guests, events and guest lists
supabase/migrations/0004_networking.sql   database: tables, security rules, functions
supabase/seed-networking.sql        example content
.github/workflows/deploy-networking.yml   builds and publishes networking.obclub.co
```

The Partnership Program's own pages and database files live on the `partner` branch. Keep the two branches separate:
merging `networking` into `partner` would remove the course pages from partner.obclub.co.
