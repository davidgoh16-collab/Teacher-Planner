from playwright.sync_api import sync_playwright
import traceback

def test_routine():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Using ?bypass_login=true per memory
        page = browser.new_page(viewport={"width": 1280, "height": 800})

        # Output any console errors to help debug
        page.on("console", lambda msg: print(f"Browser console: {msg.text}"))

        page.goto("http://localhost:3000/?bypass_login=true")

        # Start at project planner
        page.get_by_role("button", name="Project Planner").click()
        page.wait_for_timeout(1000)

        # wait for spinner to disappear
        try:
            page.wait_for_selector(".animate-spin", state="hidden", timeout=5000)
        except:
            pass

        # Switch to Routines
        page.get_by_role("button", name="Routines").click()
        page.wait_for_timeout(1000)

        # Add a test routine task
        # Note: Bypass login implies isReadOnly is true in some parts but maybe not all? Actually wait...
        # "View Only" is in the header, so the app might disable "Add" buttons if it reads bypass_login.
        # But wait! In routines.png, the "Add" button is visible and active!
        # The form has placeholder "E.g., Check emails..."

        try:
            page.fill("input[placeholder='E.g., Check emails, Plan tomorrow\\'s lesson...']", "Drink water")
            page.click("button:has-text('Add')")
            page.wait_for_timeout(500)

            # Click it to complete
            page.locator("button.shrink-0.transition-transform").first.click()
            page.wait_for_timeout(500)

        except Exception as e:
            print("Could not add or interact:", e)

        page.screenshot(path="routines6.png")

        browser.close()

if __name__ == "__main__":
    test_routine()
