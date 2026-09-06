(function createPulsarJsonTreeModel(globalScope, factory) {
  "use strict"

  const api = factory()

  if (typeof module === "object" && module.exports) module.exports = api
  if (globalScope) globalScope.PulsarJsonTreeModel = api
})(typeof window === "undefined" ? globalThis : window, () => {
  "use strict"

  const ROOT_POINTER = ""
  const OBJECT_PROTOTYPE = Object.prototype
  const JSON_TYPES = Object.freeze(["string", "number", "boolean", "null", "object", "array"])
  const MISSING = Symbol("missing")

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value)
  }

  function isContainer(value) {
    return Array.isArray(value) || isObject(value)
  }

  function getType(value) {
    if (value === null) return "null"
    if (Array.isArray(value)) return "array"
    return typeof value
  }

  function assertJsonValue(value, seen = new WeakSet()) {
    const type = getType(value)
    if (!JSON_TYPES.includes(type)) throw new TypeError(`Unsupported JSON value type: ${type}`)
    if (type === "number" && !Number.isFinite(value)) throw new TypeError("JSON numbers must be finite")
    if (!isContainer(value)) return
    if (seen.has(value)) throw new TypeError("Circular values are not valid JSON")

    seen.add(value)
    const entries = Array.isArray(value) ? value.entries() : Object.entries(value)
    for (const [, child] of entries) assertJsonValue(child, seen)
    seen.delete(value)
  }

  function defineJsonProperty(target, key, value) {
    Object.defineProperty(target, key, {
      configurable: true,
      enumerable: true,
      writable: true,
      value
    })
  }

  function cloneJson(value, seen = new WeakMap()) {
    const type = getType(value)
    if (type === "null" || type === "string" || type === "boolean") return value
    if (type === "number") {
      if (!Number.isFinite(value)) throw new TypeError("JSON numbers must be finite")
      return value
    }
    if (!JSON_TYPES.includes(type)) throw new TypeError(`Unsupported JSON value type: ${type}`)
    if (seen.has(value)) throw new TypeError("Circular values are not valid JSON")

    const output = type === "array" ? [] : {}
    seen.set(value, output)

    if (type === "array") {
      for (const child of value) output.push(cloneJson(child, seen))
    } else {
      for (const [key, child] of Object.entries(value)) {
        defineJsonProperty(output, key, cloneJson(child, seen))
      }
    }

    seen.delete(value)
    return output
  }

  function escapePointerPart(part) {
    return String(part).replaceAll("~", "~0").replaceAll("/", "~1")
  }

  function unescapePointerPart(part) {
    return String(part).replaceAll("~1", "/").replaceAll("~0", "~")
  }

  function pathToPointer(path) {
    if (!Array.isArray(path)) throw new TypeError("Path must be an array")
    if (!path.length) return ROOT_POINTER
    return `/${path.map(escapePointerPart).join("/")}`
  }

  function pointerToPath(pointer) {
    if (pointer === ROOT_POINTER) return []
    if (typeof pointer !== "string" || !pointer.startsWith("/")) throw new TypeError("Invalid JSON pointer")
    return pointer.slice(1).split("/").map(unescapePointerPart)
  }

  function parentPointer(pointer) {
    if (pointer === ROOT_POINTER) return null
    const path = pointerToPath(pointer)
    path.pop()
    return pathToPointer(path)
  }

  function lastPathPart(pointer) {
    const path = pointerToPath(pointer)
    return path.length ? path[path.length - 1] : "$"
  }

  function appendPointer(pointer, part) {
    return `${pointer}/${escapePointerPart(part)}`
  }

  function hasOwn(target, key) {
    return target !== null && target !== undefined && OBJECT_PROTOTYPE.hasOwnProperty.call(target, key)
  }

  function getAtPointer(root, pointer) {
    let current = root
    for (const part of pointerToPath(pointer)) {
      if (Array.isArray(current)) {
        const index = Number(part)
        if (!Number.isInteger(index) || index < 0 || index >= current.length) return MISSING
        current = current[index]
        continue
      }
      if (!isObject(current) || !hasOwn(current, part)) return MISSING
      current = current[part]
    }
    return current
  }

  function createIndex(input) {
    assertJsonValue(input)
    const data = cloneJson(input)
    const nodes = new Map()
    const order = []
    const terminalPointers = []
    const stack = [{ pointer: ROOT_POINTER, path: [], value: data, parent: null, key: "$", entered: false }]

    while (stack.length) {
      const frame = stack.pop()
      if (!frame.entered) {
        const type = getType(frame.value)
        const entries = type === "array"
          ? frame.value.map((child, index) => [String(index), child])
          : type === "object"
            ? Object.entries(frame.value)
            : []
        const children = entries.map(([key]) => appendPointer(frame.pointer, key))
        const meta = {
          pointer: frame.pointer,
          path: frame.path,
          parent: frame.parent,
          key: frame.key,
          type,
          value: frame.value,
          children,
          terminalCount: 0
        }

        nodes.set(frame.pointer, meta)
        order.push(frame.pointer)
        stack.push({ ...frame, entered: true })

        for (let index = entries.length - 1; index >= 0; index -= 1) {
          const [key, child] = entries[index]
          stack.push({
            pointer: children[index],
            path: [...frame.path, key],
            value: child,
            parent: frame.pointer,
            key,
            entered: false
          })
        }
      } else {
        const meta = nodes.get(frame.pointer)
        if (!meta.children.length) {
          meta.terminalCount = 1
          terminalPointers.push(meta.pointer)
        } else {
          meta.terminalCount = meta.children.reduce((sum, pointer) => sum + nodes.get(pointer).terminalCount, 0)
        }
      }
    }

    return Object.freeze({
      data,
      nodes,
      order: Object.freeze(order),
      rootChildren: Object.freeze(nodes.get(ROOT_POINTER).children.slice()),
      terminalPointers: Object.freeze(terminalPointers)
    })
  }

  function collectTerminalPointers(index, pointer) {
    const root = index.nodes.get(pointer)
    if (!root) return []
    const output = []
    const stack = [root.pointer]

    while (stack.length) {
      const currentPointer = stack.pop()
      const meta = index.nodes.get(currentPointer)
      if (!meta.children.length) {
        output.push(currentPointer)
        continue
      }
      for (let childIndex = meta.children.length - 1; childIndex >= 0; childIndex -= 1) {
        stack.push(meta.children[childIndex])
      }
    }

    return output
  }

  function buildSelectedData(index, selectedPointers) {
    if (!selectedPointers.size) return undefined
    const built = new Map()

    for (let orderIndex = index.order.length - 1; orderIndex >= 0; orderIndex -= 1) {
      const pointer = index.order[orderIndex]
      const meta = index.nodes.get(pointer)

      if (!meta.children.length) {
        built.set(pointer, selectedPointers.has(pointer) ? cloneJson(meta.value) : MISSING)
        continue
      }

      if (meta.type === "array") {
        const output = []
        for (const childPointer of meta.children) {
          const child = built.get(childPointer)
          if (child !== MISSING) output.push(child)
        }
        built.set(pointer, output.length ? output : MISSING)
        continue
      }

      const output = {}
      let count = 0
      for (const childPointer of meta.children) {
        const child = built.get(childPointer)
        if (child === MISSING) continue
        defineJsonProperty(output, index.nodes.get(childPointer).key, child)
        count += 1
      }
      built.set(pointer, count ? output : MISSING)
    }

    const result = built.get(ROOT_POINTER)
    return result === MISSING ? undefined : result
  }

  class JsonTreeSelection {
    constructor(index = null, selectedPointers = []) {
      this.index = null
      this.selectedPointers = new Set(selectedPointers)
      this.selectedCounts = new Map()
      if (index) this.setIndex(index)
    }

    setIndex(index) {
      this.index = index
      const valid = new Set(index.terminalPointers)
      this.selectedPointers = new Set([...this.selectedPointers].filter(pointer => valid.has(pointer)))
      this.rebuildCounts()
    }

    rebuildCounts() {
      this.selectedCounts = new Map()
      if (!this.index) return

      for (const pointer of this.selectedPointers) {
        let current = pointer
        while (current !== null) {
          this.selectedCounts.set(current, (this.selectedCounts.get(current) || 0) + 1)
          current = this.index.nodes.get(current)?.parent ?? null
        }
      }
    }

    state(pointer) {
      const meta = this.index?.nodes.get(pointer)
      if (!meta) return "false"
      const selectedCount = this.selectedCounts.get(pointer) || 0
      if (selectedCount === 0) return "false"
      if (selectedCount === meta.terminalCount) return "true"
      return "mixed"
    }

    toggle(pointer) {
      const currentState = this.state(pointer)
      if (currentState === "false") this.select(pointer)
      else this.clear(pointer)
      return this.state(pointer)
    }

    select(pointer) {
      if (!this.index?.nodes.has(pointer)) return
      for (const terminalPointer of collectTerminalPointers(this.index, pointer)) {
        this.selectedPointers.add(terminalPointer)
      }
      this.rebuildCounts()
    }

    clear(pointer) {
      if (!this.index?.nodes.has(pointer)) return
      for (const terminalPointer of collectTerminalPointers(this.index, pointer)) {
        this.selectedPointers.delete(terminalPointer)
      }
      this.rebuildCounts()
    }

    selectAll() {
      if (!this.index) return
      this.selectedPointers = new Set(this.index.terminalPointers)
      this.rebuildCounts()
    }

    clearAll() {
      this.selectedPointers.clear()
      this.rebuildCounts()
    }

    hasSelection() {
      return this.selectedPointers.size > 0
    }

    isAllSelected() {
      return Boolean(this.index?.terminalPointers.length) && this.selectedPointers.size === this.index.terminalPointers.length
    }

    getSelectedData() {
      if (!this.index) return undefined
      return buildSelectedData(this.index, this.selectedPointers)
    }

    remapPrefix(oldPointer, newPointer) {
      const remapped = new Set()
      for (const pointer of this.selectedPointers) {
        if (pointer === oldPointer || pointer.startsWith(`${oldPointer}/`)) {
          remapped.add(`${newPointer}${pointer.slice(oldPointer.length)}`)
        } else {
          remapped.add(pointer)
        }
      }
      this.selectedPointers = remapped
      this.rebuildCounts()
    }
  }

  function replaceValue(input, pointer, nextValue) {
    assertJsonValue(nextValue)
    if (pointer === ROOT_POINTER) return cloneJson(nextValue)

    const data = cloneJson(input)
    const parent = getAtPointer(data, parentPointer(pointer))
    const key = lastPathPart(pointer)
    if (parent === MISSING || !isContainer(parent)) throw new Error("JSON path no longer exists")

    if (Array.isArray(parent)) {
      const index = Number(key)
      if (!Number.isInteger(index) || index < 0 || index >= parent.length) throw new Error("Array item no longer exists")
      parent[index] = cloneJson(nextValue)
    } else {
      if (!hasOwn(parent, key)) throw new Error("Property no longer exists")
      defineJsonProperty(parent, key, cloneJson(nextValue))
    }
    return data
  }

  function renameKey(input, pointer, nextKey) {
    if (pointer === ROOT_POINTER) throw new Error("The JSON root cannot be renamed")
    const normalizedKey = String(nextKey)
    const data = cloneJson(input)
    const parentPath = parentPointer(pointer)
    const parent = getAtPointer(data, parentPath)
    const oldKey = lastPathPart(pointer)

    if (!isObject(parent)) throw new Error("Only object properties can be renamed")
    if (!hasOwn(parent, oldKey)) throw new Error("Property no longer exists")
    if (normalizedKey !== oldKey && hasOwn(parent, normalizedKey)) throw new Error(`Property ${normalizedKey || "(empty key)"} already exists`)
    if (normalizedKey === oldKey) return { data, pointer }

    const replacement = {}
    for (const [key, value] of Object.entries(parent)) {
      defineJsonProperty(replacement, key === oldKey ? normalizedKey : key, value)
    }

    const updatedData = parentPath === ROOT_POINTER
      ? replacement
      : replaceValue(data, parentPath, replacement)

    return {
      data: updatedData,
      pointer: appendPointer(parentPath, normalizedKey)
    }
  }

  function addChild(input, parentPath, options = {}) {
    const data = cloneJson(input)
    const parent = getAtPointer(data, parentPath)
    if (!isContainer(parent)) throw new Error("New values can only be added to an object or array")

    const type = options.type || "string"
    const value = parseValueForType(type, options.value)

    if (Array.isArray(parent)) {
      parent.push(value)
      return { data, pointer: appendPointer(parentPath, String(parent.length - 1)) }
    }

    const key = String(options.key ?? "")
    if (hasOwn(parent, key)) throw new Error(`Property ${key || "(empty key)"} already exists`)
    defineJsonProperty(parent, key, value)
    return { data, pointer: appendPointer(parentPath, key) }
  }

  function removeNode(input, pointer) {
    if (pointer === ROOT_POINTER) throw new Error("The JSON root cannot be removed")
    const data = cloneJson(input)
    const parentPath = parentPointer(pointer)
    const parent = getAtPointer(data, parentPath)
    const key = lastPathPart(pointer)

    if (Array.isArray(parent)) {
      const index = Number(key)
      if (!Number.isInteger(index) || index < 0 || index >= parent.length) throw new Error("Array item no longer exists")
      parent.splice(index, 1)
      return data
    }

    if (!isObject(parent) || !hasOwn(parent, key)) throw new Error("Property no longer exists")
    delete parent[key]
    return data
  }

  function parseValueForType(type, rawValue) {
    if (!JSON_TYPES.includes(type)) throw new Error(`Unsupported JSON type: ${type}`)
    if (type === "string") return String(rawValue ?? "")
    if (type === "null") return null
    if (type === "object") return {}
    if (type === "array") return []
    if (type === "boolean") {
      if (rawValue === true || rawValue === "true") return true
      if (rawValue === false || rawValue === "false") return false
      throw new Error("Boolean values must be true or false")
    }

    const text = String(rawValue ?? "").trim()
    if (!text) throw new Error("Enter a number")
    const number = Number(text)
    if (!Number.isFinite(number)) throw new Error("Enter a finite JSON number")
    return number
  }

  function formatPointer(pointer) {
    if (pointer === ROOT_POINTER) return "$"
    return pointerToPath(pointer).reduce((output, part) => {
      if (/^(?:0|[1-9]\d*)$/.test(part)) return `${output}[${part}]`
      if (/^[A-Za-z_$][\w$]*$/.test(part)) return `${output}.${part}`
      return `${output}[${JSON.stringify(part)}]`
    }, "$")
  }

  return Object.freeze({
    JSON_TYPES,
    ROOT_POINTER,
    JsonTreeSelection,
    addChild,
    appendPointer,
    assertJsonValue,
    buildSelectedData,
    cloneJson,
    collectTerminalPointers,
    createIndex,
    formatPointer,
    getAtPointer,
    getType,
    hasOwn,
    isContainer,
    isObject,
    lastPathPart,
    parentPointer,
    parseValueForType,
    pathToPointer,
    pointerToPath,
    removeNode,
    renameKey,
    replaceValue
  })
})
