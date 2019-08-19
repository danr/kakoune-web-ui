const Tag = (function init_morphdom_module() {
  'use strict';

  // morphdom
  // notable missing features: array keys, event listeners, thunks

  const isElement = x => x instanceof Element

  return function Tag(name, children) {

    const next_attrs = {}
    children = children.filter(function filter_child(child) {
      const type = typeof child
      if (type == 'object' && child.attr) {
        const {attr, value} = child
        if (attr in next_attrs) {
          next_attrs[attr] += ' ' + value
        } else {
          next_attrs[attr] = value
        }
        return false
      } else if (child && type != 'string' && type != 'function' && !isElement(child)) {
        throw new Error('Child needs to be false, string, function or DOM Element')
      }
      return child
    })

    return function morph(elem) {
      if (!elem || !isElement(elem) || elem.tagName != name.toUpperCase()) {
        elem = document.createElement(name)
      }
      for (const attr of elem.attributes) {
        if (!next_attrs[attr.name]) {
          elem.removeAttribute(attr.name)
        }
      }
      for (const attr in next_attrs) {
        const now = elem.getAttribute(attr) || ''
        const next = next_attrs[attr] || ''
        if (now != next && next) {
          elem.setAttribute(attr, next)
        }
      }
      while (elem.childNodes.length > children.length) {
        elem.removeChild(elem.lastChild)
      }
      for (let i = 0; i < children.length; ++i) {
        const child = children[i]
        if (i < elem.childNodes.length) {
          const prev = elem.childNodes[i]
          let next = child
          if (typeof child == 'function') {
            next = child(prev)
          } else if (typeof child == 'string') {
            if (prev instanceof Text && prev.textContent == child) {
              next = prev
            } else {
              next = document.createTextNode(child)
            }
          }
          if (!prev.isEqualNode(next)) {
            elem.replaceChild(next, prev)
          }
        } else {
          elem.append(typeof child == 'function' ? child() : child)
        }
      }
      return elem
    }
  }
})();

const MakeTag = name => (...children) => Tag(name, children)
const div = MakeTag('div')
const pre = MakeTag('pre')

function template_to_string(value, ...more) {
  if (typeof value == 'string') {
    return value
  }
  return value.map((s, i) => s + (more[i] || '')).join('')
}

function forward(f, g) {
  return (...args) => g(f(...args))
}

const MakeAttr = attr => forward(template_to_string, value => ({attr, value}))

const style = MakeAttr('style')
const cls = MakeAttr('class')
const id = MakeAttr('id')

function test_morphdom() {
  const tag = (name, ...children) => Tag(name, children)
  const tests = [
    tag('div', cls`boo`, tag('pre', id`heh`, 'hello')),
    tag('div', style`background: black`, 'hello'),
    tag('div', cls`foo`, 'hello', tag('h1', 'heh')),
    tag('div', cls`foo`, 'hello', tag('h2', 'heh')),
    tag('div', cls`foo`, 'hello', tag('h2', 'meh')),
    tag('span', tag('h1', 'a'), tag('h2', 'b')),
    tag('span', tag('h1', 'a'), tag('h3', 'b')),
    tag('span', tag('h2', 'a'), tag('h3', 'b')),
    tag('span', tag('h2', 'a'), 'zoo', tag('h3', 'b')),
    tag('span', cls`z`, id`g`, tag('h2', 'a'), 'zoo', tag('h3', 'b')),
    tag('span', tag('h2', 'a'), 'zoo', tag('h3', 'b')),
    tag('span', tag('h2', 'a'), 'zoo', tag('h3', 'boo')),
    tag('span', 'apa'),
    tag('span', tag('div', 'apa')),
    tag('span', cls`a`),
    tag('span', cls`b`),
  ]

  let now = undefined
  console.group()
  tests.forEach((morph, i) => {
    now = morph(now)
    console.log(now.outerHTML)
  })
  console.groupEnd()
}
// test_morphdom()

