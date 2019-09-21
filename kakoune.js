
const atoms_text = atoms => atoms.map(atom => atom.contents).join('')

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

function activate(domdiff, root, websocket, state) {

  const { div, pre, style, cls, id, class_cache, mousewheel } = domdiff

  const {sheet, css, generate_class} = class_cache()

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
      font-size: 22px;
      // font-family: 'Luxi Mono';
      font-family: 'Consolas';
      letter-spacing: -0.025em;
    }
    body {
      margin: 0;
      overflow: hidden;
    }
  `

  const nonce = '-' + 'ABCXYZ'[((new Date).getTime() % 6)]
  const ContentInline = 'content-inline' + nonce
  const ContentBlock = 'content-block' + nonce
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


  function markup_atoms(default_face, k=()=>{}, offset=0) {
    const empty_atom = [{face: {fg: "default", bg: "default"}, contents: ' '}]
    const is_empty = atom => !atom || atom.length == 1 && !atom[0].contents
    const ensure_nonempty = atom => is_empty(atom) ? empty_atom : atom
    return function atoms_markup(atoms, line) {
      const {line_extra, inline_extra} = k(atoms, line) || {}
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
      if (atoms_text(atoms).length == 0) {
        atoms = atoms.slice()
        const last = atoms[atoms.length - 1]
        atoms[atoms.length - 1] = {...last, contents: '\n'}
      }
      return (
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
                )),
              ...(inline_extra || []))),
          ...(line_extra || []),
          // pre(css`display:none;color:white;font-size:0.8em`, JSON.stringify(atoms, 2, 2))
        )
    )}
  }

  let rAF = k => window.requestAnimationFrame(k)

  window.schedule_refresh = function schedule_refresh() {
    rAF(actual_refresh)
    rAF = x => 0
  }

  state.first_paint = true

  function actual_refresh() {

    rAF = k => window.requestAnimationFrame(k)

    if (!state.main || !state.status) {
      return
    }

    const right_inline = node => [
      FlexRowTop,
      css`justify-content: space-between`,
      css`& > .${ContentBlock} { flex-grow: 1 }`,
      node
    ]

    let info_prompt, info_inline
    if (state.info) {
      const [title, content, anchor, face, info_style] = state.info
      const dom = div(css`padding: 6px`, face_to_style(face), pre(content))
      if (info_style == 'prompt') {
        if (title == 'jseval') {
          // idea of Screwtape
          const geval = eval
          try {
            geval(content)
          } catch (e) {
            console.error(e)
          }
          state.info = undefined
        } else {
          info_prompt = dom
        }
      } else if (info_style == 'menuDoc') {
        info_inline = dom
      } else {
        console.warn('Unsupported info style', info_style)
      }
    }

    let menu_dom, menu_prompt, menu_line
    if (state.menu) {
      const [items, anchor, selected_face, face, menu_style] = state.menu
      menu_dom = items.slice(0, state.rows-3).map(
        (item, i) => markup_atoms(
          i == (state.selected || [-1])[0] ? selected_face : face
        )(item)
      )
      if (menu_style == 'prompt' || menu_style == 'search') {
        menu_prompt = div(
          WideChildren,
          css`display: inline-block`,
          bg(face),
          ...menu_dom)
      } else if (menu_style == 'inline') {
        menu_line = anchor.line
      } else {
        console.warn('Unsupported menu style', menu_style)
      }
    }

    const [lines, default_face, padding_face] = state.main
    const pua = x => x.length == 1 && x >= '\ue000' && x <= '\uf8ff'
    function adjust(atoms, i) {
      const line_extra = [], inline_extra = []
      if (i == menu_line) {
        // console.log(i, menu_line)
        const [items, anchor, selected_face, face, menu_style] = state.menu
        inline_extra.push(
          css`position: relative`,
          div(
            FlexRowTop,
            div(WideChildren, ...menu_dom, bg(face), css`margin-right: 6px;`),
            div(info_inline || false),
            css`z-index: 3`,
            style`
              position: absolute;
              top: 100%;
              left: ${(anchor.column - 1) / (atoms_text(atoms).length - 1) * 100}%;
            `))
      }
      if (atoms && pua(atoms[0].contents)) {
        const codepoint = atoms[0].contents.charCodeAt(0)
        const {dom, text, status} = state.neptyne_lines[codepoint]
        const colours = {
          default: 'blue',
          cancelled: 'yellow',
          executing: 'green',
          scheduled: 'cyan',
        }
        const border_colour = colours[status] || colours.default
        if (dom || text) {
          line_extra.push(
            FlexColumnLeft,
            css`align-items: stretch`,
            (dom ? div : pre)(
              dom ? dom : text,
              cls(status),
              mousewheel(e => e.stopPropagation()),
              css`
                color:${color_to_css('white')};
                background: linear-gradient(to bottom right, ${color_to_css('bright-green')} 20%, ${color_to_css('black')});
                padding:0.4em;
                padding-left:0.5em;
                margin-bottom: -0.5em;
                margin-top: 0.1em;
                margin-left: 0.2em;
                z-index: 1;
                border-left: 0.1em ${color_to_css(border_colour)} solid;
                overflow: overlay;
                max-height: 80vh;
                font-size: 0.9em;
                order:-1;
              `))
        }
      }
      return {line_extra, inline_extra}
    }
    state.offset = lines.some(atoms => atoms && pua(atoms[0].contents)) ? 1 : 0
    const rendered_lines = lines.map(markup_atoms(default_face, adjust, state.offset))
    const main = div(id(Main), bg(default_face), ...rendered_lines)

    const [status_line, status_mode_line, status_default_face] = state.status
    const status    = div(markup_atoms(status_default_face)(status_line))
    const mode_line = div(markup_atoms(status_default_face)(status_mode_line))

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
      sheet()
    )

    morph(root)

    if (state.first_paint) {
      state.first_paint = false
      if (state.resize_observer) {
        state.resize_observer.disconnect()
      }

      state.resize_observer = new ResizeObserver(window_size)
      state.resize_observer.observe(root)
      state.resize_observer.observe(root.querySelector(`#${Main}`))
    }
  }

  function window_size() {
    const next = {}

    const lines = root.querySelectorAll(`#${Main} > .${Line}`)
    if (!lines) return
    const root_rect = root.getBoundingClientRect()
    const columns = []
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
      columns.push(Math.floor(block_width / cell_width))

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
    next.cols = Math.min(...columns) + state.offset

    if (next.cols != state.cols || next.rows != state.rows) {
      Object.assign(state, next)
      send("resize", state.rows, state.cols)
    }
  }

  state.neptyne_been_eval = {}

  window.update_flags = function update_flags() {

    function with_msg(blob, line, msg) {
      const mimes = msg.data
      if (mimes) {
        const html = mimes['text/html']
        const svg = mimes['image/svg+xml']
        const png = mimes['image/png']
        const plain = mimes['text/plain']
        const js = mimes['application/javascript']
        const viewers = window.viewers || {}
        let view = {}
        for (let name in viewers) {
          try {
            view = viewers[name](mimes, blob) || {}
          } catch (e) {
            console.warn(e)
          }
          if (view.dom || view.text) {
            break
          }
        }
        if (view.dom) {
          line.dom = view.dom
        } else if (view.text) {
          line.text += view.text
        } else if (js && blob.status == 'done' && !state.neptyne_been_eval[blob.id]) {
          state.neptyne_been_eval[blob.id] = true
          const geval = eval
          try {
            geval(js)
          } catch (e) {
            console.error(e)
          }
        } else if (html || svg) {
          const div = document.createElement('div')
          div.style.background = 'white'
          div.style.display = 'inline-block'
          div.foreign = true
          div.innerHTML = html || svg
          line.dom = div
        } else if (png) {
          const img = document.createElement('img')
          img.style.background = 'white'
          img.foreign = true
          img.src = 'data:image/png;base64,' + png
          line.dom = img
        } else if (plain) {
          const s = plain.replace(/\u001b\[[0-9;]*m/g, '')
          const from_A = s.lastIndexOf('\u001b\[A')
          const from_r = s.lastIndexOf(/\r[^\n]/)
          if (from_A != -1) {
            line.text = s.slice(from_A+3)
          } else if (from_r != -1) {
            line.text = s.slice(from_r+1) + '\n'
          } else {
            line.text += s
          }
        }
      }
    }

    const ui_options = state.ui_options || {}

    state.neptyne_lines = {}

    Object.keys(ui_options).forEach(k => {
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
        // console.log(blob)
        const nothing_yet = blob.status == 'executing' && blob.msgs.length == 0
        const is_image = msg => 'image/png' in msg.data || 'image/svg+xml' in msg.data
        const previous_images = (blob.prev_msgs || []).some(is_image)
        state.neptyne_lines[codepoint] = {
          status: blob.status,
          dom: null,
          text: ''
        }
        const line = state.neptyne_lines[codepoint]
        if (blob.msgs && !nothing_yet && !previous_images) {
          blob.msgs.forEach(msg => with_msg(blob, line, msg))
        } else if (blob.prev_msgs) {
          blob.prev_msgs.forEach(msg => with_msg(blob, line, msg))
        } else {
          line.text = undefined
        }
      } catch (e) {
        console.error(e, dec)
      }
    })
  }

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

  update_flags()
  schedule_refresh()
}

async function main() {
  const domdiff = await reimport('./domdiff.js')
  if (typeof websocket == 'undefined' || websocket.readyState != websocket.OPEN) {
    try {
      if (typeof websocket != 'undefined') {
        websocket.close()
      }
    } catch { }
    const response = await fetch('http://' + window.location.host + '/sessions')
    const {sessions} = await response.json()
    console.info('Sessions:', ...sessions)
    window.websocket = new WebSocket('ws://' + window.location.host + '/kak/' + sessions[0])
  }
  const root = document.getElementById('root') || document.body.appendChild(document.createElement('div'))
  root.id = 'root'
  window.state = (window.state || {})
  activate(domdiff, root, window.websocket, window.state)
}

main()


