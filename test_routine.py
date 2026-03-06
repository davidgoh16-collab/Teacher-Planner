from playwright.sync_api import sync_playwright

def test_routine():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Using ?bypass_login=true per memory
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.goto("http://localhost:3000/?bypass_login=true")

        # Give it a moment to load and render the app
        page.wait_for_timeout(3000)

        # Take initial screenshot to see where we are
        page.screenshot(path="dashboard.png")

        # Click Routines tab
        # Wait, the app starts at the dashboard. We need to open the Project Planner app.
        page.get_by_role("button", name="Project Planner").click()
        page.wait_for_timeout(1000)

        # Routines
        page.get_by_role("button", name="Routines").click()
        page.wait_for_timeout(1000)

        # We will screenshot the routines tab
        page.screenshot(path="routines.png")

        # Then switch to All Tasks
        page.get_by_role("button", name="All Tasks").click()
        page.wait_for_timeout(1000)
        page.screenshot(path="all_tasks.png")

        # Then switch to Projects and click on a category to see General Tasks
        page.get_by_role("button", name="Projects").click()
        page.wait_for_timeout(1000)
        page.screenshot(path="projects.png")

        browser.close()

if __name__ == "__main__":
    test_routine()
