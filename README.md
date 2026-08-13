# opslab-fleet-shell

One of three sandbox apps. This repo holds a page, a stylesheet, and a script.

```
site/index.html   the page
site/app.css      styles specific to this app
site/app.js       behaviour
Dockerfile        FROM opslab-base — four lines
```

Everything else is inherited. Colours, fonts, nginx config, security headers,
build steps, scan policy, signing: all in `opslab-base` and `opslab-shared`.

## What triggers a build

- a push here
- `opslab-base` publishing a new image, which dispatches `base-image-updated`
  carrying the digest

In the second case the build pins `FROM` to that exact digest rather than
`:latest`, so what gets built is provably the base that triggered it.

On success this dispatches `app-image-updated` to `opslab-platform`, which
deploys it.

## Local

```bash
cd site && python3 -m http.server 8000
```

Shared assets are missing when you run it this way, so the page renders unstyled.
That is expected. `docker build` against the real base to see it properly.
