import React from 'react'
import {div, pre, css} from './div'
import {css as emotion_css, cx} from 'emotion'
import {Global, css as core_css} from '@emotion/core'

export function template_to_string(value: TemplateStringsArray | string, ...more: any[]) {
  if (typeof value == 'string' || typeof value == 'number') {
    return value
  }
  return value.map((s, i) => s + (more[i] === undefined ? '' : more[i])).join('')
}

export function forward<Args extends any[], B, C>(
  f: (...args: Args) => B,
  g: (b: B) => C
): (...args: Args) => C {
  return (...args) => g(f(...args))
}

export function MakeAttr<Attr extends string>(attr: Attr) {
  return forward(template_to_string, value => ({[attr]: value}))
}

export const style = MakeAttr('style')
export const cls = MakeAttr('className')
export const id = MakeAttr('id')

const NAMED_KEYS: Record<string, string> = {
  Enter: 'ret',
  Tab: 'tab',
  Backspace: 'backspace',
  Delete: 'del',
  Escape: 'esc',
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  PageUp: 'pageup',
  PageDown: 'pagedown',
  Home: 'home',
  End: 'end',
  F1: 'f1',
  F2: 'f2',
  F3: 'f3',
  F4: 'f4',
  F5: 'f5',
  F6: 'f6',
  F7: 'f7',
  F8: 'f8',
  F9: 'f9',
  F10: 'f10',
  F11: 'f11',
  F12: 'f12',
  '>': 'gt',
  '<': 'lt',
  '-': 'minus',
}

// eighties
const NAMED_COLOURS: Record<string, string> = {
  black: '#2d2d2d',
  'bright-green': '#393939',
  'bright-yellow': '#515151',
  'bright-black': '#747369',
  'bright-blue': '#a09f93',
  white: '#d3d0c8',
  'bright-magenta': '#e8e6df',
  'bright-white': '#f2f0ec',
  red: '#f2777a',
  'bright-red': '#f99157',
  yellow: '#ffcc66',
  green: '#99cc99',
  cyan: '#66cccc',
  blue: '#6699cc',
  magenta: '#cc99cc',
  'bright-cyan': '#d27b53',
} || {
  black: 'rgb(00.0%, 00.0%, 00.0%)',
  red: 'rgb(80.0%, 00.0%, 00.0%)',
  green: 'rgb(30.6%, 60.4%, 02.4%)',
  yellow: 'rgb(76.9%, 62.7%, 00.0%)',
  blue: 'rgb(20.4%, 39.6%, 64.3%)',
  magenta: 'rgb(45.9%, 31.4%, 48.2%)',
  cyan: 'rgb(02.4%, 59.6%, 60.4%)',
  white: 'rgb(82.7%, 84.3%, 81.2%)',
  'bright-black': 'rgb(33.3%, 34.1%, 32.5%)',
  'bright-red': 'rgb(93.7%, 16.1%, 16.1%)',
  'bright-green': 'rgb(54.1%, 88.6%, 20.4%)',
  'bright-yellow': 'rgb(98.8%, 91.4%, 31.0%)',
  'bright-blue': 'rgb(44.7%, 62.4%, 81.2%)',
  'bright-magenta': 'rgb(67.8%, 49.8%, 65.9%)',
  'bright-cyan': 'rgb(20.4%, 88.6%, 88.6%)',
  'bright-white': 'rgb(93.3%, 93.3%, 92.5%)',
}

interface Face {
  fg: string
  bg: string
  attributes: string[]
}

interface Atom {
  face: Face
  contents: string
}

const atoms_text = (atoms: Atom[]) => atoms.map(atom => atom.contents).join('')

function color_to_css(name: string, fallback?: string): string {
  // use class cache?
  if (fallback && (name == 'default' || name == '')) {
    return color_to_css(fallback)
  } else if (name in NAMED_COLOURS) {
    return NAMED_COLOURS[name]
  } else {
    return name
  }
}

const global_style = {
  styles: core_css`
    pre {
      margin: 0;
    }
    pre, body {
      font-size: 12px;
      font-family: 'Consolas';
      letter-spacing: -0.025em;
    }
    body {
      margin: 0;
      overflow: hidden;
      user-select: none;
    }
  `,
}

const GlobalStyle = () => <Global {...global_style} />

function bg(face: Face) {
  return css(`background: ${color_to_css(face.bg, 'white')}`)
}

function face_to_style(face: Face, default_face?: Face) {
  return css`
    color: ${color_to_css(face.fg, (default_face || {}).fg)};
    background: ${color_to_css(face.bg, (default_face || {}).bg)};
  `
}

