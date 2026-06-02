# Writora Connector (WordPress plugin)

Receives posts published from [Writora](https://writora.app) and creates/updates
them on your WordPress site — one-click cross-posting with canonical URLs back
to the original.

## What it does

- Exposes a token-authenticated REST API under `/wp-json/writora/v1`:
  - `GET /ping` — connectivity + auth check.
  - `POST /publish` — create or **update** a post (idempotent, keyed on the
    Writora blog id stored in post meta `_writora_blog_id`, so re-publishing the
    same article never creates a duplicate).
- Sideloads the post's featured image into the media library (only when it
  changed since the last publish).
- Maps the post's category (creating the term if needed).
- Sets a **canonical URL** back to the Writora original on single posts, so the
  cross-post isn't treated as duplicate content. Defers to Yoast / Rank Math /
  SEOPress when one of those is active.

## Install

1. Zip the `writora-connector` folder (or upload these files to
   `wp-content/plugins/writora-connector/`).
2. In WP Admin → Plugins, activate **Writora Connector**.
3. Go to **Settings → Writora Connector** and copy the **Site URL** and
   **Connection token**.
4. In Writora → **Destinations** → **Add destination** → WordPress, paste both
   and click **Test**.

## Security

- Authentication is a 32-byte random token compared in constant time
  (`hash_equals`) against the `X-Writora-Token` request header.
- Regenerate the token any time from the settings page (you'll then need to
  update it in Writora).
- Serve your site over HTTPS so the token isn't sent in the clear.

## Request contract (`POST /wp-json/writora/v1/publish`)

Header: `X-Writora-Token: <token>`

```json
{
  "writoraBlogId": "ckxyz…",
  "title": "Post title",
  "slug": "post-title",
  "html": "<h2>…</h2><p>…</p>",
  "excerpt": "Meta description",
  "canonicalUrl": "https://writora.app/alice/post-title",
  "featuredImageUrl": "https://…/image.jpg",
  "category": "Gardening",
  "status": "publish"
}
```

Response: `{ "id": 123, "url": "https://your-site.com/post-title" }`
