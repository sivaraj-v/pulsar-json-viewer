(() => {
  "use strict"

  const ELEMENT_NAME = "pulsar-json-viewer"
  const UPSTREAM_ELEMENT = "json-viewer"
  const CHECKBOX_CLASS = "pulsar-json-selection"
  const CHECKBOX_STYLE_ID = "pulsar-json-selection-style"
  const COPY_RESET_MS = 1800
  const SEARCH_DEBOUNCE_MS = 180

  const ICONS = {
    expand: [["path", { d: "M4 9V4h5M4 4l6 6M20 9V4h-5m5 0-6 6M4 15v5h5m-5 0 6-6M20 15v5h-5m5 0-6-6" }]],
    collapse: [["path", { d: "M9 4v5H4m5 0L3 3M15 4v5h5m-5 0 6-6M9 20v-5H4m5 0-6 6M15 20v-5h5m-5 0 6 6" }]],
    "select-all": [["rect", { x: "4", y: "4", width: "16", height: "16", rx: "2.5" }], ["path", { d: "m8 12 2.5 2.5L16.5 8.5" }]],
    clear: [["rect", { x: "4", y: "4", width: "16", height: "16", rx: "2.5" }], ["path", { d: "M8 8l8 8M16 8l-8 8" }]],
    copy: [["rect", { x: "9", y: "9", width: "11", height: "11", rx: "2" }], ["path", { d: "M15 5H6a2 2 0 0 0-2 2v9" }]],
    copied: [["path", { d: "M20 6 9 17l-5-5" }]],
    download: [["path", { d: "M12 3v12m0 0 4-4m-4 4-4-4M5 20h14" }]],
    previous: [["path", { d: "m15 18-6-6 6-6" }]],
    next: [["path", { d: "m9 18 6-6-6-6" }]],
    "search-clear": [["path", { d: "M6 6l12 12M18 6 6 18" }]],
    fullscreen: [["path", { d: "M8 3H3v5M3 3l6 6M16 3h5v5m0-5-6 6M8 21H3v-5m0 5 6-6M16 21h5v-5m0 5-6-6" }]],
    "fullscreen-exit": [["path", { d: "M9 9H3V3m0 6 6-6M15 9h6V3m0 6-6-6M9 15H3v6m0-6 6 6M15 15h6v6m0-6-6 6" }]]
  }

  if (customElements.get(ELEMENT_NAME)) return

  class PulsarJsonViewer extends HTMLElement {
    static get observedAttributes() {
      return ["checkboxes", "theme"]
    }

    #data = undefined
    #hasData = false
    #viewer = null
    #selection = null
    #index = null
    #pathToPointer = new Map()
    #observer = null
    #syncQueued = false
    #abortController = null
    #copyTimer = 0
    #searchTimer = 0
    #searchQuery = ""
    #searchPosition = -1
    #searchHasNext = false
    #searchResultCount = 0
    #searchCounter = null
    #status = null
    #copyButton = null
    #downloadButton = null
    #clearButton = null
    #selectAllButton = null
    #previousButton = null
    #nextButton = null
    #fullscreenButton = null
    #searchInput = null
    #searchFocusLockToken = 0

    connectedCallback() {
      if (this.#abortController) return
      this.#abortController = new AbortController()
      this.classList.add("pulsar-json-viewer")
      this.setAttribute("role", "region")
      if (!this.hasAttribute("aria-label")) this.setAttribute("aria-label", "JSON tree viewer")
      if (!this.hasAttribute("theme")) this.setAttribute("theme", "light")
      this.#start()
    }

    disconnectedCallback() {
      this.#observer?.disconnect()
      this.#observer = null
      this.#abortController?.abort()
      this.#abortController = null
      window.clearTimeout(this.#copyTimer)
      window.clearTimeout(this.#searchTimer)
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue || !this.isConnected) return
      if (name === "checkboxes") this.#applyCheckboxMode()
      if (name === "theme") this.#applyTheme()
    }

    get checkboxes() {
      return this.getAttribute("checkboxes") !== "false"
    }

    set checkboxes(value) {
      this.setAttribute("checkboxes", value === false ? "false" : "true")
    }

    get theme() {
      return this.getAttribute("theme") === "dark" ? "dark" : "light"
    }

    set theme(value) {
      this.setAttribute("theme", value === "dark" ? "dark" : "light")
    }

    set data(value) {
      this.#data = value
      this.#hasData = value !== undefined
      this.#rebuildSelectionModel()
      this.#renderData()
      this.#updateActionState()
    }

    get data() {
      if (!this.#hasData) return undefined
      return window.PulsarJsonTreeModel?.cloneJson?.(this.#data) ?? structuredClone(this.#data)
    }

    expandAll() {
      this.#viewer?.expandAll?.()
      this.#queueCheckboxSync()
    }

    collapseAll() {
      this.#viewer?.collapseAll?.()
      this.#queueCheckboxSync()
    }

    selectAll() {
      if (!this.checkboxes) return
      this.#selection?.selectAll()
      this.#syncCheckboxes()
      this.#afterSelectionChange()
    }

    clearSelection() {
      this.#selection?.clearAll()
      this.#syncCheckboxes()
      this.#afterSelectionChange()
    }

    hasSelection() {
      return this.#selection?.hasSelection() === true
    }

    getSelectedData() {
      return this.#selection?.getSelectedData()
    }

    async copy() {
      return this.checkboxes ? this.copySelected() : this.copyAll()
    }

    async copyAll() {
      if (!this.#hasData) {
        this.#announce("No JSON data to copy")
        return false
      }
      return this.#copyValue(this.#data, "JSON copied")
    }

    async copySelected() {
      const selected = this.getSelectedData()
      if (selected === undefined) {
        this.#announce("Select at least one JSON value first")
        return false
      }
      return this.#copyValue(selected, "Selected JSON copied")
    }

    download(filename) {
      return this.checkboxes ? this.downloadSelected(filename) : this.downloadAll(filename)
    }

    downloadAll(filename = this.getAttribute("download-name") || "data.json") {
      if (!this.#hasData) {
        this.#announce("No JSON data to download")
        return false
      }
      return this.#downloadValue(this.#data, filename, `Downloaded ${filename}`)
    }

    downloadSelected(filename = this.getAttribute("download-name") || "selected.json") {
      const selected = this.getSelectedData()
      if (selected === undefined) {
        this.#announce("Select at least one JSON value first")
        return false
      }
      return this.#downloadValue(selected, filename, `Downloaded ${filename}`)
    }

    search(query, options = {}) {
      const text = String(query ?? "").trim()
      const preserveFocus = options.preserveFocus === true
      window.clearTimeout(this.#searchTimer)
      if (!text) {
        this.resetSearch()
        return false
      }

      this.#searchQuery = text
      this.#searchPosition = -1
      this.#searchResultCount = countSearchMatches(this.#data, text)
      const found = this.#goToSearchIndex(0, { preserveFocus })
      this.#updateSearchActions()
      return found
    }

    previousSearchResult(options = {}) {
      if (!this.#searchQuery) {
        this.#announce("Enter a search term first")
        return false
      }
      const previousIndex = this.#searchPosition <= 0 ? this.#searchResultCount - 1 : this.#searchPosition - 1
      return previousIndex >= 0 ? this.#goToSearchIndex(previousIndex, options) : false
    }

    nextSearchResult(options = {}) {
      if (!this.#searchQuery) {
        this.#announce("Enter a search term first")
        return false
      }
      const nextIndex = this.#searchPosition + 1 >= this.#searchResultCount ? 0 : this.#searchPosition + 1
      return this.#goToSearchIndex(nextIndex, options)
    }

    resetSearch() {
      window.clearTimeout(this.#searchTimer)
      this.#viewer?.resetFilter?.()
      this.#searchQuery = ""
      this.#searchPosition = -1
      this.#searchHasNext = false
      this.#searchResultCount = 0
      this.#updateSearchActions()
      this.#announce("Search cleared")
    }

    async toggleFullscreen() {
      try {
        if (document.fullscreenElement === this) {
          await document.exitFullscreen?.()
          return true
        }
        if (!this.requestFullscreen) {
          this.#announce("Fullscreen is not supported in this browser")
          return false
        }
        await this.requestFullscreen()
        return true
      } catch {
        this.#announce("Fullscreen could not be opened")
        return false
      }
    }

    async #copyValue(value, message) {
      try {
        await navigator.clipboard.writeText(JSON.stringify(value, null, 2))
        this.#showCopiedState()
        this.#announce(message)
        return true
      } catch {
        this.#announce("Could not copy JSON")
        return false
      }
    }

    #downloadValue(value, filename, message) {
      const safeFilename = sanitizeFilename(filename)
      const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = safeFilename
      link.hidden = true
      document.body.appendChild(link)
      link.click()
      link.remove()
      queueMicrotask(() => URL.revokeObjectURL(url))
      this.#announce(message)
      return true
    }

    #goToSearchIndex(targetIndex, options = {}) {
      const preserveFocus = options.preserveFocus === true
      if (!this.#viewer?.search || !this.#searchQuery || targetIndex < 0) return false
      if (this.#searchResultCount === 0 || targetIndex >= this.#searchResultCount) {
        this.#searchHasNext = false
        this.#updateSearchActions()
        if (targetIndex === 0) this.#announce(`No results for ${this.#searchQuery}`)
        else this.#announce("Already at the last search result")
        return false
      }

      const focusLock = preserveFocus ? this.#suppressUpstreamSearchFocus() : null
      try {
        const matcher = new RegExp(escapeRegExp(this.#searchQuery), "i")
        const iterator = this.#viewer.search(matcher)
        let result = null
        for (let index = 0; index <= targetIndex; index += 1) {
          result = iterator?.next?.()
          if (!result || result.done) {
            this.#searchResultCount = targetIndex
            this.#searchHasNext = false
            this.#updateSearchActions()
            this.#announce(targetIndex === 0 ? `No results for ${this.#searchQuery}` : "Already at the last search result")
            return false
          }
        }

        this.#searchPosition = targetIndex
        this.#searchHasNext = targetIndex + 1 < this.#searchResultCount
        this.#updateSearchActions()
        this.#announce(`Search result ${targetIndex + 1} of ${this.#searchResultCount} for ${this.#searchQuery}`)
        return true
      } finally {
        if (focusLock) this.#releaseUpstreamSearchFocus(focusLock)
      }
    }

    async #start() {
      if (!window.PulsarJsonTreeModel) {
        this.#renderUnavailable("Selection support could not start because the local selection model is missing")
        return
      }

      try {
        await customElements.whenDefined(UPSTREAM_ELEMENT)
      } catch {
        this.#renderUnavailable("JSON viewer could not be loaded")
        return
      }

      if (!this.isConnected || !this.#abortController) return
      this.#renderShell()
      this.#viewer = document.createElement(UPSTREAM_ELEMENT)
      this.#viewer.className = "pulsar-upstream-json-viewer"
      this.querySelector(".pulsar-json-canvas").appendChild(this.#viewer)

      const signal = this.#abortController.signal
      this.#viewer.addEventListener("keydown", event => this.#handleKeyboardSelection(event), { capture: true, signal })
      document.addEventListener("fullscreenchange", () => this.#updateFullscreenButton(), { signal })
      this.#bindToolbar(signal)
      this.#renderData()
      await this.#viewer.updateComplete
      this.#connectObserver()
      this.#syncCheckboxes()
      this.#applyCheckboxMode()
      this.#applyTheme()
      this.#updateActionState()
      this.#updateSearchActions()
      this.#updateFullscreenButton()
    }

    #renderShell() {
      this.replaceChildren()

      const toolbar = document.createElement("div")
      toolbar.className = "pulsar-json-toolbar jsonview:sticky jsonview:top-0 jsonview:z-20 jsonview:flex jsonview:flex-wrap jsonview:items-center jsonview:gap-2 jsonview:rounded-t-xl jsonview:border jsonview:border-slate-300 jsonview:bg-slate-50/95 jsonview:p-2 jsonview:shadow-sm jsonview:backdrop-blur jsonview:supports-[backdrop-filter]:bg-slate-50/90"
      toolbar.setAttribute("role", "toolbar")
      toolbar.setAttribute("aria-label", "JSON tree actions")

      const iconButtonClass = "jsonview:inline-flex jsonview:size-8 jsonview:shrink-0 jsonview:items-center jsonview:justify-center jsonview:rounded-md jsonview:border jsonview:border-transparent jsonview:bg-white jsonview:text-slate-700 jsonview:transition jsonview:hover:border-slate-300 jsonview:hover:bg-slate-100 jsonview:hover:text-slate-950 jsonview:active:bg-slate-200 jsonview:focus-visible:outline-none jsonview:focus-visible:ring-2 jsonview:focus-visible:ring-sky-700 jsonview:focus-visible:ring-offset-1 jsonview:disabled:cursor-not-allowed jsonview:disabled:bg-transparent jsonview:disabled:text-slate-400 jsonview:disabled:opacity-60"
      const makeIconButton = (label, action) => {
        const button = document.createElement("button")
        button.type = "button"
        button.dataset.action = action
        button.className = iconButtonClass
        this.#setIconButton(button, label, action)
        return button
      }

      const groupClass = "pulsar-json-action-group jsonview:inline-flex jsonview:w-fit jsonview:shrink-0 jsonview:items-center jsonview:gap-0.5 jsonview:rounded-lg jsonview:border jsonview:border-slate-200 jsonview:bg-white jsonview:p-0.5 jsonview:shadow-sm"

      const treeActions = document.createElement("div")
      treeActions.className = groupClass
      treeActions.setAttribute("role", "group")
      treeActions.setAttribute("aria-label", "Tree expansion actions")
      treeActions.append(
        makeIconButton("Expand all", "expand"),
        makeIconButton("Collapse all", "collapse")
      )

      const selectionActions = document.createElement("div")
      selectionActions.className = groupClass
      selectionActions.setAttribute("role", "group")
      selectionActions.setAttribute("aria-label", "JSON data actions")
      selectionActions.append(
        makeIconButton("Select all", "select-all"),
        makeIconButton("Clear selection", "clear"),
        makeIconButton("Copy selected JSON", "copy"),
        makeIconButton("Download selected JSON", "download")
      )

      const search = document.createElement("div")
      search.className = "pulsar-json-search jsonview:ml-auto jsonview:flex jsonview:min-w-0 jsonview:flex-1 jsonview:basis-full jsonview:items-center jsonview:justify-end jsonview:gap-1 jsonview:md:basis-[28rem]"
      search.setAttribute("role", "search")
      const searchId = this.#id("search")
      const searchLabel = document.createElement("label")
      searchLabel.className = "jsonview:sr-only"
      searchLabel.htmlFor = searchId
      searchLabel.textContent = "Search JSON"
      const searchHelp = document.createElement("span")
      const searchHelpId = this.#id("search-help")
      searchHelp.id = searchHelpId
      searchHelp.className = "jsonview:sr-only"
      searchHelp.textContent = "Type to search. Press Enter for the next result and Shift plus Enter for the previous result."
      const searchInput = document.createElement("input")
      searchInput.id = searchId
      searchInput.dataset.search = ""
      searchInput.type = "search"
      searchInput.placeholder = "Search keys or values"
      searchInput.autocomplete = "off"
      searchInput.spellcheck = false
      searchInput.setAttribute("aria-describedby", searchHelpId)
      searchInput.className = "jsonview:h-8 jsonview:min-w-[10rem] jsonview:flex-1 jsonview:rounded-md jsonview:border jsonview:border-slate-400 jsonview:bg-white jsonview:px-3 jsonview:text-sm jsonview:text-slate-950 jsonview:shadow-sm jsonview:placeholder:text-slate-500 jsonview:hover:border-slate-500 jsonview:focus:border-sky-700 jsonview:focus:outline-none jsonview:focus:ring-2 jsonview:focus:ring-sky-700/25"
      const counter = document.createElement("span")
      counter.className = "pulsar-json-search-counter jsonview:min-w-12 jsonview:text-center jsonview:text-xs jsonview:font-medium jsonview:text-slate-600"
      counter.setAttribute("aria-hidden", "true")
      counter.textContent = "0 / 0"
      search.append(
        searchLabel,
        searchHelp,
        searchInput,
        counter,
        makeIconButton("Previous search result", "previous"),
        makeIconButton("Next search result", "next"),
        makeIconButton("Clear search", "search-clear"),
        makeIconButton("Enter fullscreen", "fullscreen")
      )
      toolbar.append(treeActions, selectionActions, search)

      const canvas = document.createElement("div")
      canvas.className = "pulsar-json-canvas jsonview:min-h-40 jsonview:overflow-auto jsonview:rounded-b-xl jsonview:border jsonview:border-t-0 jsonview:border-slate-300 jsonview:bg-white jsonview:px-3 jsonview:py-4 jsonview:sm:px-4"

      const status = document.createElement("span")
      status.className = "jsonview:sr-only"
      status.setAttribute("aria-live", "polite")
      status.setAttribute("aria-atomic", "true")

      this.append(toolbar, canvas, status)
      this.#status = status
      this.#copyButton = toolbar.querySelector('[data-action="copy"]')
      this.#downloadButton = toolbar.querySelector('[data-action="download"]')
      this.#clearButton = toolbar.querySelector('[data-action="clear"]')
      this.#selectAllButton = toolbar.querySelector('[data-action="select-all"]')
      this.#previousButton = toolbar.querySelector('[data-action="previous"]')
      this.#nextButton = toolbar.querySelector('[data-action="next"]')
      this.#fullscreenButton = toolbar.querySelector('[data-action="fullscreen"]')
      this.#searchInput = searchInput
      this.#searchCounter = counter
    }

    #setIconButton(button, label, action) {
      button.setAttribute("aria-label", label)
      button.title = label
      button.replaceChildren(createIcon(action))
      const hidden = document.createElement("span")
      hidden.className = "jsonview:sr-only"
      hidden.textContent = label
      button.appendChild(hidden)
    }

    #id(suffix) {
      if (!this.id) this.id = `pulsar-json-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`
      return `${this.id}-${suffix}`
    }

    #bindToolbar(signal) {
      const toolbar = this.querySelector(".pulsar-json-toolbar")
      const searchInput = this.#searchInput

      toolbar.addEventListener("click", event => {
        const button = event.target.closest("button[data-action]")
        if (!button) return
        const action = button.dataset.action
        if (action === "expand") this.expandAll()
        if (action === "collapse") this.collapseAll()
        if (action === "select-all") this.selectAll()
        if (action === "clear") this.clearSelection()
        if (action === "copy") this.copy()
        if (action === "download") this.download()
        if (action === "previous") this.previousSearchResult()
        if (action === "next") this.nextSearchResult()
        if (action === "search-clear") {
          searchInput.value = ""
          this.resetSearch()
          searchInput.focus()
        }
        if (action === "fullscreen") this.toggleFullscreen()
      }, { signal })

      searchInput.addEventListener("input", () => {
        window.clearTimeout(this.#searchTimer)
        this.#searchTimer = window.setTimeout(() => this.search(searchInput.value, { preserveFocus: true }), SEARCH_DEBOUNCE_MS)
      }, { signal })

      searchInput.addEventListener("keydown", event => {
        if (event.key === "Enter") {
          event.preventDefault()
          const text = searchInput.value.trim()
          if (!text) return
          if (text.toLocaleLowerCase() !== this.#searchQuery.toLocaleLowerCase()) this.search(text, { preserveFocus: true })
          else if (event.shiftKey) this.previousSearchResult({ preserveFocus: true })
          else this.nextSearchResult({ preserveFocus: true })
        }
        if (event.key === "Escape") {
          event.preventDefault()
          searchInput.value = ""
          this.resetSearch()
        }
      }, { signal })

    }

    #renderUnavailable(message) {
      this.replaceChildren()
      const state = document.createElement("p")
      state.className = "jsonview:m-0 jsonview:rounded-xl jsonview:border jsonview:border-slate-300 jsonview:bg-slate-50 jsonview:p-4 jsonview:text-slate-700"
      state.textContent = message
      this.appendChild(state)
    }

    #renderData() {
      if (!this.#viewer || !this.#hasData) return
      const clone = window.PulsarJsonTreeModel?.cloneJson?.(this.#data) ?? structuredClone(this.#data)
      this.#viewer.data = clone
      Promise.resolve(this.#viewer.updateComplete).then(() => this.#queueCheckboxSync())
    }

    #rebuildSelectionModel() {
      const model = window.PulsarJsonTreeModel
      if (!model || !this.#hasData) return

      const selected = this.#selection ? [...this.#selection.selectedPointers] : []
      this.#index = model.createIndex(this.#data)
      this.#selection = new model.JsonTreeSelection(this.#index, selected)
      this.#pathToPointer = buildUpstreamPathMap(this.#index)
    }

    #connectObserver() {
      this.#observer?.disconnect()
      const root = this.#viewer?.shadowRoot
      if (!root) return
      this.#observer = new MutationObserver(() => this.#queueCheckboxSync())
      this.#observer.observe(root, { childList: true, subtree: true })
    }

    #queueCheckboxSync() {
      if (this.#syncQueued) return
      this.#syncQueued = true
      queueMicrotask(() => {
        this.#syncQueued = false
        this.#syncCheckboxes()
      })
    }

    #syncCheckboxes() {
      const root = this.#viewer?.shadowRoot
      if (!root || !this.#selection) return
      this.#ensureCheckboxStyles(root)

      if (!this.checkboxes) {
        for (const checkbox of root.querySelectorAll(`input.${CHECKBOX_CLASS}`)) checkbox.remove()
        for (const item of root.querySelectorAll('li[role="treeitem"][aria-checked]')) item.removeAttribute("aria-checked")
        return
      }

      for (const item of root.querySelectorAll('li[role="treeitem"][data-path]')) {
        const path = item.dataset.path
        const pointer = this.#pathToPointer.get(path)
        if (!pointer) continue

        const key = item.querySelector(':scope > [part~="key"]')
        if (!key) continue

        let checkbox = key.querySelector(`:scope > input.${CHECKBOX_CLASS}`)
        if (!checkbox) {
          checkbox = document.createElement("input")
          checkbox.type = "checkbox"
          checkbox.className = CHECKBOX_CLASS
          checkbox.tabIndex = -1
          checkbox.dataset.path = path
          checkbox.setAttribute("aria-label", `Select ${humanPath(path)}`)
          checkbox.addEventListener("click", event => event.stopPropagation())
          checkbox.addEventListener("change", event => this.#handleCheckboxChange(event))
          key.prepend(checkbox)
        }

        const state = this.#selection.state(pointer)
        checkbox.checked = state === "true"
        checkbox.indeterminate = state === "mixed"
        checkbox.setAttribute("aria-checked", state)
        item.setAttribute("aria-checked", state)
      }
    }

    #ensureCheckboxStyles(root) {
      if (root.getElementById(CHECKBOX_STYLE_ID)) return
      const style = document.createElement("style")
      style.id = CHECKBOX_STYLE_ID
      style.textContent = `
        [part~="key"] {
          display: inline-flex;
          align-items: center;
          min-block-size: 1.55rem;
          vertical-align: middle;
        }
        .${CHECKBOX_CLASS} {
          appearance: auto;
          box-sizing: border-box;
          inline-size: 1rem;
          block-size: 1rem;
          flex: 0 0 1rem;
          align-self: center;
          margin: 0 0.5rem 0 0;
          vertical-align: middle;
          accent-color: #0369a1;
          cursor: pointer;
        }
        .${CHECKBOX_CLASS}:focus-visible {
          outline: 2px solid #0369a1;
          outline-offset: 2px;
        }
      `
      root.appendChild(style)
    }

    #handleCheckboxChange(event) {
      if (!this.checkboxes) return
      const checkbox = event.currentTarget
      const pointer = this.#pathToPointer.get(checkbox.dataset.path)
      if (!pointer || !this.#selection) return
      this.#selection.toggle(pointer)
      this.#syncCheckboxes()
      this.#afterSelectionChange()
    }

    #handleKeyboardSelection(event) {
      if (!this.checkboxes || (event.key !== " " && event.key !== "Spacebar")) return
      const root = this.#viewer?.shadowRoot
      const active = root?.activeElement
      const item = active?.matches?.('li[role="treeitem"][data-path]') ? active : active?.closest?.('li[role="treeitem"][data-path]')
      if (!item) return

      const pointer = this.#pathToPointer.get(item.dataset.path)
      if (!pointer || !this.#selection) return
      event.preventDefault()
      event.stopPropagation()
      this.#selection.toggle(pointer)
      this.#syncCheckboxes()
      this.#afterSelectionChange()
    }

    #afterSelectionChange() {
      this.#updateActionState()
      this.#emitSelectionChange()
    }

    #applyCheckboxMode() {
      if (!this.#viewer) return
      const enabled = this.checkboxes
      if (this.#selectAllButton) this.#selectAllButton.hidden = !enabled
      if (this.#clearButton) this.#clearButton.hidden = !enabled
      if (this.#copyButton) this.#setIconButton(this.#copyButton, enabled ? "Copy selected JSON" : "Copy all JSON", "copy")
      if (this.#downloadButton) this.#setIconButton(this.#downloadButton, enabled ? "Download selected JSON" : "Download all JSON", "download")
      this.#syncCheckboxes()
      this.#updateActionState()
    }

    #applyTheme() {
      if (!this.#viewer) return
      const dark = this.theme === "dark"
      this.classList.toggle("pulsar-theme-dark", dark)
      const toolbar = this.querySelector(".pulsar-json-toolbar")
      const canvas = this.querySelector(".pulsar-json-canvas")
      const groups = this.querySelectorAll(".pulsar-json-action-group")
      const buttons = this.querySelectorAll("button[data-action]")
      const input = this.#searchInput

      toolbar?.classList.toggle("pulsar-surface-dark", dark)
      canvas?.classList.toggle("pulsar-canvas-dark", dark)
      input?.classList.toggle("pulsar-input-dark", dark)
      for (const group of groups) group.classList.toggle("pulsar-group-dark", dark)
      for (const button of buttons) button.classList.toggle("pulsar-button-dark", dark)
    }

    #updateActionState() {
      const hasData = this.#hasData
      const hasSelection = this.hasSelection()
      if (this.#copyButton) this.#copyButton.disabled = this.checkboxes ? !hasSelection : !hasData
      if (this.#downloadButton) this.#downloadButton.disabled = this.checkboxes ? !hasSelection : !hasData
      if (this.#clearButton) this.#clearButton.disabled = !hasSelection
      if (this.#selectAllButton) this.#selectAllButton.disabled = !hasData
    }

    #updateSearchActions() {
      const hasResults = this.#searchResultCount > 0
      if (this.#previousButton) this.#previousButton.disabled = !hasResults
      if (this.#nextButton) this.#nextButton.disabled = !hasResults
      if (this.#searchCounter) this.#searchCounter.textContent = hasResults ? `${this.#searchPosition + 1} / ${this.#searchResultCount}` : "0 / 0"
    }

    #suppressUpstreamSearchFocus() {
      const viewer = this.#viewer
      if (!viewer) return null
      const token = ++this.#searchFocusLockToken
      viewer.inert = true
      return { viewer, token }
    }

    #releaseUpstreamSearchFocus(lock) {
      const release = () => {
        if (lock.token !== this.#searchFocusLockToken || lock.viewer !== this.#viewer) return
        lock.viewer.inert = false
      }
      const scheduleRelease = () => requestAnimationFrame(release)
      Promise.resolve(lock.viewer.updateComplete).then(scheduleRelease, scheduleRelease)
    }

    #updateFullscreenButton() {
      if (!this.#fullscreenButton) return
      const active = document.fullscreenElement === this
      this.#setIconButton(this.#fullscreenButton, active ? "Exit fullscreen" : "Enter fullscreen", active ? "fullscreen-exit" : "fullscreen")
    }

    #showCopiedState() {
      if (!this.#copyButton) return
      window.clearTimeout(this.#copyTimer)
      this.#setIconButton(this.#copyButton, "Copied JSON", "copied")
      this.#copyTimer = window.setTimeout(() => {
        this.#setIconButton(this.#copyButton, this.checkboxes ? "Copy selected JSON" : "Copy all JSON", "copy")
      }, COPY_RESET_MS)
    }

    #announce(message) {
      if (!this.#status) return
      this.#status.textContent = ""
      requestAnimationFrame(() => {
        if (this.#status) this.#status.textContent = message
      })
    }

    #emitSelectionChange() {
      this.dispatchEvent(new CustomEvent("selectionchange", {
        bubbles: true,
        detail: {
          hasSelection: this.hasSelection(),
          selectedData: this.getSelectedData()
        }
      }))
    }
  }

  function createIcon(action) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    svg.setAttribute("aria-hidden", "true")
    svg.setAttribute("viewBox", "0 0 24 24")
    svg.setAttribute("class", "size-[18px]")
    svg.setAttribute("fill", "none")
    svg.setAttribute("stroke", "currentColor")
    svg.setAttribute("stroke-width", "2")
    svg.setAttribute("stroke-linecap", "round")
    svg.setAttribute("stroke-linejoin", "round")
    for (const [tag, attrs] of ICONS[action] || ICONS.copy) {
      const shape = document.createElementNS("http://www.w3.org/2000/svg", tag)
      for (const [name, value] of Object.entries(attrs)) shape.setAttribute(name, value)
      svg.appendChild(shape)
    }
    return svg
  }

  function countSearchMatches(value, query) {
    if (value === undefined) return 0
    const needle = String(query).toLocaleLowerCase()
    let count = 0

    const visit = current => {
      if (current === null || typeof current !== "object") return
      for (const [key, child] of Object.entries(current)) {
        let haystack = key
        if (child === null || typeof child !== "object") haystack += ` ${String(child)}`
        if (haystack.toLocaleLowerCase().includes(needle)) count += 1
        if (child && typeof child === "object") visit(child)
      }
    }

    if (value !== null && typeof value === "object") visit(value)
    else if (String(value).toLocaleLowerCase().includes(needle)) count = 1
    return count
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  }

  function sanitizeFilename(value) {
    const name = String(value || "data.json").replace(/[\\/:*?"<>|\u0000-\u001F]/g, "-").trim()
    return name || "data.json"
  }

  function buildUpstreamPathMap(index) {
    const map = new Map()
    for (const pointer of index.order) {
      if (!pointer) continue
      const meta = index.nodes.get(pointer)
      if (!meta?.path?.length) continue
      map.set(meta.path.join("."), pointer)
    }
    return map
  }

  function humanPath(path) {
    return path.split(".").filter(Boolean).join(" › ") || "root"
  }

  customElements.define(ELEMENT_NAME, PulsarJsonViewer)
})()
