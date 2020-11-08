import * as React from 'react'

import {ClassNames, Interpolation} from '@emotion/core'

export function dummy_keys(xs: React.ReactNode[], prefix = ';'): React.ReactElement {
  return (
    <>
      {xs.map((x, i) => {
        if (x && typeof x == 'object' && '$$typeof' in x) {
          let child = x as any
          if (!child.key) {
            const key = prefix + i
            const ref = child.ref
            child = React.createElement(child.type, {key, ref, ...child.props})
          }
          return child
        } else {
          return x
        }
      })}
    </>
  )
}

export function css(
  template: TemplateStringsArray | string | Interpolation,
  ...args: Interpolation[]
): {css: unknown} {
  return {css: [template, ...args]}
}

export type DivProps = {key?: string} & {css?: unknown} & React.HTMLAttributes<HTMLDivElement> &
  React.RefAttributes<HTMLDivElement>

export function Tag<TagName extends string>(
  tagName: TagName,
  ...args: (DivProps | {css: unknown} | React.ReactNode)[]
) {
  const props: Record<string, any> = {
    children: [],
    css: [],
  }
  args.forEach(function add(arg) {
    if (typeof arg == 'string' || typeof arg == 'number') {
      props.children.push(arg)
    } else if (arg && typeof arg == 'object') {
      if ('$$typeof' in arg) {
        props.children.push(arg)
      } else if (Array.isArray(arg)) {
        arg.forEach(add)
      } else {
        Object.entries(arg).forEach(([k, v]) => {
          if (k == 'css') {
            props.css.push(v)
          } else if (k == 'children') {
            props.children.push(...v)
          } else if (typeof v == 'function') {
            const prev = props[k]
            if (prev) {
              props[k] = (...args: any[]) => {
                prev(...args)
                v(...args)
              }
            } else {
              props[k] = v
            }
          } else if (typeof v == 'object') {
            props[k] = {...props[k], ...v}
          } else {
            if (props[k]) {
              props[k] += ' '
            } else {
              props[k] = ''
            }
            props[k] += v
          }
        })
      }
    }
  })
  props.children = dummy_keys(props.children, ':')
  const {css: props_css, key, ...normal_props} = props
  if (props_css.length) {
    return (
      <ClassNames key={key}>
        {({css, cx}) =>
          React.createElement(tagName, {
            ...normal_props,
            className: cx(
              normal_props.className,
              props_css.map((xs: any[]) => css(...xs))
            ),
          })
        }
      </ClassNames>
    )
  } else {
    return React.createElement(tagName, {...normal_props, key})
  }
}

export function div(...args: (DivProps | {css: unknown} | React.ReactNode)[]) {
  return Tag('div', ...args)
}

export function pre(...args: (DivProps | {css: unknown} | React.ReactNode)[]) {
  return Tag('pre', ...args)
}
