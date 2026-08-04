"""WS 冒烟测试：连接后端，启动剧本生成，打印全部生成事件"""
import asyncio
import json
import sys

import websockets

TOKEN = open("/tmp/jubensha_smoke_token").read().strip()
SCRIPT_ID = 2
URL = f"ws://localhost:8011/api/ws?script_id={SCRIPT_ID}&token={TOKEN}"


async def main():
    counts = {}
    async with websockets.connect(URL, ping_interval=None) as ws:
        # 等待 session_connected
        msg = json.loads(await ws.recv())
        print("<<", msg["type"], flush=True)

        await ws.send(json.dumps({
            "type": "start_script_generation",
            "script_id": SCRIPT_ID,
            "theme": "深夜图书馆里，古籍修复师被发现死在禁书区，手中握着一页被撕掉的借书登记册",
            "player_count": 4,
            "script_type": "推理",
        }))
        print(">> start_script_generation sent", flush=True)

        while True:
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=420)
            except asyncio.TimeoutError:
                print("TIMEOUT waiting for events", flush=True)
                break
            msg = json.loads(raw)
            mtype = msg.get("type")
            if mtype == "script_generation_event":
                ev = msg["data"]
                etype = ev["type"]
                counts[etype] = counts.get(etype, 0) + 1
                content = (ev.get("content") or "").replace("\n", " ")[:120]
                print(f"[EV] {etype} step={ev.get('step')} kind={ev.get('kind')} iter={ev.get('iteration')} | {content}", flush=True)
                if etype in ("done", "error", "cancelled"):
                    break
            elif mtype == "script_data_update":
                script = msg["data"]["updated_script"]
                chars = script.get("characters", [])
                evs = script.get("evidence", [])
                locs = script.get("locations", [])
                phases = script.get("game_phases", [])
                bg = script.get("background_story")
                print(f"<< script_data_update: title={script['info']['title']!r} chars={len(chars)} "
                      f"evidence={len(evs)} locations={len(locs)} phases={len(phases)} bg={'yes' if bg else 'no'}", flush=True)
                murderers = [c["name"] for c in chars if c.get("is_murderer")]
                victims = [c["name"] for c in chars if c.get("is_victim")]
                print(f"   murderer={murderers} victim={victims}", flush=True)
            else:
                print("<<", mtype, str(msg.get("message") or "")[:100], flush=True)

    print("EVENT COUNTS:", counts, flush=True)


asyncio.run(main())
