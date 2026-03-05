from playwright.sync_api import sync_playwright

def verify_app():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        # 1. Start on localhost
        page.goto("http://localhost:3000/")

        # 2. Add an item, maybe navigate to a project to verify the change
        # Wait for the app to load
        page.wait_for_selector('text="Teacher Planner"')

        # Wait a bit
        page.wait_for_timeout(2000)

        # Login as dummy user (app usually auto-logins or we click a button)
        if page.locator('text="Sign In With Google"').count() > 0:
            # We can't really do google auth easily in a headless script.
            # Wait, the app in App.tsx might have a dev bypass or we can just mock the user.
            pass

        # Since it uses Firebase auth, it might be tricky to bypass without mocking.
        # Let's take a screenshot of whatever is there first.
        page.screenshot(path="verification.png")

        browser.close()

if __name__ == "__main__":
    verify_app()