# Release checklist

1. Run `npm test` from the repository root.
2. Run `npm test` inside `packages/pulsar-json-viewer`.
3. Confirm `dist/pulsar-json-viewer.js` and `dist/pulsar-json-viewer.css` are generated from the release source.
4. Run `npm pack --dry-run` in the Pulsar package and review the published file list.
5. Publish the exact semver version to npm.
6. Verify the version-pinned jsDelivr and UNPKG URLs resolve to the published bytes.
7. Compute SRI hashes from the exact CDN responses and add them to the deployment documentation used by the consuming application.
8. Smoke test light and dark themes, checkbox on and off modes, keyboard-only search, pointer search, copy, download, fullscreen, and a large JSON payload.
9. Keep `@alenaksu/json-viewer` pinned to the tested upstream version until a newer version is explicitly validated.
