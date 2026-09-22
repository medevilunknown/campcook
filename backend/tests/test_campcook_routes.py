import os

import pytest
import requests
from dotenv import dotenv_values


BASE_URL = dotenv_values("/app/frontend/.env")["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")


@pytest.fixture
def api():
    return requests.Session()


def test_root_config_and_menu(api):
    assert api.get(f"{BASE_URL}/api/").json()["message"] == "campcook API is ready"
    config = api.get(f"{BASE_URL}/api/config").json()
    assert config["razorpay_ready"] is False
    assert config["twilio_otp_ready"] is False
    menu = api.get(f"{BASE_URL}/api/menu").json()
    assert any(item["id"] == "masala-dosa" for item in menu)


def test_login_and_cash_order_persists(api):
    login = api.post(f"{BASE_URL}/api/auth/login", json={"identifier": "TEST_STU12345", "role": "student"})
    assert login.status_code == 200
    token = login.json()["token"]
    headers = {"x-session-token": token}
    order = api.post(f"{BASE_URL}/api/orders", headers=headers, json={"items": [{"item_id": "masala-dosa", "quantity": 2}], "payment_method": "cash"})
    assert order.status_code == 200
    created = order.json()
    assert created["status"] == "placed"
    orders = api.get(f"{BASE_URL}/api/orders", headers=headers)
    assert orders.status_code == 200
    assert any(item["id"] == created["id"] and item["amount"] == 160 for item in orders.json())


def test_disabled_integrations_return_clear_responses(api):
    otp = api.post(f"{BASE_URL}/api/twilio/otp/send", json={"phone_number": "+919876543210"})
    assert otp.status_code == 503
    assert "not configured" in otp.json()["detail"]
    razorpay = api.post(f"{BASE_URL}/api/payments/razorpay/order", headers={"x-session-token": "TEST_token"}, json={"items": [{"item_id": "chai", "quantity": 1}], "payment_method": "razorpay"})
    assert razorpay.status_code == 503
    assert "not configured" in razorpay.json()["detail"]
    google = api.get(f"{BASE_URL}/api/auth/google").json()
    assert google["available"] is False


def test_order_update_disabled_after_order(api):
    login = api.post(f"{BASE_URL}/api/auth/login", json={"identifier": "TEST_NOTIFY", "role": "student"}).json()
    headers = {"x-session-token": login["token"]}
    order = api.post(f"{BASE_URL}/api/orders", headers=headers, json={"items": [{"item_id": "chai", "quantity": 1}], "payment_method": "cash"}).json()
    response = api.post(f"{BASE_URL}/api/twilio/order-update", headers=headers, json={"order_id": order["id"], "phone_number": "+919876543210", "status": "placed", "channels": ["sms", "whatsapp"]})
    assert response.status_code == 503
    assert "not configured" in response.json()["detail"]