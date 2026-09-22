from datetime import datetime, timezone
import hashlib
import hmac
import logging
import os
import uuid
from pathlib import Path
from typing import Any, Literal

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

try:
    import razorpay
except ImportError:  # pragma: no cover - optional until credentials are supplied
    razorpay = None

try:
    from twilio.rest import Client as TwilioClient
except ImportError:  # pragma: no cover - optional until credentials are supplied
    TwilioClient = None


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="campcook API")
api_router = APIRouter(prefix="/api")
logger = logging.getLogger("campcook")


class LoginRequest(BaseModel):
    identifier: str = Field(min_length=2, max_length=120)
    role: Literal["student", "staff"] = "student"
    phone_number: str | None = None


class OtpRequest(BaseModel):
    phone_number: str = Field(min_length=8, max_length=20)


class VerifyOtpRequest(OtpRequest):
    code: str = Field(min_length=4, max_length=10)


class CartLine(BaseModel):
    item_id: str
    quantity: int = Field(ge=1, le=20)


class OrderRequest(BaseModel):
    items: list[CartLine] = Field(min_length=1)
    payment_method: Literal["razorpay", "cash"] = "razorpay"


class RazorpayVerifyRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class TwilioOrderUpdateRequest(BaseModel):
    order_id: str
    phone_number: str = Field(min_length=8, max_length=20)
    status: Literal["placed", "preparing", "ready", "completed"]
    channels: list[Literal["sms", "whatsapp"]] = ["sms", "whatsapp"]


