# Release checklist

## Before tagging

1. Update `version` in `package.json` and the matching entry in `CHANGELOG.md`.
2. Keep `@alenaksu/json-viewer` pinned to the tested upstream version.
3. Run `yarn build:dist`.
4. Run `yarn test`.
5. Smoke test the Pages site and the local `docs/examples/` demos in light and dark themes, checkbox modes, search, copy, download, fullscreen, and large-payload workflows.
6. Confirm the Pages site uses only repository-hosted assets and is available at `https://sivaraj-v.github.io/pulsar-json-viewer/`.

## Publish

1. Commit the version and changelog updates.
2. Create and push an annotated tag, for example `git tag -a v2.0.4 -m "Release v2.0.4"` followed by `git push origin v2.0.4`.
3. The `Release` GitHub Actions workflow creates the GitHub Release and attaches the site ZIP, source ZIP, and npm package tarball.
4. Review the generated release assets and release notes before announcing the release.

## Downloadable assets

Each GitHub Release contains:

- `pulsar-json-viewer-vX.Y.Z-site.zip`: the self-contained Pages site.
- `pulsar-json-viewer-vX.Y.Z-source.zip`: the repository source snapshot.
- `pulsar-json-viewer-vX.Y.Z.tgz`: the npm package bundle.
