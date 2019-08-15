function activate(dom, websocket, replay_data, scope) {

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

  root.innerHTML = `
    <div class="main"></div>
    <div class="bar left">
      <div class="left">
        <div class="menu"></div>
        <div class="status"></div>
      </div>
      <div class="right flex-column-right">
        <div class="info"></div>
        <div class="modeline"></div>
      </div>
    </div>
    <style>
      pre {
        display: inline-block;
        margin: 0;
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
    </style>
  `

  const main = root.querySelector('.main')
  const info = root.querySelector('.info')
  const menu = root.querySelector('.menu')
  const status = root.querySelector('.status')
  const modeline = root.querySelector('.modeline')

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
    return row => div(
      row.map(cell =>
        tag('pre', face_to_style(cell.face, default_face))(
          esc(cell.contents.replace(/\n/g, ' ')))
      ).join('')
    )
  }

  const handlers = {
    draw(lines, default_face, padding_face) {
      // console.log(JSON.stringify(lines[0]))
      main.style.background = color_to_css(default_face.bg, 'white')
      root.style.background = color_to_css(padding_face.bg, 'white')
      main.innerHTML = lines.map(row_markup(default_face)).join('')
    },
    draw_status(status_line, mode_line, default_face) {
      status.innerHTML = row_markup(default_face)(status_line)
      modeline.innerHTML = row_markup(default_face)(mode_line)
    },
    menu_show(items, anchor, selected_face, menu_face) {
      menu.innerHTML = items.map(row_markup(menu_face)).join('')
    },
    menu_hide() {
      menu.innerHTML = ''
    },
    info_show(title, content, anchor, face, style) {
      console.log(arguments)
      info.innerHTML = tag('pre', 'padding: 6px; ' +  face_to_style(face))(esc(content))
    },
    info_hide(title, content, anchor, face, style) {
      info.innerHTML = ''
    }
  }

  const default_handler = (method) => (...params) => 0 // console.log(method, JSON.stringify(params))

  const handle_message = (method, params) => (handlers[method] || default_handler(method))(...params)

  function replay_messages() {
    replay_data.forEach((params, method) => {
      handle_message(method, params)
    })
  }
  replay_messages()

  websocket.onmessage = msg => {
    const {jsonrpc, ...w} = JSON.parse(msg.data)
    replay_data.delete(w.method)
    replay_data.set(w.method, w.params)
    handle_message(w.method, w.params)
  }

  function send(method, ...params) {
    console.log(method, params)
    websocket.send(
      JSON.stringify(
        { jsonrpc: "2.0",  method,  params }))
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

  let /*mutable*/ cell_height, cell_width

  function send_resize() {
    const pre = main.querySelector('pre')
    if (pre) {
      cell_height = pre.clientHeight
      cell_width = pre.clientWidth / pre.innerText.length
      const rows = Math.floor(root.clientHeight / cell_height)
      const cols = Math.floor(root.clientWidth / cell_width)
      if (rows && cols) {
        send("resize", rows, cols)
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
    if (cell_height && cell_width) {
      const row = Math.floor(e.clientY / cell_height)
      const col = Math.floor(e.clientX / cell_width)
      return [row, col]
    }
  }
  function button(e) {
    return e.button ? "right" : "left"
  }
  mouseoff()
  root.onmousedown = e => {
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
    if (pos = where(e)) {
      send("mouse", "release_" + button(e), ...pos)
    }
    mouseoff()
  }
}

const root = document.getElementById('root')

if (root) {
  if (typeof websocket == 'undefined' || websocket.readyState != websocket.OPEN) {
    try {
      websocket.close()
    } catch { }
    window.websocket = new WebSocket('ws://' + window.location.host + '/kak/5163')
  }
  const replay_data = window.replay_data = (window.replay_data || new Map())
  activate(root, websocket, replay_data, window)
}

