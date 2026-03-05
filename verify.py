from playwright.sync_api import sync_playwright

def test_app(page):
    page.goto("http://localhost:3000/")

    # Take a screenshot first to see where we are
    page.wait_for_timeout(2000)
    page.screenshot(path="verification_start.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_app(page)
        finally:
            browser.close()