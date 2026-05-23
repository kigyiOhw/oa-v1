import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.utils.security import decode_token

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])


class ConnectionManager:
    def __init__(self):
        self._connections: dict[int, list[WebSocket]] = {}

    async def connect(self, user_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.setdefault(user_id, []).append(websocket)
        logger.info("WebSocket connected | user_id=%s total_users=%s", user_id, len(self._connections))

    def disconnect(self, user_id: int, websocket: WebSocket) -> None:
        if user_id in self._connections:
            self._connections[user_id] = [
                ws for ws in self._connections[user_id] if ws != websocket
            ]
            if not self._connections[user_id]:
                del self._connections[user_id]
        logger.info("WebSocket disconnected | user_id=%s", user_id)

    async def send_to_user(self, user_id: int, data: dict) -> None:
        payload = json.dumps(data)
        dead: list[WebSocket] = []
        for ws in self._connections.get(user_id, []):
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(user_id, ws)

    async def broadcast(self, user_ids: list[int], data: dict) -> None:
        for uid in user_ids:
            await self.send_to_user(uid, data)


manager = ConnectionManager()


async def notify_task_created(user_id: int, title: str, instance_id: int, task_id: int) -> None:
    await manager.send_to_user(
        user_id,
        {
            "type": "new_task",
            "title": "New Task",
            "message": f"You have a new task: {title}",
            "instance_id": instance_id,
            "task_id": task_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
    )


async def notify_approval_result(user_id: int, title: str, instance_id: int, result: str) -> None:
    await manager.send_to_user(
        user_id,
        {
            "type": "approval_result",
            "title": "Approval Result",
            "message": f"Your request '{title}' was {result}",
            "instance_id": instance_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
    )


@router.websocket("/ws/notifications")
async def websocket_notifications(websocket: WebSocket) -> None:
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001)
        return

    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        await websocket.close(code=4001)
        return

    user_id_str = payload.get("sub")
    if not user_id_str:
        await websocket.close(code=4001)
        return

    user_id = int(user_id_str)
    await manager.connect(user_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
