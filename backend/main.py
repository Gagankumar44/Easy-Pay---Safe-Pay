"""Easy Pay — Safe Pay: owned, persistent and explicitly fictional demo API."""
import os
import re
import json
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.exception_handlers import request_validation_exception_handler
from identity import router as profile_router, rate_limit
from payments import router as payment_router
from conversation import router as conversation_router
from services import router as services_router
from accounts import router as accounts_router
from followups import router as followups_router
from reading import router as reading_router, MAX_UPLOAD
from speech import router as speech_router, MAX_AUDIO
from phone_assistant import router as phone_router
from fraud_assistant import router as fraud_router

app = FastAPI(title="Easy Pay — Safe Pay", version="2.0.0")
origins = os.getenv("FRONTEND_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True,
                   allow_methods=["GET", "POST", "PUT", "DELETE"], allow_headers=["Content-Type"])


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    # FastAPI's default validation includes the supplied input. Never echo credentials.
    if request.url.path.startswith("/api/auth/"):
        return JSONResponse({"detail": "Use a valid 3–32 character username, a 15–128 character app password and, for recovery, an unused code."}, status_code=422)
    return await request_validation_exception_handler(request, exc)


@app.middleware("http")
async def guard_requests(request: Request, call_next):
    if request.method in {"POST", "PUT", "DELETE"}:
        origin = request.headers.get("origin")
        if origin and origin not in origins:
            return JSONResponse({"detail": "This origin is not allowed."}, status_code=403)
        try:
            length = int(request.headers.get("content-length", "0") or "0")
        except ValueError:
            return JSONResponse({"detail": "Invalid request length."}, status_code=400)
        image_upload = request.url.path == "/api/reading/image" and request.method == "POST"
        audio_upload = request.url.path == "/api/speech/transcribe" and request.method == "POST"
        if length < 0 or length > (MAX_UPLOAD if image_upload else MAX_AUDIO if audio_upload else 16384):
            return JSONResponse({"detail": "Request is too large."}, status_code=413)
        try:
            rate_limit(request)
        except Exception as exc:
            return JSONResponse({"detail": getattr(exc, "detail", "Please try later.")}, status_code=getattr(exc, "status_code", 429))
        json_body = request.headers.get("content-type", "").startswith("application/json")
        body = b""
        if (not image_upload and not audio_upload) or json_body:
            buffered = bytearray()
            async for chunk in request.stream():
                if len(buffered) + len(chunk) > 16384:
                    return JSONResponse({"detail": "Request is too large."}, status_code=413)
                buffered.extend(chunk)
            body = bytes(buffered)
            # Starlette's cached request forwards this bounded body downstream.
            request._body = body
        if json_body and body:
            # Decode JSON escapes before matching native scripts and digits.
            # Reject provided secrets without logging or retaining the body.
            try:
                text = json.dumps(json.loads(body), ensure_ascii=False)
            except (ValueError, UnicodeDecodeError, RecursionError):
                return JSONResponse({"detail": "Please send valid JSON."}, status_code=422)
            numeric_secret = re.search(r'(?i)(?:otp|pin|password|ओटीपी|पिन|पासवर्ड|ಒಟಿಪಿ|ಓಟಿಪಿ|ಪಿನ್|ಪಾಸ್.?ವರ್ಡ್)\s*(?:is|है|:|=)?\s*\d{4,}', text)
            password_value = re.search(r'(?i)(?:password|पासवर्ड|ಪಾಸ್.?ವರ್ಡ್)\s*(?:is|है|:|=)\s*[^\s"]{3,}', text)
            credential_route = request.url.path in {"/api/auth/register", "/api/auth/sign-in", "/api/auth/recover"}
            if not credential_route and (numeric_secret or password_value):
                return JSONResponse({"detail": "Remove financial secrets. Never enter an OTP, password or UPI PIN here."}, status_code=422)
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@app.get("/")
def home():
    return {"message": "Easy Pay — Safe Pay demo API", "demo_mode": True}


@app.get("/health")
def health():
    return {"status": "healthy", "service": "Easy Pay — Safe Pay", "demo_mode": True}


app.include_router(profile_router)
app.include_router(payment_router)
app.include_router(conversation_router)
app.include_router(services_router)
app.include_router(phone_router)
app.include_router(fraud_router)
app.include_router(accounts_router)
app.include_router(followups_router)
app.include_router(reading_router)
app.include_router(speech_router)

