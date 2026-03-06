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

        page.get_by_role("button", name="Project Planner").click()
        page.wait_for_timeout(3000)

        # wait for spinner to disappear
        try:
            page.wait_for_selector(".animate-spin", state="hidden", timeout=5000)
        except:
            print("Spinner didn't disappear")

        page.screenshot(path="before_routines.png")

        page.get_by_role("button", name="Routines").click()
        page.wait_for_timeout(2000)

        page.screenshot(path="routines5.png")

        browser.close()

if __name__ == "__main__":
    test_routine()
