# !pip install aiohttp --user
# !pip install aionotify --user

import asyncio
import aionotify
import aiohttp
from aiohttp import web
from asyncio.subprocess import PIPE

app = web.Application()
routes = web.RouteTableDef()

@routes.get('/kak/{session}')
async def kak_json_websocket(request):
    websocket = web.WebSocketResponse()
    await websocket.prepare(request)

    session = request.match_info['session']
    print(session)
    kak = await asyncio.create_subprocess_exec(
        'kak', '-c', str(session).rstrip(), '-ui', 'json',
        stdin=PIPE, stdout=PIPE,
        limit=1024*1024*1024) # 1GB

    H = len('{ "jsonrpc": "2.0", "method": "refresh"')
    async def fwd():
        buf = []
        async for message in kak.stdout:
            if websocket.closed:
                kak.terminate()
                await kak.wait()
                break
            if b'refresh' in message[0:H]:
                await websocket.send_str('['+','.join(buf) + ']')
                buf = []
            else:
                buf.append(message.decode())

    asyncio.create_task(fwd())

    async for msg in websocket:
        if msg.type == aiohttp.WSMsgType.TEXT:
            msg = msg.data
            # print(msg.encode())
            kak.stdin.write(msg.encode())

    return websocket

@routes.get('/sessions')
async def kak_sessions(request):
    kak = await asyncio.create_subprocess_exec('kak', '-l', stdout=PIPE)
    sessions = await kak.stdout.read()
    await kak.wait()
    return web.json_response({'sessions': sessions.decode().split()})

def track(url):
    url = repr(url)
    track="""
        "use strict";
        {
          let i = 0
          const reimported = {}
          const sloppy = s => s.replace(/.*\//g, '')
          window.reimport = src => {
            // console.log('Reimporting', src)
            reimported[sloppy(src)] = true
            return import('./static/' + src + '#' + i++)
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
    """
    text=f"""
    <html>
    <head>
    <script type="module">
        {track}
        track({url})
    </script>
    </head>
    <body></body>
    </html>
    """
    return web.Response(text=text, content_type='text/html')

@routes.get('/{track}.js')
def _track(request):
    return track(request.match_info.get('track') + '.js')

@routes.get('/')
def root(request):
    return track('index.js')

app.add_routes([
    web.static('/static/', '.', show_index=True, append_version=True),
    # web.static('/code/', '..', show_index=True, append_version=True)
])

@routes.get('/inotify')
async def inotify_websocket(request):
    print('request', request)
    websocket = web.WebSocketResponse()
    await websocket.prepare(request)

    watcher = aionotify.Watcher()
    watcher.watch(path='.', flags=aionotify.Flags.MODIFY)

    loop = asyncio.get_event_loop()
    await watcher.setup(loop)
    while True:
        event = await watcher.get_event()
        print(event)
        await websocket.send_str(event.name)

    watcher.close()
    return websocket

app.router.add_routes(routes)

loop = asyncio.get_event_loop()
if not loop.is_running():
    import logging
    logging.basicConfig(level=logging.DEBUG)
    import sys
    try:
        port = int(sys.argv[1])
    except:
        port = 8234
    web.run_app(app, host='127.0.0.1', port=port, access_log_format='%t %a %s %r')
else:
    if 'runner' in globals() and runner is not None:
        asyncio.ensure_future(runner.cleanup())
    runner = None
    async def make_runner():
        global runner
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, '127.0.0.1', 8234)
        await site.start()
    asyncio.ensure_future(make_runner())

