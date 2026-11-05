# Handover walkthrough

Optional. Not part of the client site, and not installed by `new-client`.

A Remotion composition turns screenshots into a short motion piece: title card, slow zoom, crossfade, caption bar in the client's colors. It is a designed slideshow, not a recording of someone clicking.

## Limits

- `/admin` without a staff password is the signed-out screen. The capture script does not type a password.
- There is no cursor, no typing, and no live data.
- Rendering needs Chrome and `npm install` in this folder (Remotion is large, so it stays out of the starter).
- Captions are the page titles plus a fixed sentence. They are not a script written from a real training session.

## Render

```bash
node scripts/handover-capture.mjs <client-dir>
cd tools/handover && npm install
npx remotion render src/index.ts Walkthrough out/walkthrough.mp4 --public-dir=<client-dir>/handover --props=<client-dir>/handover/props.json
```

`new-client --handover` writes `ADMIN-GUIDE.md` and prints these commands. It does not render the video.
