import * as React from 'react'
import * as ReactDOM from 'react-dom'
import {Kakoune} from './Kakoune'

const root = <Kakoune />

ReactDOM.render(root, document.getElementById('root'))

if (import.meta.hot) {
  // Hot Module Replacement (HMR) - Remove this snippet to remove HMR.
  // Learn more: https://www.snowpack.dev/#hot-module-replacement
  import.meta.hot.accept()
}