MENU_SEED = [
    {"id": "veg-thali", "name": "Veg Thali", "description": "A wholesome plate with seasonal vegetables, dal, rice and roti.", "price": 120, "category": "South Indian", "icon": "restaurant-outline", "accent": "brandTertiary", "popular": True},
    {"id": "masala-dosa", "name": "Masala Dosa", "description": "Crispy dosa with spiced potato filling and coconut chutney.", "price": 80, "category": "South Indian", "icon": "leaf-outline", "accent": "brandSecondary", "popular": True},
    {"id": "fried-rice", "name": "Fried Rice", "description": "Wok-tossed rice with garden vegetables and sesame.", "price": 70, "category": "North Indian", "icon": "nutrition-outline", "accent": "surfaceTertiary", "popular": True},
    {"id": "veg-sandwich", "name": "Veg Sandwich", "description": "Toasted multigrain bread, greens, tomato and herb spread.", "price": 50, "category": "Quick Bites", "icon": "cafe-outline", "accent": "brandTertiary", "popular": False},
    {"id": "chai", "name": "Masala Chai", "description": "Warming spiced tea brewed fresh for the campus.", "price": 20, "category": "Beverages", "icon": "cafe-outline", "accent": "surfaceTertiary", "popular": True},
    {"id": "coffee", "name": "Filter Coffee", "description": "Smooth South Indian filter coffee with a rich finish.", "price": 30, "category": "Beverages", "icon": "wine-outline", "accent": "brandSecondary", "popular": False},
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def razorpay_ready() -> bool:
    return bool(razorpay and os.getenv("RAZORPAY_KEY_ID") and os.getenv("RAZORPAY_KEY_SECRET"))


def twilio_ready() -> bool:
    return bool(
        TwilioClient
        and os.getenv("TWILIO_ACCOUNT_SID")
        and os.getenv("TWILIO_AUTH_TOKEN")
        and os.getenv("TWILIO_VERIFY_SERVICE_SID")
    )


def twilio_messaging_ready() -> bool:
    return twilio_ready() and bool(os.getenv("TWILIO_FROM_NUMBER"))


def twilio_whatsapp_ready() -> bool:
    return twilio_ready() and bool(os.getenv("TWILIO_WHATSAPP_FROM"))


def make_twilio_client() -> Any:
    if not TwilioClient:
        raise HTTPException(status_code=503, detail="Twilio SDK is not installed")
    return TwilioClient(os.environ["TWILIO_ACCOUNT_SID"], os.environ["TWILIO_AUTH_TOKEN"])


async def seed_menu() -> None:
    if await db.menu.count_documents({}) == 0:
        await db.menu.insert_many([{**item, "available": True, "created_at": now_iso()} for item in MENU_SEED])


async def menu_lines(items: list[CartLine]) -> tuple[list[dict[str, Any]], int]:
    ids = [item.item_id for item in items]
    docs = await db.menu.find({"id": {"$in": ids}, "available": {"$ne": False}}, {"_id": 0}).to_list(len(ids))
    by_id = {doc["id"]: doc for doc in docs}
    if len(by_id) != len(set(ids)):
        raise HTTPException(status_code=400, detail="One of the selected dishes is unavailable")
    lines: list[dict[str, Any]] = []
    total = 0
    for item in items:
        menu_item = by_id[item.item_id]
        line = {"item_id": menu_item["id"], "name": menu_item["name"], "unit_price": menu_item["price"], "quantity": item.quantity}
        lines.append(line)
        total += menu_item["price"] * item.quantity
    return lines, total


def session_user(request: Request) -> str:
    token = request.headers.get("x-session-token")
    if not token:
        raise HTTPException(status_code=401, detail="Please sign in to continue")
    return token


async def send_message(to: str, body: str, channel: Literal["sms", "whatsapp"]) -> bool:
    if channel == "sms":
        if not twilio_messaging_ready():
            return False
        from_number = os.environ["TWILIO_FROM_NUMBER"]
        target = to
    else:
        if not twilio_whatsapp_ready():
            return False
        from_number = f"whatsapp:{os.environ['TWILIO_WHATSAPP_FROM']}"
        target = f"whatsapp:{to}"
    make_twilio_client().messages.create(body=body, from_=from_number, to=target)
    return True


@api_router.get("/")
async def root() -> dict[str, str]:
    return {"message": "campcook API is ready"}


@api_router.get("/config")
async def config() -> dict[str, bool]:
    return {"razorpay_ready": razorpay_ready(), "twilio_otp_ready": twilio_ready(), "twilio_sms_ready": twilio_messaging_ready(), "twilio_whatsapp_ready": twilio_whatsapp_ready(), "google_managed_ready": bool(os.getenv("EMERGENT_AUTH_BASE_URL"))}


@api_router.post("/auth/login")
async def login(body: LoginRequest) -> dict[str, Any]:
    identifier = body.identifier.strip()
    token = f"campcook_{uuid.uuid4().hex}"
    user = {"id": token, "identifier": identifier, "role": body.role, "phone_number": body.phone_number, "name": identifier.split("@")[0].replace(".", " ").title(), "meal_balance": 250, "created_at": now_iso()}
    await db.users.update_one({"identifier": identifier}, {"$set": user}, upsert=True)
    return {"token": token, "user": user}


@api_router.get("/auth/google")
async def google_auth_config() -> dict[str, Any]:
    if not os.getenv("EMERGENT_AUTH_BASE_URL"):
        return {"available": False, "message": "Emergent managed Google sign-in needs the project callback configuration."}
    return {"available": True, "url": os.getenv("EMERGENT_AUTH_BASE_URL")}


@api_router.get("/menu")
async def get_menu() -> list[dict[str, Any]]:
    await seed_menu()
    return await db.menu.find({"available": {"$ne": False}}, {"_id": 0}).sort("popular", -1).to_list(100)


@api_router.get("/orders")
async def get_orders(request: Request) -> list[dict[str, Any]]:
    user_id = session_user(request)
    return await db.orders.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(50)


@api_router.post("/orders")
async def create_order(body: OrderRequest, request: Request) -> dict[str, Any]:
    user_id = session_user(request)
    lines, total = await menu_lines(body.items)
    order = {"id": f"CC-{uuid.uuid4().hex[:8].upper()}", "user_id": user_id, "lines": lines, "amount": total, "payment_method": body.payment_method, "status": "placed" if body.payment_method == "cash" else "payment_pending", "created_at": now_iso(), "updated_at": now_iso()}
    await db.orders.insert_one(order.copy())
    return order


@api_router.post("/payments/razorpay/order")
async def create_razorpay_order(body: OrderRequest, request: Request) -> dict[str, Any]:
    if not razorpay_ready():
        raise HTTPException(status_code=503, detail="Razorpay keys are not configured yet")
    user_id = session_user(request)
    lines, total = await menu_lines(body.items)
    receipt = f"campcook_{uuid.uuid4().hex[:20]}"
    gateway = razorpay.Client(auth=(os.environ["RAZORPAY_KEY_ID"], os.environ["RAZORPAY_KEY_SECRET"]))
    gateway_order = gateway.order.create({"amount": total * 100, "currency": "INR", "receipt": receipt, "payment_capture": 1})
    order = {"id": f"CC-{uuid.uuid4().hex[:8].upper()}", "user_id": user_id, "lines": lines, "amount": total, "payment_method": "razorpay", "razorpay_order_id": gateway_order["id"], "status": "payment_pending", "created_at": now_iso(), "updated_at": now_iso()}
    await db.orders.insert_one(order.copy())
    return {"order_id": order["id"], "razorpay_order_id": gateway_order["id"], "amount": total * 100, "currency": "INR", "key_id": os.environ["RAZORPAY_KEY_ID"]}


@api_router.post("/payments/razorpay/verify")
async def verify_razorpay_payment(body: RazorpayVerifyRequest, request: Request) -> dict[str, str]:
    user_id = session_user(request)
    if not razorpay_ready():
        raise HTTPException(status_code=503, detail="Razorpay keys are not configured yet")
    expected = hmac.new(os.environ["RAZORPAY_KEY_SECRET"].encode(), f"{body.razorpay_order_id}|{body.razorpay_payment_id}".encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, body.razorpay_signature):
        raise HTTPException(status_code=400, detail="Invalid Razorpay payment signature")
    await db.orders.update_one({"razorpay_order_id": body.razorpay_order_id, "user_id": user_id}, {"$set": {"status": "placed", "payment_id": body.razorpay_payment_id, "updated_at": now_iso()}})
    return {"status": "placed"}


@api_router.post("/twilio/otp/send")
async def send_otp(body: OtpRequest) -> dict[str, Any]:
    if not twilio_ready():
        raise HTTPException(status_code=503, detail="Twilio Verify credentials are not configured yet")
    verification = make_twilio_client().verify.services(os.environ["TWILIO_VERIFY_SERVICE_SID"]).verifications.create(to=body.phone_number.strip(), channel="sms")
    return {"status": verification.status, "configured": True}


@api_router.post("/twilio/otp/verify")
async def verify_otp(body: VerifyOtpRequest) -> dict[str, Any]:
    if not twilio_ready():
        raise HTTPException(status_code=503, detail="Twilio Verify credentials are not configured yet")
    result = make_twilio_client().verify.services(os.environ["TWILIO_VERIFY_SERVICE_SID"]).verification_checks.create(to=body.phone_number.strip(), code=body.code)
    return {"valid": result.status == "approved", "status": result.status}


@api_router.post("/twilio/order-update")
async def send_order_update(body: TwilioOrderUpdateRequest, request: Request) -> dict[str, Any]:
    session_user(request)
    order = await db.orders.find_one({"id": body.order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    message = {"placed": "Your campcook order is in!", "preparing": "The kitchen is preparing your campcook order.", "ready": "Your campcook order is ready for pickup.", "completed": "Thanks for ordering from campcook!"}[body.status]
    sent: list[str] = []
    for channel in body.channels:
        if await send_message(body.phone_number, message, channel):
            sent.append(channel)
    if not sent:
        raise HTTPException(status_code=503, detail="Twilio messaging credentials are not configured yet")
    return {"sent": sent, "order_id": body.order_id}


@api_router.post("/twilio/status")
async def twilio_status_callback(request: Request) -> dict[str, bool]:
    await request.form()
    return {"received": True}


app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
async def startup() -> None:
    await seed_menu()


@app.on_event("shutdown")
async def shutdown_db_client() -> None:
    client.close()