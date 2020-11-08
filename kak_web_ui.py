# !pip install aiohttp --user
# !pip install aionotify --user

import asyncio
import aionotify
import aiohttp
from aiohttp import web
from asyncio.subprocess import PIPE

import os
import logging
import sys

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

app.router.add_routes(routes)

def main():
    logging.basicConfig(level=logging.DEBUG)
    try:
        port = int(sys.argv[1])
    except:
        port = 8234
    web.run_app(app, host='127.0.0.1', port=port, access_log_format='%t %a %s %r')

if __name__ == '__main__':
    main()
