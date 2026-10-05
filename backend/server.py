from datetime import datetime, timedelta, timezone
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


async def create_session(user_id: str) -> str:
    token = f"campcook_{uuid.uuid4().hex}"
    await db.sessions.insert_one({"token": token, "user_id": user_id, "created_at": now_iso()})
    return token


async def session_user(request: Request) -> str:
    token = request.headers.get("x-session-token")
    if not token:
        raise HTTPException(status_code=401, detail="Please sign in to continue")
    session = await db.sessions.find_one({"token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Session expired, please sign in again")
    return session["user_id"]


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
    return {"razorpay_ready": razorpay_ready(), "twilio_otp_ready": twilio_ready(), "twilio_sms_ready": twilio_messaging_ready(), "twilio_whatsapp_ready": twilio_whatsapp_ready(), "google_managed_ready": True}


@api_router.post("/auth/login")
async def login(body: LoginRequest) -> dict[str, Any]:
    identifier = body.identifier.strip()
    user_id = f"campcook_user_{hashlib.sha256(identifier.lower().encode()).hexdigest()[:16]}"
    user = {"id": user_id, "identifier": identifier, "role": body.role, "phone_number": body.phone_number, "name": identifier.split("@")[0].replace(".", " ").title(), "meal_balance": 250, "created_at": now_iso()}
    await db.users.update_one({"id": user_id}, {"$set": user}, upsert=True)
    token = await create_session(user_id)
    return {"token": token, "user": user}


@api_router.get("/auth/google")
async def google_auth_config() -> dict[str, Any]:
    return {"available": True, "url": "https://auth.emergentagent.com"}


@api_router.get("/menu")
async def get_menu() -> list[dict[str, Any]]:
    await seed_menu()
    return await db.menu.find({"available": {"$ne": False}}, {"_id": 0}).sort("popular", -1).to_list(100)


@api_router.get("/orders")
async def get_orders(request: Request) -> list[dict[str, Any]]:
    user_id = await session_user(request)
    return await db.orders.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(50)


@api_router.post("/orders")
async def create_order(body: OrderRequest, request: Request) -> dict[str, Any]:
    user_id = await session_user(request)
    lines, total = await menu_lines(body.items)
    order = {"id": f"CC-{uuid.uuid4().hex[:8].upper()}", "user_id": user_id, "lines": lines, "amount": total, "payment_method": body.payment_method, "status": "placed" if body.payment_method == "cash" else "payment_pending", "created_at": now_iso(), "updated_at": now_iso()}
    await db.orders.insert_one(order.copy())
    return order


@api_router.post("/payments/razorpay/order")
async def create_razorpay_order(body: OrderRequest, request: Request) -> dict[str, Any]:
    if not razorpay_ready():
        raise HTTPException(status_code=503, detail="Razorpay keys are not configured yet")
    user_id = await session_user(request)
    lines, total = await menu_lines(body.items)
    receipt = f"campcook_{uuid.uuid4().hex[:20]}"
    gateway = razorpay.Client(auth=(os.environ["RAZORPAY_KEY_ID"], os.environ["RAZORPAY_KEY_SECRET"]))
    gateway_order = gateway.order.create({"amount": total * 100, "currency": "INR", "receipt": receipt, "payment_capture": 1})
    order = {"id": f"CC-{uuid.uuid4().hex[:8].upper()}", "user_id": user_id, "lines": lines, "amount": total, "payment_method": "razorpay", "razorpay_order_id": gateway_order["id"], "status": "payment_pending", "created_at": now_iso(), "updated_at": now_iso()}
    await db.orders.insert_one(order.copy())
    return {"order_id": order["id"], "razorpay_order_id": gateway_order["id"], "amount": total * 100, "currency": "INR", "key_id": os.environ["RAZORPAY_KEY_ID"]}


@api_router.post("/payments/razorpay/verify")
async def verify_razorpay_payment(body: RazorpayVerifyRequest, request: Request) -> dict[str, str]:
    user_id = await session_user(request)
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
    await session_user(request)
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


class GoogleSessionRequest(BaseModel):
    session_id: str = Field(min_length=8, max_length=200)


@api_router.post("/auth/session")
async def google_session(body: GoogleSessionRequest) -> dict[str, Any]:
    inserted = await db.used_session_ids.update_one({"session_id": body.session_id}, {"$setOnInsert": {"created_at": now_iso()}}, upsert=True)
    if not inserted.upserted_id:
        raise HTTPException(status_code=401, detail="This sign-in link was already used")
    import httpx

    async with httpx.AsyncClient(timeout=15) as http_client:
        response = await http_client.get("https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data", headers={"X-Session-ID": body.session_id})
    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired Google sign-in session")
    data = response.json()
    email = str(data.get("email") or "").lower()
    if not email:
        raise HTTPException(status_code=401, detail="Google account did not return an email")
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    user_id = existing["id"] if existing else f"campcook_google_{uuid.uuid4().hex[:12]}"
    user = {"id": user_id, "identifier": email, "email": email, "role": (existing or {}).get("role", "student"), "name": data.get("name") or email.split("@")[0].replace(".", " ").title(), "picture": data.get("picture"), "meal_balance": (existing or {}).get("meal_balance", 250), "auth_provider": "google", "created_at": now_iso()}
    await db.users.update_one({"id": user_id}, {"$set": user}, upsert=True)
    token = data.get("session_token")
    if not token:
        raise HTTPException(status_code=401, detail="Google sign-in did not return a session token")
    await db.sessions.insert_one({"token": token, "user_id": user_id, "created_at": now_iso(), "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()})
    return {"token": token, "user": user}


@api_router.get("/auth/me")
async def auth_me(request: Request) -> dict[str, Any]:
    user_id = await session_user(request)
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Please sign in to continue")
    return {"user": user}


# ---------------------------------------------------------------------------
# Caterer workspace
# ---------------------------------------------------------------------------

CATERER_SEED = [{"staff_id": "CAT1001", "name": "Head Caterer", "email": "caterer@campcook.in"}]
STATUS_FLOW = {"placed": "accepted", "accepted": "preparing", "preparing": "ready", "ready": "completed"}
ACTIVE_STATUSES = ["placed", "accepted", "preparing", "ready"]
QUEUE_FILTERS = {"new": ["placed"], "prep": ["accepted", "preparing"], "ready": ["ready"], "done": ["completed"], "active": ACTIVE_STATUSES}


class CatererLoginRequest(BaseModel):
    identifier: str = Field(min_length=2, max_length=120)


class StatusUpdateRequest(BaseModel):
    status: Literal["accepted", "preparing", "ready", "completed"]


class MenuItemCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    description: str = Field(default="", max_length=300)
    price: int = Field(ge=1, le=100000)
    category: str = Field(min_length=2, max_length=60)
    popular: bool = False


class MenuItemUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=80)
    description: str | None = Field(default=None, max_length=300)
    price: int | None = Field(default=None, ge=1, le=100000)
    category: str | None = Field(default=None, min_length=2, max_length=60)
    popular: bool | None = None
    available: bool | None = None


class OfflineOrderRequest(BaseModel):
    customer_name: str = Field(min_length=2, max_length=80)
    customer_phone: str = Field(min_length=8, max_length=20)
    items: list[CartLine] = Field(min_length=1)
    payment_method: Literal["cash", "upi", "card"] = "cash"
    payment_status: Literal["paid", "unpaid"] = "paid"
    pickup_time: str | None = Field(default=None, max_length=40)
    notes: str | None = Field(default=None, max_length=300)


async def seed_caterers() -> None:
    for caterer in CATERER_SEED:
        await db.caterers.update_one({"staff_id": caterer["staff_id"]}, {"$set": {**caterer}}, upsert=True)


async def caterer_user(request: Request) -> dict[str, Any]:
    user_id = await session_user(request)
    user = await db.users.find_one({"id": user_id, "role": "caterer"}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=403, detail="Caterer access required")
    return user


async def enrich_orders(docs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    user_ids = [doc.get("user_id") for doc in docs if doc.get("user_id")]
    users = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0}).to_list(len(user_ids)) if user_ids else []
    by_id = {user["id"]: user for user in users}
    results: list[dict[str, Any]] = []
    for doc in docs:
        doc.pop("_id", None)
        doc.setdefault("source", "app")
        owner = by_id.get(doc.get("user_id"), {})
        doc["customer_name"] = doc.get("customer_name") or owner.get("name")
        doc["customer_phone"] = doc.get("customer_phone") or owner.get("phone_number")
        if not doc.get("payment_status"):
            doc["payment_status"] = "paid" if doc.get("payment_id") else ("pay_at_pickup" if doc.get("payment_method") == "cash" else "pending")
        results.append(doc)
    return results


@api_router.post("/caterer/login")
async def caterer_login(body: CatererLoginRequest) -> dict[str, Any]:
    await seed_caterers()
    identifier = body.identifier.strip()
    caterer = await db.caterers.find_one({"$or": [{"staff_id": identifier.upper()}, {"email": identifier.lower()}]}, {"_id": 0})
    if not caterer:
        raise HTTPException(status_code=401, detail="Invalid staff ID or email")
    user_id = f"campcook_caterer_{caterer['staff_id']}"
    user = {"id": user_id, "identifier": caterer["staff_id"], "role": "caterer", "name": caterer["name"], "created_at": now_iso()}
    await db.users.update_one({"id": user_id}, {"$set": user}, upsert=True)
    token = await create_session(user_id)
    return {"token": token, "user": user}


@api_router.get("/caterer/orders")
async def caterer_orders(request: Request, status: str | None = None) -> list[dict[str, Any]]:
    await caterer_user(request)
    query: dict[str, Any] = {}
    if status and status in QUEUE_FILTERS:
        query["status"] = {"$in": QUEUE_FILTERS[status]}
    docs = await db.orders.find(query).sort("created_at", -1).to_list(200)
    return await enrich_orders(docs)


@api_router.get("/caterer/orders/{order_id}")
async def caterer_order_detail(order_id: str, request: Request) -> dict[str, Any]:
    await caterer_user(request)
    doc = await db.orders.find_one({"id": order_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Order not found")
    return (await enrich_orders([doc]))[0]


@api_router.post("/caterer/orders/{order_id}/status")
async def caterer_update_status(order_id: str, body: StatusUpdateRequest, request: Request) -> dict[str, Any]:
    await caterer_user(request)
    doc = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Order not found")
    expected = STATUS_FLOW.get(doc.get("status", ""))
    if expected != body.status:
        raise HTTPException(status_code=400, detail=f"Cannot move order from {doc.get('status')} to {body.status}")
    await db.orders.update_one({"id": order_id}, {"$set": {"status": body.status, "updated_at": now_iso()}})
    return {"id": order_id, "status": body.status}


@api_router.get("/caterer/menu")
async def caterer_menu(request: Request) -> list[dict[str, Any]]:
    await caterer_user(request)
    await seed_menu()
    return await db.menu.find({}, {"_id": 0}).sort("name", 1).to_list(200)


@api_router.post("/caterer/menu")
async def caterer_add_menu_item(body: MenuItemCreate, request: Request) -> dict[str, Any]:
    await caterer_user(request)
    slug = "-".join(part for part in "".join(ch if ch.isalnum() else " " for ch in body.name.lower()).split()) or "dish"
    item_id = slug
    if await db.menu.count_documents({"id": item_id}):
        item_id = f"{slug}-{uuid.uuid4().hex[:4]}"
    item = {"id": item_id, "name": body.name.strip(), "description": body.description.strip(), "price": body.price, "category": body.category.strip(), "icon": "restaurant-outline", "accent": "brandTertiary", "popular": body.popular, "available": True, "created_at": now_iso()}
    await db.menu.insert_one(item.copy())
    return item


@api_router.patch("/caterer/menu/{item_id}")
async def caterer_update_menu_item(item_id: str, body: MenuItemUpdate, request: Request) -> dict[str, Any]:
    await caterer_user(request)
    updates = {key: value for key, value in body.model_dump().items() if value is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")
    result = await db.menu.update_one({"id": item_id}, {"$set": updates})
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="Dish not found")
    return await db.menu.find_one({"id": item_id}, {"_id": 0})


@api_router.get("/caterer/sales")
async def caterer_sales(request: Request, date: str | None = None) -> dict[str, Any]:
    await caterer_user(request)
    day = date or datetime.now(timezone.utc).date().isoformat()
    docs = await db.orders.find({"created_at": {"$regex": f"^{day}"}}, {"_id": 0}).to_list(500)
    billed = [doc for doc in docs if doc.get("status") != "payment_pending"]
    by_payment: dict[str, int] = {}
    by_source: dict[str, int] = {}
    item_totals: dict[str, int] = {}
    status_counts: dict[str, int] = {}
    for doc in docs:
        status_counts[doc.get("status", "placed")] = status_counts.get(doc.get("status", "placed"), 0) + 1
    for doc in billed:
        method = doc.get("payment_method", "cash")
        by_payment[method] = by_payment.get(method, 0) + doc.get("amount", 0)
        source = doc.get("source", "app")
        by_source[source] = by_source.get(source, 0) + doc.get("amount", 0)
        for line in doc.get("lines", []):
            item_totals[line["name"]] = item_totals.get(line["name"], 0) + line.get("quantity", 0)
    top_items = [{"name": name, "quantity": quantity} for name, quantity in sorted(item_totals.items(), key=lambda kv: kv[1], reverse=True)[:5]]
    return {"date": day, "total_revenue": sum(doc.get("amount", 0) for doc in billed), "order_count": len(docs), "completed_count": status_counts.get("completed", 0), "active_count": sum(status_counts.get(s, 0) for s in ACTIVE_STATUSES), "by_payment_method": by_payment, "by_source": by_source, "status_counts": status_counts, "top_items": top_items}


@api_router.post("/caterer/offline-orders")
async def caterer_create_offline_order(body: OfflineOrderRequest, request: Request) -> dict[str, Any]:
    user = await caterer_user(request)
    lines, total = await menu_lines(body.items)
    order = {"id": f"CC-OFF-{uuid.uuid4().hex[:6].upper()}", "user_id": user["id"], "source": "offline", "lines": lines, "amount": total, "payment_method": body.payment_method, "payment_status": body.payment_status, "customer_name": body.customer_name.strip(), "customer_phone": body.customer_phone.strip(), "pickup_time": body.pickup_time, "notes": body.notes, "status": "accepted", "created_at": now_iso(), "updated_at": now_iso()}
    await db.orders.insert_one(order.copy())
    return order


app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
async def startup() -> None:
    await seed_menu()


@app.on_event("shutdown")
async def shutdown_db_client() -> None:
    client.close()