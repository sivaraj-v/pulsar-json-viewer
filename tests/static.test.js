const fs = require("node:fs")
const path = require("node:path")

const root = path.resolve(__dirname, "..")
const files = []
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else files.push(full)
  }
}
walk(root)

const retiredName = String.fromCharCode(102, 111, 114, 103, 101)
const disallowed = new RegExp(`\\b${retiredName}\\b`, "i")
for (const file of files) {
  if (!/\.(?:js|css|html|md|json)$/.test(file)) continue
  const text = fs.readFileSync(file, "utf8")
  if (disallowed.test(text)) throw new Error(`Legacy product reference found in ${path.relative(root, file)}`)
}

const component = fs.readFileSync(path.join(root, "src/pulsar-json-viewer.js"), "utf8")
for (const required of [
  "pulsar-json-viewer",
  "Copy selected JSON",
  "Copy all JSON",
  "Download selected JSON",
  "Download all JSON",
  "previousSearchResult",
  "nextSearchResult",
  "toggleFullscreen",
  "SEARCH_DEBOUNCE_MS",
  "#suppressUpstreamSearchFocus",
  "pulsar-json-search-counter",
  "event.shiftKey",
  'new RegExp(escapeRegExp(this.#searchQuery), "i")',
  'get checkboxes()',
  'get theme()',
  "selectionchange",
  "PulsarJsonTreeModel",
  "stopPropagation()",
  "aria-live"
]) {
  if (!component.includes(required)) throw new Error(`Missing required component behavior: ${required}`)
}

if (!component.includes('treeActions.setAttribute("role", "group")')) throw new Error(`Missing accessibility structure: tree action group role`)

if (!component.includes('selectionActions.setAttribute("role", "group")')) throw new Error(`Missing accessibility structure: selection action group role`)

if (!component.includes('searchInput.setAttribute("aria-describedby", searchHelpId)')) throw new Error(`Missing accessibility structure: search help description`)

if (!component.includes('counter.setAttribute("aria-hidden", "true")')) throw new Error(`Missing accessibility structure: silent visible counter`)

for (const upstreamMethod of ["expandAll", "collapseAll", ".search(", "resetFilter"]) {
  if (!component.includes(upstreamMethod)) throw new Error(`Missing upstream delegation: ${upstreamMethod}`)
}

for (const required of [
  "size-8",
  "sticky top-0 z-20",
  "basis-full",
  "display: inline-flex",
  "align-items: center",
  "vertical-align: middle"
]) {
  if (!component.includes(required)) throw new Error(`Missing toolbar or checkbox alignment guard: ${required}`)
}


for (const unsafe of [/\beval\s*\(/, /new\s+Function\s*\(/, /\.innerHTML\s*=/, /\.outerHTML\s*=/, /insertAdjacentHTML\s*\(/, /document\.write\s*\(/]) {
  if (unsafe.test(component)) throw new Error(`Unsafe component pattern found: ${unsafe}`)
}
for (const required of [
  'button.type = "button"',
  'toolbar.setAttribute("role", "toolbar")',
  'search.setAttribute("role", "search")',
  'searchLabel.htmlFor = searchId',
  'status.setAttribute("aria-atomic", "true")',
  'checkbox.type = "checkbox"',
  'checkbox.setAttribute("aria-label"',
  '#suppressUpstreamSearchFocus',
  "viewer.inert = true",
  "lock.viewer.inert = false",
  '{ preserveFocus: true }'
]) {
  if (!component.includes(required)) throw new Error(`Missing accessibility or focus guard: ${required}`)
}

const css = fs.readFileSync(path.join(root, "src/pulsar-json-viewer.css"), "utf8")
for (const required of [
  "pulsar-theme-dark",
  "--property-color: #7dd3fc",
  "--string-color: #86efac",
  "--outline-color: #38bdf8",
  ":fullscreen"
]) {
  if (!css.includes(required)) throw new Error(`Missing theme or fullscreen styling: ${required}`)
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))
if (packageJson.version !== "2.0.3") throw new Error("Pulsar package version must be 2.0.3")
if (packageJson.devDependencies?.tailwindcss !== "4.3.3" || packageJson.devDependencies?.["@tailwindcss/cli"] !== "4.3.3") {
  throw new Error("Pulsar must pin Tailwind CSS 4.3.3 build dependencies")
}

for (const file of files.filter(file => file.endsWith(".html") && file.includes(`${path.sep}examples${path.sep}`))) {
  const text = fs.readFileSync(file, "utf8")
  if (!text.includes("https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.3.3")) {
    throw new Error(`Example must pin Tailwind browser 4.3.3: ${path.relative(root, file)}`)
  }
}

if (!fs.existsSync(path.join(root, "examples/configuration.html"))) throw new Error("Configuration example is missing")

console.log("static tests passed")

for (const requiredFile of ["dist/pulsar-json-viewer.js", "dist/pulsar-json-viewer.css", "CDN.md", "CHANGELOG.md", "examples/api-response.html", "examples/feature-flags.html", "examples/ecommerce-order.html"]) {
  if (!fs.existsSync(path.join(root, requiredFile))) throw new Error(`Release file missing: ${requiredFile}`)
}
if (packageJson.unpkg !== "dist/pulsar-json-viewer.js" || packageJson.jsdelivr !== "dist/pulsar-json-viewer.js") throw new Error("CDN entry points are missing")
