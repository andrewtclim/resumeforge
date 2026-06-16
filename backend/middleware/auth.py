import os
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

APP_SECRET = os.getenv("APP_SECRET", "")

# Routes that bypass auth (the login ping itself, plus static assets)
_PUBLIC_PREFIXES = ("/api/ping",)


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # No APP_SECRET set → local dev, pass everything through
        if not APP_SECRET:
            return await call_next(request)

        # Static files and the ping endpoint are public
        path = request.url.path
        if not path.startswith("/api/") or any(path.startswith(p) for p in _PUBLIC_PREFIXES):
            return await call_next(request)

        auth_header = request.headers.get("Authorization", "")
        if auth_header == f"Bearer {APP_SECRET}":
            return await call_next(request)

        return JSONResponse({"detail": "Unauthorized"}, status_code=401)
