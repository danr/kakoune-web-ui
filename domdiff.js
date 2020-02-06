export function Tag(name, children) {
  const next_attrs = {}
  children = children.filter(function filter_child(child) {
    if (!child) return false
    const type = typeof child
    if (type == 'object' && !Array.isArray(child)) {
      for (const k in child) {
        if (!(k in next_attrs)) {
          next_attrs[k] = []
        }
        next_attrs[k].push(child[k])
      }
      return false
    } else if (child && type != 'string' && type != 'function') {
      throw new Error(`Child to ${name} needs to be false, string or function (is ${child} with type ${type})`)
    }
    return child
  })

  for (const k in next_attrs) {
    if (k[0] == 'o' && k[1] == 'n') {
      const cbs = [...next_attrs[k]]
      next_attrs[k] = e => cbs.forEach(cb => cb(e))
    } else {
      next_attrs[k] = next_attrs[k].join(' ')
    }
  }

  return function morph(elem, ns) {
    if (name == 'svg') {
      ns = 'http://www.w3.org/2000/svg'
    }
    if (!elem || elem.tagName != name.toUpperCase()) {
      if (ns) {
        elem = document.createElementNS(ns, name)
      } else {
        elem = document.createElement(name)
      }
    }
    for (const attr of [...elem.attributes]) {
      const k = attr.name
      if (!next_attrs[k]) {
        elem.removeAttribute(k)
      }
    }
    for (const k in elem.listeners || {}) {
      if (!next_attrs[k]) {
        elem[k] = undefined
        delete elem.listeners[k]
      }
    }
    for (const k in next_attrs) {
      const now = elem[k] || ''
      const next = next_attrs[k] || ''
      if (now != next && next) {
        if (k[0] == 'o' && k[1] == 'n') {
          elem[k] = next
          elem.listeners = elem.listeners || {}
          elem.listeners[k] = true
        } else {
          elem.setAttribute(k, next)
        }
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
          next = child(prev, ns)
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
        elem.append(typeof child == 'function' ? child(null, ns) : child)
      }
    }
    return elem
  }
}

export function template_to_string(value, ...more) {
  if (typeof value == 'string' || typeof value == 'number') {
    return value
  }
  return value.map((s, i) => s + (more[i] === undefined ? '' : more[i])).join('')
}

export function forward(f, g) {
  return (...args) => g(f(...args))
}

export const MakeTag = name => (...children) => Tag(name, children)
export const div = MakeTag('div')
export const pre = MakeTag('pre')
export const span = MakeTag('span')
export const h1 = MakeTag('h1')
export const h2 = MakeTag('h2')
export const h3 = MakeTag('h3')

export const MakeAttr = attr => forward(template_to_string, value => ({[attr]: value}))

export const style = MakeAttr('style')
export const cls = MakeAttr('class')
export const id = MakeAttr('id')

export const onmousemove  = h => ({onmousemove: h})
export const onmouseover  = h => ({onmouseover: h})
export const onmousedown  = h => ({onmousedown: h})
export const onmouseup    = h => ({onmouseup: h})
export const onmousewheel = h => ({onmousewheel: h})
export const onscroll     = h => ({onscroll: h})
export const onclick      = h => ({onclick: h})
export const oninput      = h => ({oninput: h})

export function make_class_cache(class_prefix='c') {
  const generated = new Map()
  const lines = []

  const id = 'class_cache_' + class_prefix
  const sheet = () => Tag('style', [{id}, ...lines])
  const dom = document.getElementById(id) || sheet()()
  document.head.appendChild(dom)

  const update = () => sheet()(dom)
  update()

  function generate_class(key, gen_code) {
    if (!generated.has(key)) {
      const code = gen_code().trim().replace(/\n\s*/g, '\n').replace(/[:{;]\s*/g, g => g[0])
      const name = class_prefix + generated.size
      generated.set(key, name)
      if (-1 == code.search('{')) {
        lines.push(`.${name} {${code}}\n`)
      } else {
        lines.push(code.replace(/&/g, _ => `.${name}`) + '\n')
      }
    }
    update()
    return {'class': generated.get(key)}
  }

  const css = forward(template_to_string, s => generate_class(s, () => s))

  return {
    css,
    generate_class,
    clear: () => {
      lines.splice(0, lines.length)
      generated.clear()
      update()
    },
  }
}

const caches = {}
export function class_cache(class_prefix='c') {
  if (!caches[class_prefix]) {
    caches[class_prefix] = make_class_cache(class_prefix)
  }
  return caches[class_prefix]
}

function test_domdiff() {
  const tests = [
    div(cls`boo`, pre(id`heh`, 'hello')),
    div(cls`foo`, 'hello', h1('heh')),
    div(cls`foo`, 'hello', h2('heh')),
    div(cls`foo`, 'hello', h2('meh')),
    div(style`background: black`, 'hello'),
    span(),
    span(false),
    span(null),
    span(undefined),
    span(onclick(e => 1)),
    span(onscroll(e => 3), onclick(e => 1)),
    span('apa'),
    span(cls`a`),
    span(cls`b`),
    span(div('apa')),
    span(h1('a'), h2('b')),
    span(h1('a'), h3('b')),
    span(h2('a'), h3('b')),
    span(h2('a'), 'zoo', h3('b')),
    span(h2('a'), 'zoo', h3('b')),
    span(h2('a'), 'zoo', h3('boo')),
    span(cls`z`, id`g`, h2('a'), 'zoo', h3('b')),
    span(cls`z`, style`color: red`, id`g`),
    span(style`color: red`, id`g`),
    span(style`color: red`, id`g`, cls`z`),
  ]

  function equal(doms) {
    const htmls = {}
    Object.keys(doms).forEach(k1 => {
      Object.keys(doms).forEach(k2 => {
        if (k1 < k2) {
          const doms1 = doms[k1]
          const doms2 = doms[k2]
          const html1 = doms[k1].outerHTML
          const html2 = doms[k2].outerHTML
          console.assert(doms1.isEqualNode(doms2), {[k1]: html1, [k2]: html2})
        }
      })
    })
  }

  tests.forEach((a, i) => {
    equal({
      scratch: a(),
      idem: a(a()),
    })
    tests.forEach((b, i) => {
      equal({
        scratch: a(),
        btoa: a(b()),
      })
    })
  })
}

console.time('test domdiff')
test_domdiff()
console.timeEnd('test domdiff')

