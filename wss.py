# print(asyncio.get_event_loop().is_running())
#
# if 'ws' in globals():
#     ws.ws_server.close()
#
# ws = websockets.serve(echo, "127.0.0.1", 8234)
#
# loop = asyncio.get_event_loop()
# if loop.is_running():
#     asyncio.ensure_future(ws, loop=loop)
#     # ws = asyncio.ensure_future(
# else:
#     asyncio.get_event_loop().run_until_complete(ws)
#     asyncio.get_event_loop().run_forever()
#
# ws.ws_server.is_serving()


# !pip install aiohttp --user
# !pip install aionotify --user
# !git add wss.py
# !git commit -m 'wss tinkering'

import asyncio
import aionotify
import aiohttp
from aiohttp import web
from asyncio.subprocess import PIPE

async def kak_json_websocket(request):
    print('request', request)
    websocket = web.WebSocketResponse(compress=False)
    await websocket.prepare(request)

    session = request.match_info['session']
    print(session)
    kak = await asyncio.create_subprocess_exec('kak', '-c', str(session).rstrip(), '-ui', 'json', stdin=PIPE, stdout=PIPE)

    async def fwd():
        async for message in kak.stdout:
            if websocket.closed:
                kak.terminate()
                await kak.wait()
                break
            await websocket.send_str(message.decode())

    asyncio.create_task(fwd())

    async for msg in websocket:
        if msg.type == aiohttp.WSMsgType.TEXT:
            msg = msg.data
            print(msg.encode())
            kak.stdin.write(msg.encode())

    return web.Response()

def root(request):
    text="""
    <html><head>
    <script>
    window.hot_ws = new WebSocket('ws://' + window.location.host + '/hot')
    hot_ws.onmessage = msg => {
        console.info('Reloading', msg.data)
        eval(msg.data)
    }
    </script>
    </head>
    <body/></html>"""
    print('request', request)
    return web.Response(text=text, content_type='text/html')

async def hot_websocket(request):
    print('request', request)
    websocket = web.WebSocketResponse(compress=False)
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
    return web.Response()

app = web.Application()
app.router.add_get('/kak/{session}', kak_json_websocket)
app.router.add_get('/hot', hot_websocket)
app.router.add_get('/', root)

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

