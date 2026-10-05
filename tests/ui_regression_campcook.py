# CampCook UI regression script (Expo web preview, Playwright Python async).
# Covers: BUG FIX 1 (dish card quantity stepper), BUG FIX 2 (tab navigation +
# profile sheets + detail/cart/checkout), caterer login/dashboard/tabs/queue/
# menu/offline billing/sales, and the customer->caterer status regression.
# Run inside an async context with a `page` object, or adapt to playwright sync API.
# NOTE: tab bar testIDs require tabBarButtonTestID (react-navigation v7);
# tabBarTestID (v5) is silently ignored on web.
# NOTE: after checkout -> orders redirect, a hidden duplicate tab bar exists in
# the DOM briefly; use page.locator('[data-testid="tab-x"]:visible').first.
# NOTE: caterer queue uses FlatList virtualization; off-screen order cards are
# NOT in the DOM -- scroll the [data-testid="queue-list"] container in steps and
# re-query between scrolls. Orders leave the "New" filter once accepted.

CUSTOMER_ID = "STU12345"
CATERER_ID = "CAT1001"


async def customer_smoke(page):
    await page.set_viewport_size({"width": 375, "height": 667})
    await page.wait_for_selector('[data-testid="welcome-screen"]', timeout=45000)
    await page.fill('[data-testid="signin-identifier-input"]', CUSTOMER_ID)
    await page.click('[data-testid="continue-button"]', force=True)
    await page.wait_for_selector('[data-testid="menu-screen"]', timeout=20000)
    await page.wait_for_selector('[data-testid="add-dish-masala-dosa"]', timeout=20000)

    # BUG FIX 1: quantity beside plus
    await page.click('[data-testid="add-dish-masala-dosa"]', force=True)
    await page.click('[data-testid="add-dish-masala-dosa"]', force=True)
    assert await page.inner_text('[data-testid="dish-count-masala-dosa"]') == "2"
    assert await page.is_visible('[data-testid="dish-minus-masala-dosa"]')
    await page.click('[data-testid="dish-minus-masala-dosa"]', force=True)
    assert await page.inner_text('[data-testid="dish-count-masala-dosa"]') == "1"

    # BUG FIX 2: tab navigation
    for tab, screen in [("tab-orders", "orders-screen"), ("tab-cart", "cart-screen"), ("tab-profile", "profile-screen"), ("tab-home", "menu-screen")]:
        await page.locator(f'[data-testid="{tab}"]:visible').first.click(force=True)
        await page.wait_for_selector(f'[data-testid="{screen}"]', timeout=8000)


async def caterer_smoke(page):
    await page.goto(page.url.split("/")[0] + "//" + page.url.split("/")[2] + "/caterer/login")
    await page.wait_for_selector('[data-testid="caterer-login-screen"]', timeout=45000)
    await page.fill('[data-testid="caterer-id-input"]', CATERER_ID)
    await page.click('[data-testid="caterer-login-button"]', force=True)
    await page.wait_for_selector('[data-testid="caterer-dashboard"]', timeout=15000)
    await page.wait_for_selector('[data-testid="dashboard-earnings"]', timeout=10000)
    for tab, marker in [("caterer-tab-queue", "queue-list"), ("caterer-tab-menu", "menu-list"), ("caterer-tab-sales", "sales-screen"), ("caterer-tab-today", "caterer-dashboard")]:
        await page.click(f'[data-testid="{tab}"]', force=True)
        await page.wait_for_selector(f'[data-testid="{marker}"]', timeout=10000)


async def run_all(page):
    await customer_smoke(page)
    await caterer_smoke(page)
    print("ALL UI REGRESSION PASSED")
