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
    print('request', request)
    websocket = web.WebSocketResponse()
    await websocket.prepare(request)

    session = request.match_info['session']
    print(session)
    kak = await asyncio.create_subprocess_exec(
        'kak', '-c', str(session).rstrip(), '-ui', 'json',
        stdin=PIPE, stdout=PIPE,
        limit=1024*1024*1024) # 1GB

    async def fwd():
        buf = []
        async for message in kak.stdout:
            if websocket.closed:
                kak.terminate()
                await kak.wait()
                break
            if message.startswith(b'{ "jsonrpc": "2.0", "method": "refresh"'):
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
    print('request', request)
    kak = await asyncio.create_subprocess_exec('kak', '-l', stdout=PIPE)
    sessions = await kak.stdout.read()
    await kak.wait()
    return web.json_response({'sessions': sessions.decode().split()})

@routes.get('/')
def root(request):
    text="""
    <html><head><script>
    window.hot_ws = new WebSocket('ws://' + window.location.host + '/hot')
    hot_ws.onmessage = function (msg) {
        'use strict';
        console.info('Reloading')
        const geval = eval
        try {
          geval(msg.data)
        } catch (e) {
          console.error(e)
        }
    }
    </script></head>
    <body></body>
    </html>"""
    print('request', request)
    return web.Response(text=text, content_type='text/html')

@routes.get('/hot')
async def hot_websocket(request):
    print('request', request)
    websocket = web.WebSocketResponse()
    await websocket.prepare(request)

    watcher = aionotify.Watcher()
    watcher.watch(path='hot.js', flags=aionotify.Flags.MODIFY)

    # Prepare the loop
    loop = asyncio.get_event_loop()

    await watcher.setup(loop)
    while True:
        await websocket.send_str(open('hot.js', 'r').read())
        await watcher.get_event()

    watcher.close()
    return websocket

app.router.add_routes(routes)

loop = asyncio.get_event_loop()
if not loop.is_running():
    web.run_app(app, host='127.0.0.1', port=8234)
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

