function activate(dom, websocket, state, scope) {
  'use strict';

  const NAMED_KEYS = {
      Enter: "ret",
      Tab: "tab",
      Backspace: "backspace",
      Delete: "del",
      Escape: "esc",
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      PageUp: "pageup",
      PageDown: "pagedown",
      Home: "home",
      End: "end",
      F1: "f1",
      F2: "f2",
      F3: "f3",
      F4: "f4",
      F5: "f5",
      F6: "f6",
      F7: "f7",
      F8: "f8",
      F9: "f9",
      F10: "f10",
      F11: "f11",
      F12: "f12",
      '>': "gt",
      '<': "lt",
      '-': "minus",
  }

  // eighties
  const NAMED_COLOURS = {
    'black':          '#2d2d2d',
    'bright-green':   '#393939',
    'bright-yellow':  '#515151',
    'bright-black':   '#747369',
    'bright-blue':    '#a09f93',
    'white':          '#d3d0c8',
    'bright-magenta': '#e8e6df',
    'bright-white':   '#f2f0ec',
    'red':            '#f2777a',
    'bright-red':     '#f99157',
    'yellow':         '#ffcc66',
    'green':          '#99cc99',
    'cyan':           '#66cccc',
    'blue':           '#6699cc',
    'magenta':        '#cc99cc',
    'bright-cyan':    '#d27b53',
  }
  function color_to_css(name, fallback) {
    // use class cache?
    if (fallback && (name == 'default' || name == '')) {
      return color_to_css(fallback)
    } else if (name in NAMED_COLOURS) {
      return NAMED_COLOURS[name]
    } else {
      return name
    }
  }

  function face_to_style(face, default_face={}) {
    return `
      color:${color_to_css(face.fg, default_face.fg)};
      background:${color_to_css(face.bg, default_face.bg)}
    `
  }

  function tag(name, style, cls) {
    return children => {
      const elt = document.createElement(name)
      style && (elt.style = style)
      cls && (elt.className = cls)
      if (Array.isArray(children)) {
        elt.append(...children)
      } else if (children) {
        elt.append(children)
      }
      return elt
    }
  }
  const div = tag('div')

  function row_markup(default_face) {
    const empty_row = [{face: {fg: "default", bg: "default"}, contents: ' '}]
    const is_empty = row => !row || row.length == 1 && !row[0].contents
    const ensure_nonempty = row => is_empty(row) ? empty_row : row
    return row => div(
      ensure_nonempty(row).map(cell =>
        tag('pre', face_to_style(cell.face, default_face))(
          cell.contents.replace(/\n/g, ' '))
      )
    )
  }

  function empty(node) {
    // const new_node = node.cloneNode(false);
    // node.parentNode.replaceChild(new_node, node)
    // return new_node
    node.innerHTML = ''
  }

  function set_children(node, ...children) {
    empty(node)
    children.forEach(child => node.append(child))
  }

  let prev = {}
  let prev_lines = []

  function eq(x, y) {
    if (x === y || x === null || y === null) {
      return x === y
    } else if (Array.isArray(x) || Array.isArray(y)) {
      return (
        Array.isArray(x) &&
        Array.isArray(y) &&
        x.length == y.length &&
        x.every((e, i) => eq(e, y[i]))
      )
    } else if (typeof x === 'object' && typeof y === 'object') {
      const xk = Object.keys(x).sort()
      const yk = Object.keys(y).sort()
      return eq(xk, yk) && xk.every(k => eq(x[k], y[k]))
    } else {
      return false
    }
  }

  function refresh() {
    function updated(p) {
      const r = prev[p] != state[p] // !eq(prev[p], state[p])
      // r && console.log(p, r)
      return r
    }
    const $ = (q, ...ch) => {
      const m = root.querySelector(q)
      if (m) {
        set_children(m, ...ch)
      }
      return m
    }
    if (!state.draw || !state.status) {
      return
    }
    // console.log(JSON.stringify(lines[0]))
    if (updated('draw')) {
      const main_style = `background: ${color_to_css(state.draw.default_face.bg, 'white')};`
      root.style.background = color_to_css(state.draw.padding_face.bg, 'white')
      // diff this against the previous to improve perf
      const next_lines = state.draw.lines
      const main = root.querySelector('#main')
      const now_lines = main.children
      while (main.children.length > next_lines.length) {
        main.removeChild(main.children.lastChild)
      }
      next_lines.forEach((next_line, i) => {
        const now_line = now_lines[i]
        const prev_line = prev_lines[i]
        const make_line = () => row_markup(state.draw.default_face)(next_line)
        if (!now_line) {
          main.append(make_line())
        } else if (!eq(prev_line, next_line)) {
          main.replaceChild(make_line(), now_line)
        }
        if (-1 != JSON.stringify(next_line).search('MA' + 'GIC')) {
          const d = div('A little bit of extra text')
          now_lines[i].append(d)
        }
        // MAG IC //
      })
      prev_lines = next_lines
    }

    if (updated('status')) {
      $('#status', row_markup(state.status.default_face)(state.status.status_line))
      $('#mode_line', row_markup(state.status.default_face)(state.status.mode_line))
    }

    if (updated('menu')) {
      const menu = state.menu
      if (!menu) {
        $('#menu')
        $('#menu_inline')
      } else {
        const html = menu.items.slice(0, state.rows-3).map(
          (item, i) => row_markup(
            i == menu.selected ? menu.selected_face : menu.face
          )(item)
        )
        const menu_style = `background: ${color_to_css(menu.face.bg, 'white')};`
        if (menu.style == 'prompt' || menu.style == 'search') {
          $('#menu', ...html).style = menu_style
        } else if (menu.style == 'inline') {
          if (state.cell_height && state.cell_width) {
            $('#menu_inline', ...html).style = `
              ${menu_style}
              position: absolute;
              top: ${state.cell_height * (1 + menu.anchor.line)}px;
              left: ${state.cell_width * menu.anchor.column}px;
            `
          }
        } else {
          console.warn('Unsupported menu style', menu.style)
        }
      }
    }

    if (updated('info')) {
      const info = state.info
      if (!info) {
        $('#info')
        $('#info_menu_inline')
      } if (info) {
        const pre = tag('pre')
        const style = face_to_style(info.face)
        if (info.style == 'prompt') {
          $('#info', pre(info.content)).style = style
        } else if (info.style == 'menuDoc') {
          $('#info_menu_inline', pre(info.content)).style = style
        } else {
          console.warn('Unsupported info style', info.style)
        }
      }
    }

    prev = {...state}
  }

  function diff(child, old) {
    if (typeof child == 'string' || child instanceof Node) {
      return child
    } else {
      return child(old)
    }
  }

  // morphdom
  // features to add: add data that was used to generate it or keys in arrays
  // what about event listeners
  function Tag(name, style, cls, ...children) {
    return dom => {
      function fresh() {
        const elt = document.createElement(name)
        style && (elt.style = style)
        cls && (elt.className = cls)
        children.forEach(child => elt.append(diff(child)))
        return elt
      }
      if (!dom || dom.tagName.toUpperCase() != name.toUpperCase() || !(dom instanceof Element)) {
        console.log('fresh', dom)
        return fresh()
      }
      console.log('reuse')
      if (dom.style != style) dom.style = style || ''
      if (dom.className != cls) dom.className = cls || ''
      while (dom.childNodes.length > children.length) {
        main.removeChild(main.children.lastChild)
      }
      children.forEach((child, i) => diff(child, dom.childNodes[i]))
      return dom
    }
  }

  const one = Tag('div', undefined, 'boo', Tag('pre', undefined, undefined, 'hello'))(null)
  console.log(one.outerHTML)

  const two = Tag('div', 'background: black', undefined, 'hello')(one)
  console.log(two.outerHTML)

  const three = Tag('div', undefined, 'foo', 'hello')(one)
  console.log(three.outerHTML)


  root.innerHTML = `
    <div id="main"></div>
    <div class="bar left">
      <div class="left flex-column-left" style="z-index: 1;">
        <div>
          <div id="menu" class="block-children" style="display: inline-block"></div>
        </div>
        <div id="status"></div>
      </div>
      <div class="right flex-column-right">
        <div id="info" class="info"></div>
        <div id="mode_line"></div>
      </div>
    </div>
    <div id="inline" class="flex-row-top">
      <div id="menu_inline" class="block-children"></div>
      <div id="info_menu_inline" class="info"></div>
    </div>
    <style>
      pre {
        display: inline-block;
        margin: 0;
      }
      .block-children * {
        display: block;
      }
      .info {
        padding: 6px;
      }
      body {
        margin: 0;
        font-size: 2em;
      }
      #root {
        height: 100vh;
        width: 100vw;
        overflow: hidden;
      }
      .bar {
        width: 100vw;
      }
      .left {
        position: absolute;
        left: 0;
        bottom: 0;
      }
      .right {
        position: absolute;
        right: 0;
        bottom: 0;
      }
      .flex-column-right {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
      }
      .flex-column-left {
        display: flex;
        flex-direction: column;
        align-items: flex-begin;
      }
      .flex-row-top {
        display: flex;
        flex-direction: row;
        align-items: flex-start;
      }
    </style>
  `

  refresh()

  const handlers = {
    draw(lines, default_face, padding_face) {
      state.draw = {lines, default_face, padding_face}
    },
    draw_status(status_line, mode_line, default_face) {
      state.status = {status_line, mode_line, default_face}
    },
    menu_show(items, anchor, selected_face, face, style) {
      state.menu = {items, anchor, selected_face, face, style, selected: -1}
    },
    menu_hide() {
      state.menu = undefined
    },
    info_show(title, content, anchor, face, style) {
      state.info = {title, content, anchor, face, style}
    },
    info_hide(title, content, anchor, face, style) {
      state.info = undefined
    },
    set_cursor(mode, coord) {
      state.cursor = {mode, coord}
    },
    menu_select(selected) {
      state.menu = {...state.menu, selected}
    },
    refresh() {
      window.requestAnimationFrame(refresh)
    },
  }

  const default_handler = (method) => (...params) => console.warn('unsupported', method, JSON.stringify(params))

  const handle_message = (method, params) => (handlers[method] || default_handler(method))(...params)

  websocket.onmessage = msg => {
    const {jsonrpc, ...w} = JSON.parse(msg.data)
    handle_message(w.method, w.params)
  }

  function send(method, ...params) {
    const msg = { jsonrpc: "2.0", method, params }
    websocket.send(JSON.stringify(msg))
  }

  scope.send = send

  function mod(k, e) {
    let s = k
    if (e.altKey) s = 'a-' + s;
    if (e.ctrlKey) s = 'c-' + s;
    if (s == 'c-i') s = 'tab';
    if (e.shiftKey && s == 'tab') s = 's-tab';
    if (s == 'c-h') s = 'backspace';
    return `<${s}>`
  }

  window.onkeydown = e => {
    e.preventDefault()
    const key = e.key
    if (key in NAMED_KEYS) {
      send("keys", mod(NAMED_KEYS[key], e))
    } else if (key.length == 1) {
      send("keys", mod(key, e))
    }
    return false
  }

  function send_resize() {
    const pre = root.querySelector('.main pre')
    if (pre) {
      state.cell_height = pre.clientHeight
      state.cell_width = pre.clientWidth / pre.innerText.length
      state.rows = Math.floor(root.clientHeight / state.cell_height)
      state.cols = Math.floor(root.clientWidth / state.cell_width)
      if (state.rows && state.cols) {
        send("resize", state.rows, state.cols)
      }
    }
  }
  send_resize()

  window.onresize = send_resize

  window.onmousewheel = e => {
    // e.preventDefault()
    if (!e.deltaX) {
      if (e.deltaY < 0) {
        send("mouse", "wheel_up", 0, 0)
      } else {
        send("mouse", "wheel_down", 0, 0)
      }
    }
  }

  function mouseoff() {
    root.onmousemove = undefined
  }

  function where(e) {
    if (state.cell_height && state.cell_width) {
      const row = Math.floor(e.clientY / state.cell_height)
      const col = Math.floor(e.clientX / state.cell_width)
      return [row, col]
    }
  }
  function button(e) {
    return e.button ? "right" : "left"
  }
  mouseoff()
  root.onmousedown = e => {
    if (e.button != 0) return // remove this to support right-click
    e.preventDefault()
    let pos
    if (pos = where(e)) {
      send("mouse", "press_" + button(e), ...pos)
      root.onmousemove = e => {
        e.preventDefault()
        if (pos = where(e)) {
          send("mouse", "move", ...pos)
        }
      }
    }
  }
  root.onmouseup = e => {
    e.preventDefault()
    let pos
    if (pos = where(e)) {
      send("mouse", "release_" + button(e), ...pos)
    }
    mouseoff()
  }

  return scope
}

const root = document.getElementById('root')

if (root) {
  if (typeof websocket == 'undefined' || websocket.readyState != websocket.OPEN) {
    try {
      websocket.close()
    } catch { }
    window.websocket = new WebSocket('ws://' + window.location.host + '/kak/5163')
  }
  const state = window.state = (window.state || {})
  activate(root, websocket, state, window)
}

