# Expanso Examples

Pipeline patterns and runnable examples for [Expanso Edge](https://expanso.io).

🌐 **Live Site:** [examples.expanso.io](https://examples.expanso.io)

## What's Inside

This repository contains curated examples of Expanso Edge pipelines with:

- 📥 **Downloadable YAML files** - Configurations to adapt and validate for your environment
- 📖 **Detailed documentation** - Step-by-step explanations
- 🔗 **Component references** - Links to full documentation
- ▶️ **Quick start commands** - Test examples locally

## Structure

```
examples.expanso.io/
├── docs/              # Example documentation (MDX)
├── examples/          # Pipeline YAML files
├── static/            # Images and assets
└── src/               # React components and styling
```

## Development

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build

# Serve production build locally
npm run serve
```

## Deployment

The executable deployment defined in this repository is GitHub Pages: `.github/workflows/deploy.yml` builds and deploys the site after changes land on `main`.

Legacy URL redirects are defined in `docusaurus.config.ts`. Docusaurus emits them as static redirect pages, so they work on the GitHub Pages deployment without separate host rules. DNS, custom-domain, or any external proxy ownership is managed outside this repository and must be verified separately before changing hosts.

## Related

- 📚 [Main Documentation](https://docs.expanso.io) - Concepts, guides, and component reference
- 🌐 [Expanso Website](https://expanso.io) - Product information
- ☁️ [Expanso Cloud](https://cloud.expanso.io) - Deploy and manage pipelines

## License

Copyright © 2024 Expanso, Inc.

### Analytics collector verification

`npm run test-analytics` checks the public semantic schema and privacy rules.
For delivery and identity behavior, install the pinned browser with
`npx playwright install chromium`, then run `npm run test-analytics-collector`.
The collector suite bundles the actual analytics modules and installed PostHog
SDK, runs them in Chromium, and intercepts all network requests. If a local
pinned browser install is unavailable, the explicitly selected installed Chrome
channel can run the same suite with
`ANALYTICS_BROWSER_CHANNEL=chrome npm run test-analytics-collector`. It verifies
outbound SDK payloads without sending events to production or starting a server.
It covers semantic event delivery, manual route pageview ownership, production
hostname gating, campaign/QA labels, consent persistence and revocation.

The direct collector owns PostHog delivery; the existing dataLayer contract is
retained for Google integration. GTM must not forward these events to PostHog a
second time. Only `examples.expanso.io` can initialize the production collector.
`analytics_test=1` (or `true`) marks a synthetic journey through sessionStorage;
staff tagging requires explicit localStorage `expanso_analytics_internal=1`
(or `true`). Neither flag grants consent. URLs omit queries/fragments; only
allowlisted campaign labels are retained as separate properties.

### Analytics runtime and dedicated GA destination

Use the Node version in `.node-version` for local gates. With fnm:
`fnm exec --using=22.23.2 npm run build` (and the same prefix for other npm
commands). Node 22 matches an existing CI runtime; Node 26 introduces loader
deprecation and server-side localStorage warnings in this toolchain. No warning
suppression flags are used. Locked browser datasets are updated rather than
bypassing their freshness checks.

The manual GA adapter sends only to `G-6YXD85WVC6` (stream `15743178904`,
property `517203661`). It uses a separate `expansoExamplesAnalyticsLayer`,
`send_page_view: false`, and explicit `send_to` on every event. It loads no GA
script or sends events until analytics consent is granted and DNT is absent.
QA/internal events have `debug_mode: true` and `traffic_type: internal`.
Queries and hashes are omitted from page locations/referrers; allowlisted UTM
labels are mapped to campaign fields. Enhanced measurement must remain disabled
on the dedicated stream, and shared GTM must not duplicate this manual adapter.
`npm run test-analytics` includes executable GA unit tests;
`npm run test-analytics-collector` verifies the browser command/request boundary
with every external request intercepted.

The dependency overrides apply security fixes while Docusaurus stays at 3.9.2.
Webpack is pinned to 5.104.1 because newer versions reject the existing progress
plugin options. Glob 13 replaces deprecated Glob 10. Lighthouse 13.4.1 removes
vulnerable browser-download and telemetry chains; its performance contract and
CI runtimes now match Node 22.23.2. Historical Lighthouse 12 evidence requires
fresh collection for comparison.

The bounded local image metadata adapter supports the site's PNG, JPEG, GIF,
SVG and WebP assets and rejects unsupported formats before parsing. Run
`npm run test-security-compat` for real consumer resolution, the static image
inventory, malformed images, webpack serialization, SockJS UUIDs, and a local
Lighthouse collection. `npm audit` reports zero findings without suppression.
The 34 existing tutorial-length warnings remain separately documented.
