const isElement = x => x instanceof Element

function str_map(s, k) {
  const out = []
  for (let i = 0; i < s.length; ++i) {
    out.push(k(s[i], i))
  }
  return out
}

function str_forEach(s, k) {
  for (let i = 0; i < s.length; ++i) {
    k(s[i], i)
  }
}

function flat_map(xs, k) {
  const out = []
  xs.forEach((x, i) => out.push(...k(x, i)))
  return out
}

function writer(h) {
  const out = []
  h((...xs) => out.push(...xs))
  return out
}

const atoms_text = atoms => atoms.map(atom => atom.contents).join('')

function Thunk(key, create) {
  key = JSON.stringify(key)
  return function thunk(elem) {
    if (!elem || !isElement(elem) || elem.key != key) {
      elem = create()(elem)
      elem.key = key
    }
    return elem
  }
}

function Tag(name, children) {
  const next_attrs = {}
  const next_handlers = {}
  children = children.filter(function filter_child(child) {
    if (!child) return false
    const type = typeof child
    if (type == 'object' && child.attr) {
      const {attr, value} = child
      if (attr in next_attrs) {
        next_attrs[attr] += ' ' + value
      } else {
        next_attrs[attr] = value
      }
      return false
    } else if (type == 'object' && child.handler) {
      const {handler, value} = child
      if (handler in next_handlers) {
        next_handlers[handler].push(value)
      } else {
        next_handlers[handler] = [value]
      }
      return false
    } else if (isElement(child) && !child.foreign) {
      throw new Error('DOM Element children needs to have prop foreign set to true')
    } else if (child && type != 'string' && type != 'function' && !isElement(child)) {
      throw new Error('Child needs to be false, string, function or DOM Element')
    }
    return child
  })

  return function morph(elem) {
    if (!elem || !isElement(elem) || elem.tagName != name.toUpperCase() || elem.foreign) {
      // need to create a new node if this is a FOREIGN OBJECT
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
    if (elem.handlers === undefined) {
      elem.handlers = {}
    }
    for (const type in elem.handlers) {
      if (!next_handlers[type]) {
        elem.handlers[type] = undefined
        elem['on' + type] = undefined
      }
    }
    for (const type in next_handlers) {
      if (!elem.handlers[type]) {
        elem['on' + type] = e => e.currentTarget.handlers[type].forEach(h => h(e))
      }
      elem.handlers[type] = next_handlers[type]
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
        if (prev !== next) {
          elem.replaceChild(next, prev)
        }
      } else {
        elem.append(typeof child == 'function' ? child() : child)
      }
    }
    return elem
  }
}

const MakeTag = name => (...children) => Tag(name, children)
const div = MakeTag('div')
const pre = MakeTag('pre')
const code = MakeTag('code')
const span = MakeTag('span')

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

const Handler = handler => value => ({handler, value})

const mousemove = Handler('mousemove')
const mouseover = Handler('mouseover')
const mousedown = Handler('mousedown')
const mouseup   = Handler('mouseup')
const click     = Handler('click')

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

