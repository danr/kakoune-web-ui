const Tag = (function init_morphdom_module() {
  'use strict';

  // morphdom
  // notable missing features: array keys, event listeners

  const lens = (attr, quirks={}) => node => next => {
    let now = quirks.get ? quirks.get(node) : node[attr]
    now = now || ''
    next = next || ''
    if (now != next) {
      if (next) {
        next = next.replace(/\s+/g, ' ').trim()
        node[attr] = next
        // if (next != node[attr]) {
        //   console.log('set get violated', next, quirks.get ? quirks.get(node) : node[attr])
        // }
      } else {
        if (quirks.remove) {
          quirks.remove(node)
        } else {
          node.removeAttribute(attr)
        }
      }
    }
  }

  const attr_lenses = {
    style: lens('style', {get: node => node.style.cssText}),
    class: lens('className', {remove: node => node.removeAttribute('class')}),
    id: lens('id')
  }

  const attr_names = Object.keys(attr_lenses)
  const is_attr = x => typeof x == 'object' && x.type

  return function Tag(name, ...children) {
    return function morph(dom) {
      const attrs = {}
      children = children.filter(function filter_child(child) {
        if (is_attr(child)) {
          const {type, value} = child
          if (type in attrs) {
            attrs[type] += ' ' + value
          } else {
            attrs[type] = value
          }
          return false
        }
        return typeof child != 'undefined'
      })
      if (!dom || !(dom instanceof Element) || dom.tagName.toUpperCase() != name.toUpperCase()) {
        const node = document.createElement(name)
        attr_names.forEach(attr => {
          const set = attr_lenses[attr](node)
          set(attrs[attr])
        })
        children.forEach(child => node.append(typeof child == 'function' ? child() : child))
        return node
      }
      attr_names.forEach(attr => {
        const set = attr_lenses[attr](dom)
        set(attrs[attr])
      })
      while (dom.childNodes.length > children.length) {
        dom.removeChild(dom.lastChild)
      }
      for (let i = 0; i < children.length; ++i) {
        const child = children[i]
        if (i < dom.childNodes.length) {
          const prev = dom.childNodes[i]
          let next
          if (typeof child == 'function') {
            next = child(prev)
          } else if (typeof child == 'string') {
            if (prev instanceof Text && prev.textContent == child) {
              next = prev
            } else {
              next = document.createTextNode(child)
            }
          } else {
            next = child
          }
          if (next !== prev) {
            dom.replaceChild(next, prev)
          }
        } else {
          dom.append(typeof child == 'function' ? child() : child)
        }
      }
      return dom
    }
  }
})();

const MakeTag = name => (...children) => Tag(name, ...children)
const div = MakeTag('div')
const pre = MakeTag('pre')

const MakeAttr = type => (value, ...more) => {
  if (typeof value != 'string') {
    value = value.map((s, i) => s + (more[i] || '')).join('')
  }
  return {type, value}
}

const style = MakeAttr('style')
const cls = MakeAttr('class')
const id = MakeAttr('id')


