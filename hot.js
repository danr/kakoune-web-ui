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
}

const NAMED_COLOURS = {
    "black":          [0.000, 0.000, 0.000],
    "red":            [0.800, 0.000, 0.000],
    "green":          [0.306, 0.604, 0.024],
    "yellow":         [0.769, 0.627, 0.000],
    "blue":           [0.204, 0.396, 0.643],
    "magenta":        [0.459, 0.314, 0.482],
    "cyan":           [0.024, 0.596, 0.604],
    "white":          [0.827, 0.843, 0.812],
    "bright-black":   [0.333, 0.341, 0.325],
    "bright-red":     [0.937, 0.161, 0.161],
    "bright-green":   [0.541, 0.886, 0.204],
    "bright-yellow":  [0.988, 0.914, 0.310],
    "bright-blue":    [0.447, 0.624, 0.812],
    "bright-magenta": [0.678, 0.498, 0.659],
    "bright-cyan":    [0.204, 0.886, 0.886],
    "bright-white":   [0.933, 0.933, 0.925],
}
// use class cache
function color_to_css(name, fallback) {
  if (fallback && (name == 'default' || name == '')) {
    return color_to_css(fallback)
  } else if (name in NAMED_COLOURS) {
    const [r,g,b] = NAMED_COLOURS[name]
    return `rgb(${r*100}%, ${g*100}%, ${b*100}%)`
  } else {
    return name
  }
}

if (typeof kak_ws != 'undefined') {
  kak_ws.close()
}
window.kak_ws = new WebSocket('ws://' + window.location.host + '/kak/4983')
document.body.innerHTML = '<div id="main"></div><div id="menu"></div><div id="info"></div><div id="left"></div><div id="right"></div>'
main = document.getElementById('main')
info = document.getElementById('info')
menu = document.getElementById('menu')
left = document.getElementById('left')
right = document.getElementById('right')

const tag = name => inner => `<${name}>${inner}</${name.split(' ')[0]}>`
const div = tag('div')
const styled = (style, s) => tag(`pre style="display:inline-block; margin: 0; ${style}"`)(s)
const esc = s => s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')

function row_markup(default_face) {
  return row => tag('div style="height:0.93em;"')(
    row.map(cell =>
      styled(`
        color:${color_to_css(cell.face.fg, default_face.fg)};
        background:${color_to_css(cell.face.bg, default_face.bg)}
      `, esc(cell.contents.replace('\n', ' ')))
    ).join('')
  )
}

kak_ws.onmessage = msg => {
  const {jsonrpc, ...w} = JSON.parse(msg.data)
  const handlers = {
    draw(lines, default_face, padding_face) {
      console.log(JSON.stringify(lines[0]))
      main.style.background = color_to_css(default_face.bg, 'white')
      document.body.style.background = color_to_css(padding_face.bg, 'white')
      main.innerHTML = lines.map(row_markup(default_face)).join('')
    },
    draw_status(status, mode, default_face) {
      console.log(default_face, mode)
      left.innerHTML = row_markup(default_face)(status)
      right.innerHTML = row_markup(default_face)(mode)
    },
    menu_show(items, anchor, selected_face, menu_face) {
      menu.innerHTML = items.map(row_markup(menu_face)).join('')
    },
    menu_hide() {
      menu.innerHTML = ''
    },
    info_show(title, content, anchor, face, style) {
      console.log(style)
      info.innerHTML = tag('pre')(esc(content))
    },
    info_hide(title, content, anchor, face, style) {
      info.innerHTML = ''
    }
  }
  if (w.method in handlers) {
    handlers[w.method](...w.params)
  } else {
    console.log(w.method, JSON.stringify(w.params))
  }
}

function press(keys) {
  kak_ws.send(
    JSON.stringify({
      jsonrpc: "2.0",
      method: "keys",
      params: [keys]
    }))
}

function mod(k, e) {
  let s = k
  if (e.altKey) {
    s = 'a-' + s
  }
  if (e.ctrlKey) {
    s = 'c-' + s
  }
  if (s == 'c-i') {
    s = 'tab'
  }
  if (s == 'c-h') {
    s = 'backspace'
  }
  return `<${s}>`
}

window.onkeydown = e => {
  const key = e.key
  if (key in NAMED_KEYS) {
    press(mod(NAMED_KEYS[key], e))
  } else if (key.length == 1) {
    press(mod(key, e))
  }
}