const Main = 'Main'
const Line = 'Line'
const ContentBlock = 'ContentBlock'
const ContentInline = 'ContentInline'

function Editor({websocket}: {websocket: WebSocket}) {
  const [state, set_state] = React.useState({} as any)
  const [root, set_root] = React.useState(null as null | HTMLElement)

  const send = React.useCallback(
    function send(method, ...params) {
      const msg = {jsonrpc: '2.0', method, params}
      if (websocket.readyState == websocket.OPEN) {
        websocket.send(JSON.stringify(msg))
      } else if (websocket.readyState == websocket.CONNECTING) {
        const prev = websocket.onopen
        websocket.onopen = ev => {
          prev && prev.bind(websocket)(ev)
          websocket.send(JSON.stringify(msg))
        }
      }
    },
    [websocket]
  )

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

  const mouse = [
    {handler: 'onMouseDown', message: 'press_left'},
    {handler: 'onMouseMove', message: 'move'},
    {handler: 'onMouseUp', message: 'release_left'},
  ]
  const mouse_handlers = (line: number, what_col: (e: MouseEvent) => void) =>
    (line === undefined ? [] : mouse).map(({handler, message}) => ({
      [handler]: (e: MouseEvent) => {
        if (!e.buttons || e.button) {
          return
        }
        e.preventDefault()
        e.stopPropagation()
        send('mouse', message, line, what_col(e))
      },
    }))

  function markup_atoms(default_face: Face) {
    const empty_atom = [{face: {fg: 'default', bg: 'default', attributes: []}, contents: ' '}]
    const is_empty = (atoms: Atom[]) => !atoms || (atoms.length == 1 && !atoms[0].contents)
    const ensure_nonempty = (atoms: Atom[]) => (is_empty(atoms) ? empty_atom : atoms)
    return function atoms_markup(atoms: Atom[], line: number) {
      return div(
        {className: Line},
        div(
          {className: ContentBlock},
          ...mouse_handlers(line, _ => atoms_text(atoms).length),
          div(
            {className: ContentInline},
            InlineFlexRowTop,
            ...mouse_handlers(line, e => {
              const node = e.currentTarget
              if (!node || !(node instanceof HTMLElement)) {
                return
              }
              const x = e.clientX - node.offsetLeft
              const w = node.clientWidth / (node.textContent || ' ').length // assuming constant width
              return Math.floor(x / w)
            }),
            ...ensure_nonempty(atoms).map(cell =>
              pre(face_to_style(cell.face, default_face), cell.contents.replace(/\n/g, ' '))
            )
          )
        )
      )
    }
  }

  function component() {
    if (!state.main || !state.status) {
      return <span>Nothing yet</span>
    }

    let info_prompt, info_inline
    if (state.info) {
      const [title, content, anchor, face, info_style] = state.info
      const dom = div(
        css`
          padding: 6px;
        `,
        face_to_style(face),
        ...content.map(markup_atoms(face))
      )
      if (info_style == 'prompt') {
        info_prompt = dom
      } else if (info_style == 'menuDoc') {
        info_inline = dom
      } else {
        console.warn('Unsupported info style', info_style)
      }
    }

    let menu_dom, menu_prompt, menu_line
    if (state.menu) {
      const [items, anchor, selected_face, face, menu_style] = state.menu
      menu_dom = items
        .slice(0, state.rows - 3)
        .map((item, i) =>
          markup_atoms(i == (state.selected || [-1])[0] ? selected_face : face)(item)
        )
      if (menu_style == 'prompt' || menu_style == 'search') {
        menu_prompt = div(
          WideChildren,
          css`
            display: inline-block;
          `,
          bg(face),
          ...menu_dom
        )
      } else if (menu_style == 'inline') {
        menu_line = anchor.line
      } else {
        console.warn('Unsupported menu style', menu_style)
      }
    }

    const [lines, default_face, padding_face] = state.main
    const rendered_lines = lines.map(markup_atoms(default_face))
    const main = div({className: Main}, bg(default_face), ...rendered_lines)

    const [status_line, status_mode_line, status_default_face] = state.status
    const status = div(markup_atoms(status_default_face)(status_line))
    const mode_line = div(markup_atoms(status_default_face)(status_mode_line))

    return (
      <div
        ref={div => set_root(div)}
        className={cx(
          emotion_css`
          height: 100vh;
          width: 100vw;
          overflow: hidden;
          ${bg(padding_face).css as any}
        `
        )}>
        {main}
        {div(
          Left,
          css`
            width: 100vw;
          `,
          div(
            Left,
            FlexColumnLeft,
            css`
              z-index: 3;
            `,
            menu_prompt,
            status
          ),
          div(
            Right,
            FlexColumnRight,
            css`
              z-index: 2;
            `,
            info_prompt,
            mode_line
          )
        )}
      </div>
    )
  }

  function send_resize(root: HTMLElement) {
    const lines = root.querySelectorAll(`.${Main} > .${Line}`)
    if (!lines) return
    const root_rect = root.getBoundingClientRect()
    const columns: number[] = []
    let next_rows = 0
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

      const cell_width = inline_rect.width / (inline.textContent?.length || 1)
      const block_width = Math.min(block_rect.right, line_rect.right) - block_rect.left
      columns.push(Math.floor(block_width / cell_width))

      const slack_bottom = line_rect.top + block_rect.height

      if (slack_bottom <= root_rect.bottom) {
        if (h == H - 1) {
          const more = Math.floor((root_rect.bottom - line_rect.bottom) / block_rect.height)
          if (more >= 0) {
            next_rows = H + more
          } else {
            next_rows = h + 1
          }
        } else {
          next_rows = h + 1
        }
      }
    })
    const next_cols = Math.min(...columns)

    send('resize', next_rows + 1, next_cols)
  }

  React.useEffect(() => {
    if (root) {
      const obs = new ResizeObserver(entries => {
        send_resize(entries[0].target)
      })
      obs.observe(root)
      return () => obs.disconnect()
    }
  }, [root, send])

  const shows: Record<string, string> = {
    menu_show: 'menu',
    info_show: 'info',
    menu_select: 'selected',
    draw: 'main',
    draw_status: 'status',
    set_cursor: 'cursor',
  }

  const hides: Record<string, string[]> = {
    menu_hide: ['menu', 'selected'],
    info_hide: ['info'],
  }

  React.useEffect(() => {
    websocket.onmessage = function on_message(msg) {
      interface Message {
        method: string
        params: any[]
      }
      const messages: Message[] = JSON.parse(msg.data)
      messages.forEach(({method, params}) => {
        // method === 'draw' || console.log(JSON.stringify({method, params}, undefined, 2).slice(0, 400))
        if (method === 'set_ui_options') {
          // pass
        } else if (method in hides) {
          hides[method].forEach(field => (state[field] = undefined))
        } else if (method in shows) {
          state[shows[method]] = params
        } else {
          console.warn('unsupported', method, JSON.stringify(params))
        }
      })
      set_state({...state})
    }

    function mod(k: string, e: KeyboardEvent) {
      let s = k
      if (e.altKey) s = 'a-' + s
      if (e.ctrlKey) s = 'c-' + s
      if (s == 'c-i') s = 'tab'
      if (e.shiftKey && s == 'tab') s = 's-tab'
      if (s == 'c-h') s = 'backspace'
      return s.length == 1 ? s : `<${s}>`
    }

    const onkeydown = (e: KeyboardEvent) => {
      // console.log(e)
      e.preventDefault()
      const key = e.key
      if (key in NAMED_KEYS) {
        send('keys', mod(NAMED_KEYS[key], e))
      } else if (key.length == 1) {
        send('keys', mod(key, e))
      }
      return false
    }

    const onmousewheel = (e: Event) => {
      // e.preventDefault()
      if (e instanceof WheelEvent && e.deltaY) {
        send('scroll', e.deltaY < 0 ? -1 : 1)
      }
    }

    window.addEventListener('keydown', onkeydown)
    window.addEventListener('mousewheel', onmousewheel)

    return () => {
      window.removeEventListener('keydown', onkeydown)
      window.removeEventListener('mousewheel', onmousewheel)
    }
  }, [websocket, send])

  return (
    <>
      <GlobalStyle />
      {component()}
    </>
  )
}

export function Kakoune() {
  const [ws, set_ws] = React.useState(undefined as undefined | WebSocket)
  React.useEffect(() => {
    const make_ws = async () => {
      const response = await fetch('http://' + window.location.host + '/api/sessions')
      const {sessions} = await response.json()
      console.info('Sessions:', ...sessions)
      const ws = new WebSocket('ws://' + window.location.host + '/kak/' + sessions[0])
      console.log('ws:', ws)
      set_ws(ws)
    }
    make_ws()
  }, [])
  React.useEffect(() => {
    return () => {
      if (ws) {
        console.log('closing ws')
        ws.close()
      }
    }
  }, [ws])
  return ws ? <Editor websocket={ws} /> : null
}
