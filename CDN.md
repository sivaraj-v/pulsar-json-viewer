# CDN distribution

Pulsar JSON Viewer is available as a browser distribution through the repository's GitHub Pages site. Deploy the `docs/` directory before using these URLs in production.

## Production embed

### GitHub Pages

```html
<link rel="stylesheet" href="https://sivaraj-v.github.io/pulsar-json-viewer/examples/dist/pulsar-json-viewer.css">
<script src="https://sivaraj-v.github.io/pulsar-json-viewer/examples/dist/json-viewer.bundle.js"></script>
<script src="https://sivaraj-v.github.io/pulsar-json-viewer/examples/dist/pulsar-json-viewer.js"></script>
<pulsar-json-viewer id="viewer" checkboxes="true" theme="light"></pulsar-json-viewer>
```

The GitHub Pages asset URLs are:

- JavaScript: `https://sivaraj-v.github.io/pulsar-json-viewer/examples/dist/pulsar-json-viewer.js`
- CSS: `https://sivaraj-v.github.io/pulsar-json-viewer/examples/dist/pulsar-json-viewer.css`
- Upstream viewer: `https://sivaraj-v.github.io/pulsar-json-viewer/examples/dist/json-viewer.bundle.js`

The Pulsar browser bundle includes the selection model and the Pulsar custom element. It deliberately does not rebundle `@alenaksu/json-viewer`, preserving the upstream package boundary and attribution.

## Production rules

- Use a GitHub Pages deployment from a reviewed release commit. For immutable production assets, self-host the files from that commit.
- Serve the page over HTTPS.
- Use a restrictive Content Security Policy and allow only the CDN origins you actually use.
- Add Subresource Integrity hashes after publishing, because the final hash must be computed from the exact bytes served by the CDN.
- Self-host the pinned files when your security or availability requirements prohibit third-party runtime dependencies.
- Keep JSON data as data. Do not interpolate untrusted JSON into HTML or executable script strings.

## Files to publish

The GitHub Pages deployment must include `docs/examples/dist/pulsar-json-viewer.js`, `docs/examples/dist/pulsar-json-viewer.css` and `docs/examples/dist/json-viewer.bundle.js`. The first two contain the Pulsar runtime and styling; the third is the upstream viewer bundle.
