# Easy Pay — Safe Pay frontend

Next.js 16 / React 19 application. See [the project README](../README.md), [demonstration guide](../DEMO.md) and [verification record](../QA.md) for features and integration boundaries.

Run `npm ci`, then `npm run dev` and open http://localhost:3000. The FastAPI service must run on port 8001. The frontend's `/backend/*` rewrite uses server-only `API_BASE_URL`; it defaults to http://127.0.0.1:8001. Set it before development or production builds when using a different host.

Checks: `npm run lint`, `npm run typecheck`, `npm run build`. Formatting: `npm run format`.

The production manifest and service worker provide an installable shell and an offline public recovery page. Private records and API responses are never service-worker cached. Browser voice recognition, camera access and available Hindi/Kannada voices depend on the browser and device. Payment, bill and keypad-phone functionality is explicitly simulated.