function test_morphdom() {
  const tests = [
    Tag('div', cls`boo`, Tag('pre', id`heh`, 'hello')),
    Tag('div', style`background: black`, 'hello'),
    Tag('div', cls`foo`, 'hello', Tag('h1', 'heh')),
    Tag('div', cls`foo`, 'hello', Tag('h2', 'heh')),
    Tag('div', cls`foo`, 'hello', Tag('h2', 'meh')),
    Tag('span', Tag('h1', 'a'), Tag('h2', 'b')),
    Tag('span', Tag('h1', 'a'), Tag('h3', 'b')),
    Tag('span', Tag('h2', 'a'), Tag('h3', 'b')),
    Tag('span', Tag('h2', 'a'), 'zoo', Tag('h3', 'b')),
    Tag('span', cls`z`, id`g`, Tag('h2', 'a'), 'zoo', Tag('h3', 'b')),
    Tag('span', Tag('h2', 'a'), 'zoo', Tag('h3', 'b')),
    Tag('span', Tag('h2', 'a'), 'zoo', Tag('h3', 'boo')),
    Tag('span', 'apa'),
    Tag('span', Tag('div', 'apa')),
    Tag('span', cls`a`),
    Tag('span', cls`b`),
  ]

  let now = undefined
  console.group()
  tests.forEach((morph, i) => {
    now = morph(now)
    console.log(now.outerHTML)
  })
  console.groupEnd()
}

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

  function face_to_style(face, default_face={}) {
    return css`
      color:${color_to_css(face.fg, default_face.fg)};
      background:${color_to_css(face.bg, default_face.bg)}
    `
  }

  const sheet = document.body.querySelector('style') || document.body.appendChild(document.createElement('style'))
  sheet.innerHTML = ''

  const generated = new Map()

  function css(value, ...more) {
    if (typeof value != 'string') {
      value = value.map((s, i) => s + (more[i] || '')).join('')
    }
    if (!generated.has(value)) {
      const name = 'c' + generated.size // + '_' + value.trim().replace(/[^\w\d_-]+/g, '_')
      generated.set(value, name)
      if (-1 == value.search('{')) {
        sheet.innerHTML += `.${name} {${value}}\n`
      } else {
        sheet.innerHTML += value.replace(/&/g, _ => `.${name}`) + '\n'
      }
    }
    return {type: 'class', value: generated.get(value)}
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

  function refresh() {
    if (!state.draw || !state.status) {
      return
    }
    const main_style = css`background: ${color_to_css(state.draw.default_face.bg, 'white')};`
    const root_style = css`background: ${color_to_css(state.draw.padding_face.bg, 'white')};`
    const next_lines = state.draw.lines
    const lines = next_lines.map(row_markup(state.draw.default_face))
    const main = div(id`main`, main_style, ...lines)

    const status = div(row_markup(state.status.default_face)(state.status.status_line))
    const mode_line = div(row_markup(state.status.default_face)(state.status.mode_line))

    let menu_inline, menu_prompt
    if (state.menu) {
      const menu = state.menu
      const html = menu.items.slice(0, state.rows-3).map(
        (item, i) => row_markup(
          i == menu.selected ? menu.selected_face : menu.face
        )(item)
      )
      const menu_style = css`background: ${color_to_css(menu.face.bg, 'white')};`
      if (menu.style == 'prompt' || menu.style == 'search') {
        menu_prompt = div(
          WideChildren,
          css`display: inline-block;`,
          menu_style,
          ...html)
      } else if (menu.style == 'inline') {
        if (state.cell_height && state.cell_width) {
          menu_inline = div(
            WideChildren,
            menu_style,
            ...html,
            css`
              position: absolute;
              top: ${state.cell_height * (1 + menu.anchor.line)}px;
              left: ${state.cell_width * menu.anchor.column}px;
            `)
        }
      } else {
        console.warn('Unsupported menu style', menu.style)
      }
    }

    let info_prompt, info_inline
    if (state.info) {
      const info_style = face_to_style(state.info.face)
      const html = div(css`padding: 6px;`, info_style, pre(state.info.content))
      if (state.info.style == 'prompt') {
        // TODO: if title is jseval! then just eval it
        info_prompt = html
      } else if (state.info.style == 'menuDoc') {
        info_inline = html
      } else {
        console.warn('Unsupported state.info style', state.info.style)
      }
    }

    const morph = div(
      id`root`,
      root_style,
      css`
          height: 100vh;
          width: 100vw;
          overflow: hidden;
      `,
      main,
      div(Left, css`width: 100vw`,
        div(Left, FlexColumnLeft, css`z-index: 1;`, menu_prompt, status),
        div(Right, FlexColumnRight, info_prompt, mode_line)),
      menu_inline && div(id`inline`, FlexRowTop, menu_inline, info_inline))

    morph(root)
  }

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
    info_hide() {
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
      // refresh()
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

const root = document.getElementById('root')

if (root) {
  if (typeof websocket == 'undefined' || websocket.readyState != websocket.OPEN) {
    try {
      if (typeof websocket != 'undefined') {
        websocket.close()
      }
    } catch { }
    window.websocket = new WebSocket('ws://' + window.location.host + '/kak/5163')
  }
  const state = window.state = (window.state || {})
  activate(root, websocket, state)
}

