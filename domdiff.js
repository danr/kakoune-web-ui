const isElement = x => x instanceof Element

function template_to_string(value, ...more) {
  if (typeof value == 'string') {
    return value
  }
  return value.map((s, i) => s + (more[i] || '')).join('')
}

function forward(f, g) {
  return (...args) => g(f(...args))
}

export function Thunk(key, create) {
  key = JSON.stringify(key)
  return function thunk(elem) {
    if (!elem || !isElement(elem) || elem.key != key) {
      elem = create()(elem)
      elem.key = key
    }
    return elem
  }
}

export function Tag(name, children) {
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

export const MakeTag = name => (...children) => Tag(name, children)
export const div = MakeTag('div')
export const pre = MakeTag('pre')
export const code = MakeTag('code')
export const span = MakeTag('span')

export const MakeAttr = attr => forward(template_to_string, value => ({attr, value}))

export const style = MakeAttr('style')
export const cls = MakeAttr('class')
export const id = MakeAttr('id')

export const Handler = handler => value => ({handler, value})

export const mousemove  = Handler('mousemove')
export const mouseover  = Handler('mouseover')
export const mousedown  = Handler('mousedown')
export const mouseup    = Handler('mouseup')
export const mousewheel = Handler('mousewheel')
export const click      = Handler('click')

export function class_cache(class_prefix='c') {
  const generated = new Map()
  const sheet = document.createElement('style')
  sheet.foreign = true

  function generate_class(key, gen_code) {
    if (!generated.has(key)) {
      const code = gen_code().trim().replace(/\n\s*/g, '\n').replace(/[:{;]\s*/g, g => g[0])
      const name = class_prefix + generated.size // + '_' + code.trim().replace(/[^\w\d_-]+/g, '_')
      generated.set(key, name)
      if (-1 == code.search('{')) {
        sheet.innerHTML += `.${name} {${code}}\n`
      } else {
        sheet.innerHTML += code.replace(/&/g, _ => `.${name}`) + '\n'
      }
    }
    return {attr: 'class', value: generated.get(key)}
  }

  const css = forward(template_to_string, s => generate_class(s, () => s))

  return {sheet, css, generate_class}
}

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

