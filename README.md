# Tori Ugalde site

Live: https://dixxxvhb.github.io/tori-ugalde-site/ (GitHub Pages, main branch, no build step). Rebuilt 2026-10-13 as Dixon's belated 22nd-birthday gift.

- `index.html` home (her choreography, teaching, dancing, costumes, what she is looking for) · `media.html` every photo and video · `resume.html` one page, prints to PDF · `plan.html` her private outreach plan
- Brand: Tori's locked kit (`~/Code/tori-brand/BRAND.md`): Sacramento wordmark, Outfit, lavender accent, dark brown ink. Ground is white; cream is one feature band.
- Data lives in `data/*.json`; pages read it at load:
  - `site.json` the starting copy of every word and piece (text, works, teach, looking, quotes, jobs, training, skills). Tori edits all of it from the plan's **My site** tab; her version lives in the plan (`pub`) and wins. This file is only the fallback and the seed.
  - `media.json` photos (`images/photos`) and videos (`media/video` self-hosted, or `youtube` id), picked by Dixon
  - `studios.json` 209 studios, schools, conventions, companies and job boards around Orlando, researched 2026-10-13 from their own sites (`confidence` says how sure). `top` = the Start here list.
  - `pitch.json` default email notes (Tori can rewrite them in the plan) · `goals.json` starter dreams
- Photos: only shots where every visible minor has `students.photo_release_granted = true` in the DWD database (John, Daisy, Adelyn) or no minors at all. Group shots with other kids stay off. CAA choreography videos show CAA dancers; that was a deliberate call for her portfolio.
- `noindex` is on: she sends the link to studios herself. Remove the robots meta tags if she wants search engines.
- Preview locally: the `tori-site` launch config (`python -m http.server 5518`).

## Private plan (backend: figgg Supabase project, schema `toriplan`)
- `js/plan-store.js` syncs statuses, notes, follow-up dates, her edited notes, studios she adds and dreams through token-gated RPCs (`supabase/001_tori_plan.sql`).
- **My site** (`js/editor.js`): every word, piece (with a YouTube link per piece), class, quote, contact line and resume section. The first open copies `data/site.json` into the plan. Public pages read it through `tu_public_get()` (`supabase/002_tori_site_content.sql`): only the public sections of the one row marked `is_public`, with video links stripped from hidden pieces. `js/site-content.js` falls back to `data/site.json` if the call is slow or down.
- To change copy yourself, edit it in the plan like she does. Editing `data/site.json` only changes the fallback once she has opened My site.
- Emails open in her own Mail or Gmail. Nothing ever sends from the site.
- The plan link is a secret: it lives only in `~/_drafts/tori-site/LINK.txt`, never in this public repo.
