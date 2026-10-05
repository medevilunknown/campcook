import pytest
import requests
from dotenv import dotenv_values


BASE_URL = dotenv_values("/app/frontend/.env")["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")


@pytest.fixture
def api():
    return requests.Session()


def caterer_headers(api):
    login = api.post(f"{BASE_URL}/api/caterer/login", json={"identifier": "CAT1001"})
    assert login.status_code == 200
    assert login.json()["user"]["role"] == "caterer"
    return {"x-session-token": login.json()["token"]}


def test_caterer_login_validation(api):
    bad = api.post(f"{BASE_URL}/api/caterer/login", json={"identifier": "NOPE999"})
    assert bad.status_code == 401
    ok = api.post(f"{BASE_URL}/api/caterer/login", json={"identifier": "caterer@campcook.in"})
    assert ok.status_code == 200


def test_caterer_routes_require_caterer_role(api):
    assert api.get(f"{BASE_URL}/api/caterer/orders").status_code == 401
    customer = api.post(f"{BASE_URL}/api/auth/login", json={"identifier": "TEST_STU_GUARD", "role": "student"}).json()
    guarded = api.get(f"{BASE_URL}/api/caterer/orders", headers={"x-session-token": customer["token"]})
    assert guarded.status_code == 403


def test_customer_order_flows_through_queue(api):
    headers = caterer_headers(api)
    customer = api.post(f"{BASE_URL}/api/auth/login", json={"identifier": "TEST_QUEUE", "role": "student"}).json()
    order = api.post(f"{BASE_URL}/api/orders", headers={"x-session-token": customer["token"]}, json={"items": [{"item_id": "chai", "quantity": 1}], "payment_method": "cash"}).json()

    queue = api.get(f"{BASE_URL}/api/caterer/orders?status=new", headers=headers)
    assert queue.status_code == 200
    assert any(item["id"] == order["id"] for item in queue.json())

    assert api.post(f"{BASE_URL}/api/caterer/orders/{order['id']}/status", headers=headers, json={"status": "ready"}).status_code == 400
    for status in ["accepted", "preparing", "ready", "completed"]:
        response = api.post(f"{BASE_URL}/api/caterer/orders/{order['id']}/status", headers=headers, json={"status": status})
        assert response.status_code == 200
        assert response.json()["status"] == status

    detail = api.get(f"{BASE_URL}/api/caterer/orders/{order['id']}", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["status"] == "completed"
    done = api.get(f"{BASE_URL}/api/caterer/orders?status=done", headers=headers)
    assert any(item["id"] == order["id"] for item in done.json())


def test_offline_billing_persists_and_counts_in_sales(api):
    headers = caterer_headers(api)
    bill = api.post(
        f"{BASE_URL}/api/caterer/offline-orders",
        headers=headers,
        json={"customer_name": "Walk In", "customer_phone": "+919800012345", "items": [{"item_id": "veg-thali", "quantity": 2}], "payment_method": "upi", "payment_status": "paid", "pickup_time": "12:30 PM", "notes": "Less spicy"},
    )
    assert bill.status_code == 200
    created = bill.json()
    assert created["source"] == "offline"
    assert created["status"] == "accepted"
    assert created["amount"] == 240

    detail = api.get(f"{BASE_URL}/api/caterer/orders/{created['id']}", headers=headers).json()
    assert detail["customer_name"] == "Walk In"
    assert detail["notes"] == "Less spicy"

    sales = api.get(f"{BASE_URL}/api/caterer/sales", headers=headers)
    assert sales.status_code == 200
    summary = sales.json()
    assert summary["total_revenue"] >= 240
    assert summary["by_payment_method"].get("upi", 0) >= 240
    assert summary["by_source"].get("offline", 0) >= 240


def test_menu_management(api):
    headers = caterer_headers(api)
    created = api.post(f"{BASE_URL}/api/caterer/menu", headers=headers, json={"name": "Test Lemon Rice", "price": 60, "category": "South Indian", "description": "Zesty test dish"}).json()
    item_id = created["id"]
    assert created["available"] is True
    assert any(item["id"] == item_id for item in api.get(f"{BASE_URL}/api/menu").json())

    updated = api.patch(f"{BASE_URL}/api/caterer/menu/{item_id}", headers=headers, json={"price": 65})
    assert updated.status_code == 200
    assert updated.json()["price"] == 65

    hidden = api.patch(f"{BASE_URL}/api/caterer/menu/{item_id}", headers=headers, json={"available": False})
    assert hidden.status_code == 200
    assert not any(item["id"] == item_id for item in api.get(f"{BASE_URL}/api/menu").json())
    full = api.get(f"{BASE_URL}/api/caterer/menu", headers=headers)
    assert any(item["id"] == item_id for item in full.json())

    # Leave the test dish unavailable so it never shows on the customer menu.
    api.patch(f"{BASE_URL}/api/caterer/menu/{item_id}", headers=headers, json={"available": False})
    assert not any(item["id"] == item_id for item in api.get(f"{BASE_URL}/api/menu").json())
    assert api.patch(f"{BASE_URL}/api/caterer/menu/missing-dish", headers=headers, json={"price": 10}).status_code == 404