function activate(dom, websocket, state) {
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

  state.sheet = ''

  state.generated = new Map()

  function generate_class(key, gen_code) {
    if (!state.generated.has(key)) {
      const code = gen_code()
      const name = 'c' + state.generated.size // + '_' + code.trim().replace(/[^\w\d_-]+/g, '_')
      state.generated.set(key, name)
      if (-1 == code.search('{')) {
        state.sheet += `.${name} {${code}}\n`
      } else {
        state.sheet += code.replace(/&/g, _ => `.${name}`) + '\n'
      }
    }
    return {attr: 'class', value: state.generated.get(key)}
  }

  const css = forward(template_to_string, s => generate_class(s, () => s))

  function face_to_style(face, default_face={}) {
    return generate_class(JSON.stringify([face, default_face]), () => `
      color:${color_to_css(face.fg, default_face.fg)};
      background:${color_to_css(face.bg, default_face.bg)}
    `)
  }

  const Left = css`
          position: absolute;
          left: 0;
          bottom: 0;
        `
  const Right = css`
          position: absolute;
          right: 0;
          bottom: 0;
        `
  const FlexColumnRight = css`
          display: flex;
          flex-direction: column;
          align-items: flex-end;
        `
  const FlexColumnLeft = css`
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        `
  const FlexRowTop = css`
          display: flex;
          flex-direction: row;
          align-items: flex-start;
        `
  const WideChildren = css`
          & * {
            width: 100%;
          }
        `
  css`
    pre {
      margin: 0;
    }
    pre, body {
      font-size: 1.4rem;
      font-family: Consolas;
    }
    body {
      margin: 0;
      overflow: hidden;
    }
  `

  function row_markup(default_face) {
    const empty_row = [{face: {fg: "default", bg: "default"}, contents: ' '}]
    const is_empty = row => !row || row.length == 1 && !row[0].contents
    const ensure_nonempty = row => is_empty(row) ? empty_row : row
    return row => div(
      FlexRowTop,
      ...ensure_nonempty(row).map(cell =>
        pre(
          face_to_style(cell.face, default_face),
          cell.contents.replace(/\n/g, ' '))))
  }

  function bg(face) {
    return generate_class(face.bg, () => `background: ${color_to_css(face.bg, 'white')}`)
  }

  function refresh() {
    if (!state.main || !state.status) {
      return
    }

    const [lines, default_face, padding_face] = state.main
    const main = div(id`main`, bg(default_face), ...lines.map(row_markup(default_face)))

    const [status_line, status_mode_line, status_default_face] = state.status
    const status    = div(row_markup(status_default_face)(status_line))
    const mode_line = div(row_markup(status_default_face)(status_mode_line))

    let menu_inline, menu_prompt
    if (state.menu) {
      const [items, anchor, selected_face, face, menu_style] = state.menu
      const dom = items.slice(0, state.rows-3).map(
        (item, i) => row_markup(
          i == (state.selected || [-1])[0] ? selected_face : face
        )(item)
      )
      if (menu_style == 'prompt' || menu_style == 'search') {
        menu_prompt = div(
          WideChildren,
          css`display: inline-block`,
          bg(face),
          ...dom)
      } else if (menu_style == 'inline') {
        if (state.cell_height && state.cell_width) {
          menu_inline = div(
            WideChildren,
            bg(face),
            ...dom,
            style`
              position: absolute;
              top: ${state.cell_height * (1 + anchor.line)}px;
              left: ${state.cell_width * anchor.column}px;
            `)
        }
      } else {
        console.warn('Unsupported menu style', menu_style)
      }
    }

    let info_prompt, info_inline
    if (state.info) {
      const [title, content, anchor, face, info_style] = state.info
      const dom = div(css`padding: 6px`, face_to_style(face), pre(content))
      if (info_style == 'prompt') {
        if (title == 'jseval') {
          // idea of Screwtape
          info_prompt = eval(content)
        } else {
          info_prompt = dom
        }
      } else if (info_style == 'menuDoc') {
        info_inline = dom
      } else {
        console.warn('Unsupported info style', info_style)
      }
    }

    const morph = div(
      id`root`,
      bg(padding_face),
      css`
        height: 100vh;
        width: 100vw;
        overflow: hidden;
      `,
      main,
      div(Left, css`width: 100vw`,
        div(Left, FlexColumnLeft, css`z-index: 1`, menu_prompt, status),
        div(Right, FlexColumnRight, info_prompt, mode_line)),
      menu_inline && div(FlexRowTop, menu_inline, info_inline),
      Tag('style', [state.sheet])
    )

    morph(root)
  }

  refresh()

  const shows = {
    menu_show: 'menu',
    info_show: 'info',
    menu_select: 'selected',
    draw: 'main',
    draw_status: 'status'
  }

  const hides = {
    menu_hide: ['menu', 'selected'],
    info_hide: ['info'],
  }

  const ignores = {
    set_cursor: true
  }

  websocket.onmessage = msg => {
    const {jsonrpc, method, params} = JSON.parse(msg.data)
    if (method == 'refresh') {
      window.requestAnimationFrame(refresh)
    } else if (method in hides) {
      hides[method].forEach(field => state[field] = undefined)
    } else if (method in shows) {
      state[shows[method]] = params
    } else if (method in ignores) {
    } else {
      console.warn('unsupported', method, JSON.stringify(params))
    }
  }

  function send(method, ...params) {
    const msg = { jsonrpc: "2.0", method, params }
    websocket.send(JSON.stringify(msg))
  }

  function mod(k, e) {
    let s = k
    if (e.altKey) s = 'a-' + s;
    if (e.ctrlKey) s = 'c-' + s;
    if (s == 'c-i') s = 'tab';
    if (e.shiftKey && s == 'tab') s = 's-tab';
    if (s == 'c-h') s = 'backspace';
    return s.length == 1 ? s : `<${s}>`
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
    const pre = root.querySelector('#main pre')
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
}

const root = document.getElementById('root') || document.body.appendChild(document.createElement('div'))
root.id = 'root'

;(k => {
  if (typeof websocket == 'undefined' || websocket.readyState != websocket.OPEN) {
    try {
      if (typeof websocket != 'undefined') {
        websocket.close()
      }
    } catch { }
    const xhr = new XMLHttpRequest()
    xhr.open('GET', 'http://' + window.location.host + '/sessions')
    xhr.responseType = 'json'
    xhr.onload = function () {
      if (xhr.readyState == 4) {
        if (xhr.status === 200) {
          const {sessions} = xhr.response
          console.info('Sessions:', sessions)
          window.websocket = new WebSocket('ws://' + window.location.host + '/kak/' + sessions[0])
          k()
        } else {
          console.error(xhr.statusText)
        }
      }
    }
    xhr.send(null)
  } else {
    k()
  }
})(() => {
  const state = window.state = (window.state || {})
  activate(root, websocket, state)
})

