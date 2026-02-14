# Incident Recovery Runbook

## Incident Summary

During local development, the app intermittently returned `500` responses on `/rma` with:

- `SyntaxError: Unexpected end of JSON input`
- stack traces from Next.js manifest loading (`loadManifest`)

The issue was caused by unstable/corrupted dev build artifacts in the local Next.js cache path while running with the webpack dev pipeline.

## Root Cause

- Local dev manifest files became unreadable/incomplete during runtime.
- This produced non-deterministic route failures and Fast Refresh full reload loops.
- The app code path appeared unstable, but the primary trigger was dev runtime artifact corruption.

## Recovery Steps (Confirmed Working)

1. Stop running Next.js dev processes.
2. Force-remove local build artifacts (`next-dist`, `.next`).
3. Restart in Turbopack dev mode (`npm run dev`).
4. Smoke-test critical routes and APIs.

### Commands

```bash
pkill -f "next dev"
python3 - <<'PY'
import os, shutil, stat, time
for path in ["next-dist", ".next"]:
    if not os.path.exists(path):
        continue
    def onerror(func, p, exc_info):
        try:
            os.chmod(p, stat.S_IWRITE | stat.S_IREAD | stat.S_IEXEC)
            func(p)
        except Exception:
            pass
    for _ in range(3):
        try:
            shutil.rmtree(path, onerror=onerror)
            break
        except Exception:
            time.sleep(0.2)
PY
npm run dev
```

## Verification Checklist

- `npm run lint` passes.
- `npm run build` passes.
- `GET /rma` returns `200` consistently.
- `GET /api/rma/orders?search=<name>&limit=5` returns `200`.

## Preventive Controls Implemented

- Added `next-dist/` to `.gitignore` to avoid committing local build artifacts.
- Hardened RMA board request handling to avoid state updates from stale/unmounted async calls.
- Kept sidebar state hydration mount-safe to reduce client runtime thrash.

## Operating Guidance

- Prefer `npm run dev` (Turbopack) for day-to-day development.
- Use webpack dev mode only for focused debugging scenarios.
- If route behavior becomes non-deterministic, execute this runbook first before deeper code changes.