function activate(root, websocket, state) {
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
      const code = gen_code().trim().replace(/\n\s*/g, '\n').replace(/[:{;]\s*/g, g => g[0])
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

  function bg(face) {
    return generate_class(face.bg, () => `background: ${color_to_css(face.bg, 'white')}`)
  }

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
  const InlineFlexRowTop = css`
          display: inline-flex;
          flex-direction: row;
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
      font-size: 19px;
      font-family: 'Luxi Mono';
      // letter-spacing: -0.025em;
    }
    body {
      margin: 0;
      overflow: hidden;
    }
  `

  const nonce = '-' + 'ABCXYZ'[((new Date).getTime() % 6)]
  const ContentInline = 'content-inline' + nonce
  const ContentBlock = 'content-block' + nonce
  const DataLine = 'data-line' + nonce
  const Main = 'main' + nonce
  const Line = 'line' + nonce

  const mouse = [
    {handler: 'mousedown', message: 'press_left'},
    {handler: 'mousemove', message: 'move'},
    {handler: 'mouseup', message: 'release_left'},
  ]
  const mouse_handlers = (line, what_col) =>
    (line === undefined ? [] : mouse).map(({handler, message}) => ({handler, value: e => {
      if (!e.buttons || e.button) {
        return
      }
      e.preventDefault()
      e.stopPropagation()
      send("mouse", message, line, what_col(e))
    }}))


  function markup_atoms(default_face, k=()=>false, offset=0) {
    const empty_atom = [{face: {fg: "default", bg: "default"}, contents: ' '}]
    const is_empty = atom => !atom || atom.length == 1 && !atom[0].contents
    const ensure_nonempty = atom => is_empty(atom) ? empty_atom : atom
    return function atoms_markup(atoms, line) {
      const extra = k(atoms, line) || []
      if (offset) {
        atoms = atoms.slice()
      }
      let chopped = 0
      while (atoms.length && chopped < offset) {
        if (atoms[0].contents.length) {
          atoms[0] = {...atoms[0]}
          atoms[0].contents = atoms[0].contents.slice(1)
          chopped++
        } else {
          atoms = atoms.slice(1)
        }
      }
      return ( // Thunk({atoms, line, default_face}, () =>
        div(
          cls(Line),
          div(
            cls(ContentBlock),
            ...mouse_handlers(line, _ => atoms_text(atoms).length),
            div(cls(ContentInline),
              InlineFlexRowTop,
              ...mouse_handlers(line, e => {
                const node = e.currentTarget
                const x = e.clientX - node.offsetLeft
                const w = node.clientWidth / node.textContent.length // assuming constant width
                return Math.floor(x / w) + offset
              }),
              ...ensure_nonempty(atoms).map(cell =>
                pre(
                  face_to_style(cell.face, default_face),
                  cell.contents.replace(/\n/g, ' ')
                )))
              ), // put inline menu here
          ...extra,
          // pre(css`display:none;color:white;font-size:0.8em`, JSON.stringify(atoms, 2, 2))
        )
    )}
  }

  let rAF = k => window.requestAnimationFrame(k)

  function schedule_refresh() {
    rAF(actual_refresh)
    rAF = x => 0
  }

  function actual_refresh() {

    rAF = k => window.requestAnimationFrame(k)

    // console.log(state.cursor && state.cursor[1])
    // console.time('refresh')
    // console.time('vdom')

    if (!state.main || !state.status) {
      return
    }


    const right_inline = node => [
      FlexRowTop,
      css`justify-content: space-between`,
      css`& > .${ContentBlock} { flex-grow: 1 }`,
      node
    ]

    // this is the magic
    const [lines, default_face, padding_face] = state.main
    const pua = x => x.length == 1 && x >= '\ue000' && x <= '\uf8ff'
    function adjust(atoms, i) {
      if (atoms && pua(atoms[0].contents)) {
        const codepoint = atoms[0].contents.charCodeAt(0)
        const html = state.neptyne_html[codepoint]
        const lines = state.neptyne_lines[codepoint]
        const status = state.neptyne_status[codepoint]
        let border_colour = 'blue'
        if (status == 'cancelled') border_colour = 'yellow'
        if (status == 'executing') border_colour = 'green'
        if (status == 'scheduled') border_colour = 'cyan'
        if (!html && !lines) return
        return [
          FlexColumnLeft, css`align-items: stretch`,
          (html ? div : pre)(html ? html : lines, cls(status), css`
            color:${color_to_css('white')};
            background: linear-gradient(to bottom right, ${color_to_css('bright-green')} 20%, ${color_to_css('black')});
            padding:0.4em;
            padding-left:0.5em;
            margin-bottom: -0.5em;
            margin-top: 0.1em;
            margin-left: 0.2em;
            z-index: 1;
            border-left: 0.1em ${color_to_css(border_colour)} solid;
            max-height: 80%;
            font-size: 0.9em;
            order:-1;
          `)]
      }
    }
    const offset = lines.some(atoms => atoms && pua(atoms[0].contents)) ? 1 : 0
    const rendered_lines = lines.map(markup_atoms(default_face, adjust, offset))
    const main = div(id(Main), bg(default_face), ...rendered_lines)

    const [status_line, status_mode_line, status_default_face] = state.status
    const status    = div(markup_atoms(status_default_face)(status_line))
    const mode_line = div(markup_atoms(status_default_face)(status_mode_line))

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

    let menu_inline, menu_prompt
    if (state.menu) {
      const [items, anchor, selected_face, face, menu_style] = state.menu
      const dom = items.slice(0, state.rows-3).map(
        (item, i) => markup_atoms(
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
        div(Left, FlexColumnLeft, css`z-index: 3`, menu_prompt, status),
        div(Right, FlexColumnRight, css`z-index: 2`,info_prompt, mode_line)),
      menu_inline && div(FlexRowTop, menu_inline, info_inline),
      Tag('style', [state.sheet])
    )

    // console.timeEnd('vdom')
    // console.time('morph')
    morph(root)
    // console.timeEnd('morph')

    function window_size() {
      // console.time('window_size')
      const next = {}

      const lines = root.querySelectorAll(`#${Main} .${Line}`)
      if (!lines) return
      const root_rect = root.getBoundingClientRect()
      next.columns = []
      const H = lines.length
      lines.forEach(function line_size(line, h) {
        const block = line.querySelector('.' + ContentBlock)
        const inline = line.querySelector('.' + ContentInline)
        if (!block || !inline) {
          return
        }
        const line_rect = line.getBoundingClientRect()
        const block_rect = block.getBoundingClientRect()
        const inline_rect = inline.getBoundingClientRect()

        const cell_width = inline_rect.width / inline.textContent.length
        const block_width = Math.min(block_rect.right, line_rect.right) - block_rect.left
        next.columns.push(Math.floor(block_width / cell_width))

        const slack_bottom = line_rect.top + block_rect.height

        if (slack_bottom <= root_rect.bottom) {
          if (h == H - 1) {
            const more = Math.floor((root_rect.bottom - line_rect.bottom) / block_rect.height)
            if (more >= 0) {
              next.rows = H + more
            } else {
              next.rows = h + 1
            }
          } else {
            next.rows = h + 1
          }
        }
      })
      next.cols = Math.min(...next.columns) + offset

      if (next.cols != state.cols || next.rows != state.rows) {
        Object.assign(state, next)
        // console.log('resize', state.rows, state.cols)
        send("resize", state.rows, state.cols)
      }
      // console.timeEnd('window_size')
    }

    // window.requestAnimationFrame(window_size)
    window_size()
    // console.timeEnd('refresh')
  }

  schedule_refresh()

  function update_flags() {
    const ui_options = state.ui_options || {}

    state.neptyne_status = {}
    state.neptyne_lines = {}
    state.neptyne_html = {}

    Object.keys(ui_options).sort().forEach(k => {
      const m = k.match(/^neptyne_(\d+)$/)
      if (!m) {
        return
      }
      const codepoint = Number(m[1])
      const content = ui_options[k]
      if (content === '') {
        return
      }
      const dec = window.atob(content)
      try {
        const blob = JSON.parse(dec)
        state.neptyne_status[codepoint] = blob.status
        function with_msg(msg) {
          const mimes = msg.data
          if (mimes) {
            if ('text/html' in mimes) {
              const div = document.createElement('div')
              div.foreign = true
              div.innerHTML = mimes['text/html']
              state.neptyne_html[codepoint] = div
            } else if ('image/png' in mimes) {
              const img = document.createElement('img')
              img.foreign = true
              img.src = 'data:image/png;base64,' + mimes['image/png']
              state.neptyne_html[codepoint] = img
            } else {
              const s = mimes['text/plain'].replace(/\u001b\[[0-9;]*m/g, '')
              const from_A = s.lastIndexOf('\u001b\[A')
              const from_r = s.lastIndexOf(/\r[^\n]/)
              if (from_A != -1) {
                state.neptyne_lines[codepoint] = s.slice(from_A+3)
              } else if (from_r != -1) {
                state.neptyne_lines[codepoint] = s.slice(from_r+1) + '\n'
              } else {
                state.neptyne_lines[codepoint] += s
              }
            }
          }
        }
        const nothing_yet = blob.status == 'executing' && blob.msgs.length == 0
        const previous_images = (blob.prev_msgs || []).some(msg => 'image/png' in msg.data)
        if (blob.msgs && !nothing_yet && !previous_images) {
          state.neptyne_lines[codepoint] = ''
          state.neptyne_html[codepoint] = null
          blob.msgs.forEach(with_msg)
        } else if (blob.prev_msgs) {
          state.neptyne_lines[codepoint] = ''
          state.neptyne_html[codepoint] = null
          blob.prev_msgs.forEach(with_msg)
        }
      } catch (e) {
        console.error(e, dec)
      }
    })
  }

  update_flags()

  const shows = {
    menu_show: 'menu',
    info_show: 'info',
    menu_select: 'selected',
    draw: 'main',
    draw_status: 'status',
    set_cursor: 'cursor',
  }

  const hides = {
    menu_hide: ['menu', 'selected'],
    info_hide: ['info'],
  }

  websocket.onmessage = function on_message(msg) {
    const messages = JSON.parse(msg.data)
    messages.forEach(({method, params}) => {
      if (method === 'set_ui_options') {
        state.ui_options = params[0]
        update_flags()
      } else if (method in hides) {
        hides[method].forEach(field => state[field] = undefined)
      } else if (method in shows) {
        state[shows[method]] = params
      } else {
        console.warn('unsupported', method, JSON.stringify(params))
      }
    })
    schedule_refresh()
  }

  function send(method, ...params) {
    const msg = { jsonrpc: "2.0", method, params }
    // console.log(method, ...params)
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

  window.onresize = () => schedule_refresh()

  window.onmousewheel = e => {
    // e.preventDefault()
    if (!e.deltaX) {
      // this is getting changed in kakoune 2359df0f
      // send("scroll", e.deltaY)
      if (e.deltaY < 0) {
        send("mouse", "wheel_up", 0, 0)
      } else {
        send("mouse", "wheel_down", 0, 0)
      }
    }
  }
}

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
  console.clear()
  const root = document.getElementById('root') || document.body.appendChild(document.createElement('div'))
  root.id = 'root'
  const state = window.state = (window.state || {})
  activate(root, websocket, state)
})

