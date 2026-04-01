from playwright.sync_api import sync_playwright
import time

def verify_flicker():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 800})

        # We need to test the UI functionality, so bypass auth
        page.goto("http://localhost:3000/?bypass_login=true")

        # Wait for the "Loading your planner..." to disappear.
        page.wait_for_selector('text="Loading your planner..."', state='hidden', timeout=15000)

        # Wait a bit to ensure no infinite loop crash and wait for grid
        page.wait_for_selector('.min-h-\\[140px\\]', timeout=10000)
        time.sleep(3)

        page.screenshot(path="verification/flicker_fixed.png")
        print("Done capturing flicker fix output.")

        browser.close()

if __name__ == "__main__":
    verify_flicker()
