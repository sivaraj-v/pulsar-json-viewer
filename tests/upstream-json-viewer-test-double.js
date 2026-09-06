(() => {
  "use strict"
  if (customElements.get("json-viewer")) return

  class TestJsonViewer extends HTMLElement {
    #data
    #expanded = new Set()
    updateComplete = Promise.resolve()

    constructor() {
      super()
      this.attachShadow({ mode: "open" })
    }

    set data(value) {
      this.#data = structuredClone(value)
      this.#render()
    }

    get data() {
      return structuredClone(this.#data)
    }

    connectedCallback() {
      this.tabIndex = 0
      this.#render()
    }

    expandAll() {
      this.#walk(this.#data, "", (value, path) => {
        if (value && typeof value === "object") this.#expanded.add(path)
      })
      this.#render()
    }

    collapseAll() {
      this.#expanded.clear()
      this.#render()
    }

    search(regexOrPath) {
      const matcher = regexOrPath instanceof RegExp ? regexOrPath : new RegExp(String(regexOrPath), "i")
      const nodes = [...this.shadowRoot.querySelectorAll('[role="treeitem"]')].filter(node => matcher.test(node.textContent || ""))
      let index = 0
      return {
        next: () => {
          for (const node of this.shadowRoot.querySelectorAll('[data-search-hit]')) node.removeAttribute("data-search-hit")
          const node = nodes[index++]
          if (!node) return { done: true, value: undefined }
          node.setAttribute("data-search-hit", "true")
          // Match @alenaksu/json-viewer: focus is scheduled after updateComplete.
          // The production component suppresses this focus only for live-search input flows.
          this.updateComplete.then(() => {
            if (!node.isConnected) return
            node.scrollIntoView({ block: "nearest", inline: "nearest" })
            node.focus()
          })
          return { done: false, value: node }
        }
      }
    }

    resetFilter() {
      for (const node of this.shadowRoot.querySelectorAll('[data-search-hit]')) node.removeAttribute("data-search-hit")
    }

    #walk(value, path, callback) {
      if (!value || typeof value !== "object") return
      for (const [key, child] of Object.entries(value)) {
        const childPath = path ? `${path}.${key}` : key
        callback(child, childPath)
        this.#walk(child, childPath, callback)
      }
    }

    #render() {
      if (!this.shadowRoot) return
      this.shadowRoot.replaceChildren()
      const base = document.createElement("div")
      base.addEventListener("keydown", event => this.#keydown(event))
      if (this.#data !== undefined) base.appendChild(this.#renderObject(this.#data, ""))
      this.shadowRoot.appendChild(base)
      this.updateComplete = Promise.resolve()
    }

    #renderObject(object, path) {
      const ul = document.createElement("ul")
      ul.setAttribute("part", "object")
      ul.setAttribute("role", "group")
      for (const [key, value] of Object.entries(object)) {
        const nodePath = path ? `${path}.${key}` : key
        const primitive = value === null || typeof value !== "object"
        const li = document.createElement("li")
        li.setAttribute("part", "property")
        li.setAttribute("role", "treeitem")
        li.dataset.path = nodePath
        li.tabIndex = -1
        li.setAttribute("aria-expanded", String(!primitive && this.#expanded.has(nodePath)))

        const keySpan = document.createElement("span")
        keySpan.setAttribute("part", "key")
        keySpan.textContent = `${key}: `
        if (!primitive) {
          keySpan.className = "key collapsable"
          keySpan.addEventListener("click", event => {
            event.preventDefault()
            if (this.#expanded.has(nodePath)) this.#expanded.delete(nodePath)
            else this.#expanded.add(nodePath)
            this.#render()
          })
        }
        li.appendChild(keySpan)

        if (primitive) {
          const valueSpan = document.createElement("span")
          valueSpan.setAttribute("part", "primitive")
          valueSpan.textContent = JSON.stringify(value)
          li.appendChild(valueSpan)
        } else if (this.#expanded.has(nodePath)) {
          li.appendChild(this.#renderObject(value, nodePath))
        }
        ul.appendChild(li)
      }
      return ul
    }

    #keydown(event) {
      if (!["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return
      const nodes = [...this.shadowRoot.querySelectorAll('[role="treeitem"]')]
      const active = this.shadowRoot.activeElement
      const index = nodes.indexOf(active)
      if (index < 0) return
      event.preventDefault()
      if (event.key === "ArrowDown") nodes[Math.min(index + 1, nodes.length - 1)]?.focus()
      if (event.key === "ArrowUp") nodes[Math.max(index - 1, 0)]?.focus()
      if (event.key === "Home") nodes[0]?.focus()
      if (event.key === "End") nodes[nodes.length - 1]?.focus()
      if (event.key === "ArrowRight") {
        const path = active.dataset.path
        if (active.getAttribute("aria-expanded") === "false") {
          this.#expanded.add(path)
          this.#render()
          this.shadowRoot.querySelector(`[data-path="${CSS.escape(path)}"]`)?.focus()
        }
      }
      if (event.key === "ArrowLeft") {
        const path = active.dataset.path
        if (active.getAttribute("aria-expanded") === "true") {
          this.#expanded.delete(path)
          this.#render()
          this.shadowRoot.querySelector(`[data-path="${CSS.escape(path)}"]`)?.focus()
        }
      }
    }
  }

  customElements.define("json-viewer", TestJsonViewer)
})()
