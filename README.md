# Remembrall

Log the words, recipes, books and news you find interesting. Every day, Remembrall hands a few back to you as a notification.

- `site/` – the installable web app (no build step). Netlify publishes this folder (see `netlify.toml`).
- `supabase/` – database schema and the `daily-recall` reminder function, already deployed to the Supabase project.
- `make_icons.py` – regenerates the app icons.
- `DEPLOY.md` – setup steps for Netlify and Supabase.
