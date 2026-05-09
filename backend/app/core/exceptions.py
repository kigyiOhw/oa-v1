from fastapi import Request
from fastapi.responses import JSONResponse


class OAException(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code


async def oa_exception_handler(request: Request, exc: OAException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message},
    )
