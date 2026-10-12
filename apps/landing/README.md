# Landing page for the demo

This is the public page you share before the demo: https://ltl-shop-landing.vercel.app

It opens with the video "A day at the shop" playing on its own. Below the video it explains the app's features, the roles and how to get into the demo, and it ends with the **Open the demo** button.

It is static HTML/CSS/JS with no build step. It is not part of the npm workspaces. It has its own Vercel project, `ltl-shop-landing` (team `ltl8`), which is separate from production and from the demo.

| File | What it does |
|---|---|
| `index.html` | All the sections and their text |
| `styles.css` | Brand tokens copied from `apps/web/src/app/globals.css` |
| `main.js` | The video (autoplay, pause, play again) and the demo button |
| `config.js` | **The demo URL.** This is the only setting |
| `media/` | `demo.mp4`, `poster.jpg`, logo and favicons |

## Setting the demo URL

1. Put the URL of the published web demo in `config.js` → `demoUrl` (see `docs/reference/DEMO.md` → Demo publicada).
2. Redeploy.

While it is empty, the button reads "Demo link coming soon" and does nothing. The access code never appears on this page. It is sent separately with the link (D39).

## Deploying

```bash
cd apps/landing
vercel deploy --prod --yes --scope ltl8
```

The first time, run `vercel link --yes --project ltl-shop-landing --scope ltl8`.

## Updating the video

1. Re-render it (`apps/web/e2e/demo-video/README.md`).
2. Compress it for the web:

```bash
ffmpeg -y -i ../web/e2e/demo-video/out/lightning-shop-day.mp4 -c:v libx264 -preset slow -crf 28 -pix_fmt yuv420p -movflags +faststart -an media/demo.mp4
cp ../web/e2e/demo-video/out/poster.jpg media/poster.jpg
```

That takes the video from about 12.8 MB to about 4 MB at 1080p.
