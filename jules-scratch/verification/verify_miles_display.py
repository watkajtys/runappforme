from playwright.sync_api import sync_playwright, expect
import os

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        path = os.path.abspath('index.html')
        page.goto(f'file://{path}')

        # Click the "Live Run" navigation item
        page.locator('#nav-live-run').click()

        # Wait for the live run view to be visible
        expect(page.locator('#live-run-view')).to_be_visible()

        # Assert that the units are in miles
        expect(page.locator('#live-distance')).to_contain_text("mi")
        expect(page.locator('#live-pace')).to_contain_text("/mi")

        # Take a screenshot
        page.screenshot(path="jules-scratch/verification/verification-miles.png")

        browser.close()

if __name__ == '__main__':
    run_verification()
