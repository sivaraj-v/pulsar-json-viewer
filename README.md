# Pulsar JSON Viewer

Pulsar JSON Viewer is a production-oriented Web Component for exploring structured JSON inside dashboards, developer tools, support consoles, and documentation. It combines a mature upstream tree renderer with an optional selection and productivity layer, while keeping the integration small enough for CDN or npm delivery.

It is built on top of [`@alenaksu/json-viewer`](https://github.com/alenaksu/json-viewer). The upstream component continues to own JSON rendering, expand and collapse behavior, tree focus, keyboard navigation, filtering and search. Pulsar adds a selection layer and selection actions without replacing those built-in interactions.

## What Pulsar adds

- optional native checkboxes beside visible JSON properties
- parent and child mixed selection states when checkboxes are enabled
- Space to select the focused tree row when checkboxes are enabled
- Select all and Clear actions in checkbox mode
- Copy selected and Download selected in checkbox mode
- Copy all and Download all when checkboxes are disabled
- case-insensitive search on type with explicit Previous and Next result controls
- Enter advances to the next result while focus remains in the search field. Shift+Enter moves to the previous result
- fullscreen mode using the browser Fullscreen API
- configurable light and dark dashboard themes
- a sticky toolbar that stays available while working through long JSON
- accessible status announcements for copy, download and search actions
- a `selectionchange` event for host applications

## What stays upstream

Pulsar intentionally does not reimplement the core tree behavior from `@alenaksu/json-viewer`.

| Capability | Owner |
| --- | --- |
| JSON rendering | `@alenaksu/json-viewer` |
| Expand and collapse | `@alenaksu/json-viewer` |
| Arrow-key tree navigation | `@alenaksu/json-viewer` |
| Search iterator and highlighting | `@alenaksu/json-viewer` |
| Filtering | `@alenaksu/json-viewer` |
| Search input, case-insensitive matching and Previous/Next controls | Pulsar JSON Viewer |
| Fullscreen wrapper and sticky toolbar | Pulsar JSON Viewer |
| Light and dark theme configuration | Pulsar JSON Viewer |
| Checkbox selection | Pulsar JSON Viewer |
| Mixed parent selection | Pulsar JSON Viewer |
| Copy selected | Pulsar JSON Viewer |
| Download selected | Pulsar JSON Viewer |
| Selection event | Pulsar JSON Viewer |

See `THIRD_PARTY_NOTICES.md` for attribution and licensing details.

## Quick start

Load the upstream component first, then the Pulsar selection model, styles and component.

```html
<link rel="stylesheet" href="./src/pulsar-json-viewer.css">
<script src="https://unpkg.com/@alenaksu/json-viewer@2.1.2/dist/json-viewer.bundle.js"></script>
<script src="./src/selection-model.js"></script>
<script src="./src/pulsar-json-viewer.js"></script>

<pulsar-json-viewer id="viewer" checkboxes="true" theme="light"></pulsar-json-viewer>

<script>
  const viewer = document.querySelector('#viewer')
  viewer.data = {
    service: 'catalog-api',
    healthy: true,
    regions: ['us-east-1', 'eu-west-1']
  }
</script>
```

For a packaged application, install the upstream dependency with npm and make sure its Web Component is registered before `pulsar-json-viewer.js` runs.

```bash
npm install @alenaksu/json-viewer@2.1.2
```

## Built-in actions

The toolbar is part of the component. Hosts do not need to build separate Copy selected or Download selected buttons.

The sticky toolbar includes:

- Expand all
- Collapse all
- Select all and Clear when checkbox mode is enabled
- Copy selected and Download selected when checkbox mode is enabled
- Copy all and Download all when checkbox mode is disabled
- live search input
- Previous result and Next result
- Clear search
- fullscreen

Selected-data actions remain disabled until at least one value is selected. Whole-data actions are available whenever JSON data is loaded.

After copying, the copy icon briefly changes to a success icon and then restores its normal state. A polite live region announces the result for assistive technology.

## Configuration

### Checkbox mode

Checkbox selection is enabled by default for backward compatibility. Disable it when the component is being used as a read-only viewer.

```html
<pulsar-json-viewer checkboxes="true"></pulsar-json-viewer>
<pulsar-json-viewer checkboxes="false"></pulsar-json-viewer>
```

The property can also be changed at runtime.

```js
viewer.checkboxes = false
```

When checkboxes are disabled, Pulsar does not inject selection controls into the upstream tree. Select all and Clear are hidden. Copy and Download operate on the full JSON value.

### Theme

Use `theme="light"` or `theme="dark"`. Both themes use dashboard-oriented contrast values for JSON token colors, controls, focus rings, and surfaces.

```html
<pulsar-json-viewer theme="light"></pulsar-json-viewer>
<pulsar-json-viewer theme="dark"></pulsar-json-viewer>
```

The theme is also available as a property.

```js
viewer.theme = 'dark'
```

## Search behavior

Search begins shortly after the user types. The first match is highlighted without moving keyboard focus away from the search field. Enter advances to the next result and wraps to the first result after the last match. Shift+Enter moves backward and wraps in the opposite direction. Previous and Next buttons provide the same navigation for pointer users. A visible result counter reports the current match.

Pulsar escapes the user's search text before creating a regular expression and always applies the case-insensitive flag. This means uppercase and lowercase text behave the same, numeric values such as `2.1` can be searched directly, and user input cannot be treated as an arbitrary regular expression. Matching and highlighting are still delegated to the upstream viewer's `search()` iterator.

## Selection behavior

Selecting a leaf selects only that value. Selecting an object or array selects all terminal values below it. A partially selected parent is rendered as mixed.

Checkbox pointer events stop at the checkbox so they do not trigger the upstream expand or collapse action.

When focus is on a tree row, Space toggles that row's selection. Left and Right Arrow behavior remains owned by the upstream tree.

## Public API

```js
const viewer = document.querySelector('pulsar-json-viewer')

viewer.data = jsonValue
viewer.expandAll()
viewer.collapseAll()
viewer.selectAll()
viewer.clearSelection()
viewer.hasSelection()
viewer.getSelectedData()
await viewer.copySelected()
viewer.downloadSelected('selection.json')
viewer.search('production')
viewer.previousSearchResult()
viewer.nextSearchResult()
viewer.resetSearch()
await viewer.toggleFullscreen()
await viewer.copy()
viewer.download()
```

### `data`

Gets or sets the JSON value displayed by the viewer.

### `getSelectedData()`

Returns a new JSON value containing only the selected leaves and the parent structure required to reach them. Returns `undefined` when nothing is selected.

### `download-name`

Set the default filename used by the built-in download action. In checkbox mode it applies to Download selected. Without checkboxes it applies to Download all.

```html
<pulsar-json-viewer download-name="incident-selection.json"></pulsar-json-viewer>
```

### `selectionchange`

The component dispatches a bubbling `selectionchange` event whenever selection changes.

```js
viewer.addEventListener('selectionchange', event => {
  console.log(event.detail.hasSelection)
  console.log(event.detail.selectedData)
})
```

## Accessibility

Pulsar keeps the upstream tree keyboard model and adds native checkbox semantics for selection.

Selection state is mirrored with `aria-checked` on tree rows. Mixed parents use `aria-checked="mixed"`. Toolbar buttons have visible focus states, disabled states do not rely on color alone, and action feedback is announced through an `aria-live` region.

The JSON token palette was checked against the viewer surface. Light-theme token contrast ranges from 5.58:1 to 16.27:1 against white. Dark-theme token contrast ranges from 10.14:1 to 15.87:1 against `#0b1220`, keeping normal text comfortably above the WCAG AA 4.5:1 target.

The examples are designed to be usable with keyboard-only navigation and at high zoom.

## Examples

Open `examples/index.html` from a local static server.

- `basic.html` shows the smallest useful setup
- `selection.html` focuses on nested checkbox selection and the selection event
- `search.html` demonstrates search-on-type plus explicit Previous and Next navigation
- `arrays.html` demonstrates arrays, nested objects and mixed selection
- `configuration.html` demonstrates runtime checkbox and theme configuration
- `themes.html` is a dedicated side-by-side light and dark theme showcase
- `api-response.html` demonstrates API response debugging and numeric search
- `feature-flags.html` demonstrates a read-only configuration viewer without checkboxes
- `ecommerce-order.html` demonstrates selective support and fulfillment payload extraction
- `large-professional.html` is a production-style observability payload with hundreds of nested records and a sticky toolbar

A simple local server is enough:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080/examples/`.


## Light and dark theme showcase

A dedicated theme example is available at `examples/themes.html`. It renders the same production-style payload in light and dark mode side by side so teams can evaluate syntax colors, search highlights, checkbox states, focus treatment, and toolbar contrast without switching a single preview back and forth.

`configuration.html` remains the interactive configuration example for changing `theme` and `checkboxes` at runtime.

## Writing and launch assets

The package includes a professional social media kit at `docs/SOCIAL_MEDIA_KIT.md`. It contains Medium and LinkedIn story structures, launch copy, posting guidance, and ready-to-use promotional artwork under `docs/social/`.

The kit intentionally avoids invented popularity metrics or customer claims. Posts should describe features that ship in the release and credit `@alenaksu/json-viewer` as the upstream rendering and tree-interaction foundation.

## Project structure

```text
pulsar-json-viewer/
  src/
    pulsar-json-viewer.js
    pulsar-json-viewer.css
    selection-model.js
  examples/
    index.html
    basic.html
    selection.html
    search.html
    arrays.html
    configuration.html
    large-professional.html
    example.css
    data/
      large-professional.js
  tests/
    model.test.js
    static.test.js
    upstream-json-viewer-test-double.js
  README.md
  THIRD_PARTY_NOTICES.md
  LICENSE
  package.json
```

## Design rule

The extension boundary is deliberate. If the upstream viewer already provides a behavior, Pulsar calls that behavior rather than recreating it. The only DOM augmentation inside the upstream Shadow DOM is the checkbox inserted into each rendered key row, plus a small stylesheet for those checkboxes.

## Security notes

The selection model accepts JSON values only. It rejects circular values, non-finite numbers and unsupported JavaScript value types. Selected downloads are generated with `Blob` and `URL.createObjectURL`, and the temporary URL is revoked after use.

Pulsar does not evaluate JSON content as code and does not inject JSON strings as HTML.

## License

Pulsar JSON Viewer is available under the MIT License. The upstream `@alenaksu/json-viewer` dependency is also MIT licensed. See `THIRD_PARTY_NOTICES.md`.

## Tailwind styling

Pulsar 2.0.3 uses Tailwind CSS 4.3.3 utility classes for its toolbar, search controls, actions, focus treatment, spacing, and responsive layout. The small `src/pulsar-json-viewer.css` file is intentionally limited to host defaults and CSS variables required to theme the upstream JSON viewer shadow tree.

For an independent package build, run `npm run build:css` after installing dependencies. The examples pin `@tailwindcss/browser@4.3.3` for development previews. Production consumers should use the generated static CSS rather than the browser runtime.


## Production CDN distribution

Pulsar ships a browser-ready `dist/` build. CDN consumers load the pinned upstream viewer first, then Pulsar CSS and JavaScript. See `CDN.md` for version pinning, cache policy, CSP guidance, and release verification.
