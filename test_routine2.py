from playwright.sync_api import sync_playwright

def test_routine():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Using ?bypass_login=true per memory
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.goto("http://localhost:3000/?bypass_login=true")

        # Give it a moment to load and render the app
        page.wait_for_timeout(3000)

        page.get_by_role("button", name="Project Planner").click()
        page.wait_for_timeout(3000) # give time for loading

        # Routines
        page.get_by_role("button", name="Routines").click()
        page.wait_for_timeout(2000)

        # We will screenshot the routines tab
        page.screenshot(path="routines2.png")

        browser.close()

if __name__ == "__main__":
    test_routine()
