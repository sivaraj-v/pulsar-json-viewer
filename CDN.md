# CDN distribution

Pulsar JSON Viewer 2.0.3 is prepared for version-pinned distribution through npm-compatible CDNs such as jsDelivr and UNPKG. Publish the package to npm first, then use immutable version URLs in production.

## Production embed

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pulsar-json-viewer@2.0.3/dist/pulsar-json-viewer.css">
<script src="https://unpkg.com/@alenaksu/json-viewer@2.1.2/dist/json-viewer.bundle.js"></script>
<script src="https://cdn.jsdelivr.net/npm/pulsar-json-viewer@2.0.3/dist/pulsar-json-viewer.js"></script>
<pulsar-json-viewer id="viewer" checkboxes="true" theme="light"></pulsar-json-viewer>
```

The Pulsar browser bundle includes the selection model and the Pulsar custom element. It deliberately does not rebundle `@alenaksu/json-viewer`, preserving the upstream package boundary and attribution.

## Production rules

- Pin exact versions. Do not use unversioned or `latest` URLs in production.
- Serve the page over HTTPS.
- Use a restrictive Content Security Policy and allow only the CDN origins you actually use.
- Add Subresource Integrity hashes after publishing, because the final hash must be computed from the exact bytes served by the CDN.
- Self-host the pinned files when your security or availability requirements prohibit third-party runtime dependencies.
- Keep JSON data as data. Do not interpolate untrusted JSON into HTML or executable script strings.

## Files to publish

`dist/pulsar-json-viewer.js` is the browser bundle. `dist/pulsar-json-viewer.css` contains theme and upstream token configuration. Both are included in the npm `files` allowlist.
