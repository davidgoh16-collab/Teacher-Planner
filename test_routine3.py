from playwright.sync_api import sync_playwright
import traceback

def test_routine():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Using ?bypass_login=true per memory
        page = browser.new_page(viewport={"width": 1280, "height": 800})

        # Output any console errors to help debug
        page.on("console", lambda msg: print(f"Browser console: {msg.text}"))
        page.on("pageerror", lambda exception: print(f"Browser error: {exception}"))

        page.goto("http://localhost:3000/?bypass_login=true")
        page.wait_for_timeout(3000)

        page.get_by_role("button", name="Project Planner").click()
        page.wait_for_timeout(3000) # give time for loading

        browser.close()

if __name__ == "__main__":
    try:
        test_routine()
    except Exception as e:
        traceback.print_exc()
