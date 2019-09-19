"use strict";
{
  let i = 0
  const reimported = {}
  const sloppy = s => s.replace(/.*\//g, '')
  window.reimport = src => {
    // console.log('Reimporting', src)
    reimported[sloppy(src)] = true
    return import(src + '#' + i++)
  }
  const tracked = {}
  window.track = src => {
    if (!tracked[src]) {
      console.log('Tracking', src)
      tracked[src] = true;
      reimport(src)
    }
  }
  try {
    if (window.track_ws.readyState != websocket.OPEN) {
      window.track_ws.close()
    }
  } catch {}
  const ws_url = 'ws://' + window.location.host + '/inotify'
  window.track_ws = new WebSocket(ws_url)
  window.track_ws.onmessage = msg => {
    // console.log(sloppy(msg.data), ...Object.keys(reimported))
    const upd = sloppy(msg.data)
    if (reimported[upd]) {
      Object.keys(tracked).forEach(src => {
        console.log('Reloading', src, 'because', upd, 'was updated')
        reimport(src)
      })
    }
  }
}
