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
  // use class cache
  function color_to_css(name, fallback) {
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
    style = style ? ` style="${style}"` : ''
    cls = cls ? ` class="${cls}"` : ''
    return inner => `<${name}${style}${cls}>${inner}</${name}>`
  }
  const div = tag('div')
  const esc = s => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

  function row_markup(default_face) {
    const empty_row = [{face: {fg: "default", bg: "default"}, contents: ' '}]
    const is_empty = row => !row || row.length == 1 && !row[0].contents
    const ensure_nonempty = row => is_empty(row) ? empty_row : row
    return row => div(
      ensure_nonempty(row).map(cell =>
        tag('pre', face_to_style(cell.face, default_face))(
          esc(cell.contents.replace(/\n/g, ' ')))
      ).join('')
    )
  }

  function refresh() {
    if (!state.draw || !state.status) {
      return
    }
    // console.log(JSON.stringify(lines[0]))
    const main_style = `background: ${color_to_css(state.draw.default_face.bg, 'white')};`
    root.style.background = color_to_css(state.draw.padding_face.bg, 'white')
    // could diff this against the replay data to improve perf
    const main_html = state.draw.lines.map(row_markup(state.draw.default_face)).join('')

    const status_html = row_markup(state.status.default_face)(state.status.status_line)
    const mode_line_html = row_markup(state.status.default_face)(state.status.mode_line)

    let info_html = ''
    let menu_html = ''
    let menu_style = ''
    let menu_inline_style = ''
    let menu_inline_html = ''
    let info_menu_inline_html = ''

    const menu = state.menu
    if (menu) {
      const html = menu.items.slice(0, state.rows-3).map(
        (item, i) => row_markup(
          i == menu.selected ? menu.selected_face : menu.face
        )(item)
      ).join('')
      menu_style = `background: ${color_to_css(menu.face.bg, 'white')}`
      if (menu.style == 'prompt' || menu.style == 'search') {
        menu_html = html
      } else if (menu.style == 'inline') {
        if (state.cell_height && state.cell_width) {
          menu_inline_html = html
          menu_inline_style = `
            position: absolute;
            top: ${state.cell_height * (1 + menu.anchor.line)}px;
            left: ${state.cell_width * menu.anchor.column}px;
          `
        }
      } else {
        console.warn('Unsupported menu style', style)
      }
    }

    const info = state.info
    if (info) {
      const pre = tag('pre', face_to_style(info.face))
      if (info.style == 'prompt') {
        info_html = pre(esc(info.content))
      } else if (info.style == 'menuDoc') {
        info_menu_inline_html = pre(esc(info.content))
      } else {
        console.warn('Unsupported info style', style)
      }
    }

    root.innerHTML = `
      <div class="main" style="${main_style}">${main_html}</div>
      <div class="bar left">
        <div class="left flex-column-left" style="z-index: 1;">
          <div>
            <div class="block-children" style="display: inline-block; ${menu_style}">${menu_html}</div>
          </div>
          <div>${status_html}</div>
        </div>
        <div class="right flex-column-right">
          <div class="info">${info_html}</div>
          <div>${mode_line_html}</div>
        </div>
      </div>
      <div class="flex-row-top" style="${menu_inline_style}">
        <div class="block-children" style="${menu_style}">${menu_inline_html}</div>
        <div class="info">${info_menu_inline_html}</div>
      </div>
    `
  }

  let style = document.querySelector('style') || document.body.appendChild(document.createElement('style'))

  style.innerHTML = `
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
  `

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
      state.menu.selected = selected
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

