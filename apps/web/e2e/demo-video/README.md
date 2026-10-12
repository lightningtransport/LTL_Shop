# Demo intro video

A 35-second video, "A day at the shop", to show before people open the demo link (D39). It has 11 scenes in the order of `DEMO_FLOW` (6:00 AM dashboard → 5:00 PM people and shop hours), each with a time, a role and a title. It is 1920×1080 at 30 fps, H.264, with no audio.

It is not part of the Playwright suite. Rebuild it whenever the screens change.

```bash
npm run prisma:demo-local --workspace=@ltl-shop/api   # fresh demo data
npm run start:demo                                     # web on :3042
DEMO_VIDEO_BASE_URL=http://localhost:3042 npm run demo:video --workspace=@ltl-shop/web
```

The output is `out/lightning-shop-day.mp4` and `out/poster.jpg`. Neither file is committed (`.gitignore`).

| File | What it does |
|---|---|
| `capture.mjs` | Signs in with Dev Login as MS, MG1, MPM and QC1. Saves real screens to `shots/`: desktop at 1600×900 ×2.4, phones as iPhone 13 ×3. Measures each scene's focus box from the page, so the zoom and highlight follow the layout. |
| `video.html` | The scenes, titles and transitions, built with Web Animations. Edit `SCENES` to change texts, order or timing. Open it in a browser, call `build(shots)` then `play()` to preview. |
| `render.mjs` | Seeks every animation frame by frame at 1920×1080 and pipes the frames to `ffmpeg` (`brew install ffmpeg`). Use `--stills=3,9.5` to check single instants without rendering the whole video. |

Use `localhost`, not `127.0.0.1`: the dev server redirects to `localhost` and the session cookie would be lost.
