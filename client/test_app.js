const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Navigate to the dashboard
    console.log('Navigating to dashboard...');
    await page.goto('http://localhost:3001/', { waitUntil: 'networkidle' });

    // Take screenshot of dashboard
    console.log('Taking screenshot of dashboard...');
    await page.screenshot({ path: '/private/tmp/claude-501/-Users-zac-burns-Documents-anthropic-basecamp/647a0c55-ac16-47d1-b36a-9c6b9ecf5b31/scratchpad/dashboard.png' });

    // Get page content
    const content = await page.content();
    console.log('Dashboard loaded successfully');
    console.log('Page title:', await page.title());

    // Test navigation - look for main nav tabs
    const navItems = await page.locator('[data-testid*="nav"], .nav, .sidebar a, header a').all();
    console.log('Found navigation items:', navItems.length);

    // Try to find and click on different sections
    const sections = ['inventory', 'orders', 'demand', 'backlog', 'spending', 'reports'];

    for (const section of sections) {
      try {
        // Try to find the link (case-insensitive)
        const selector = `a:has-text("${section.charAt(0).toUpperCase() + section.slice(1)}")`;
        const link = await page.locator(selector).first();

        if (await link.isVisible({ timeout: 1000 }).catch(() => false)) {
          console.log(`\nClicking on ${section}...`);
          await link.click();
          await page.waitForLoadState('networkidle');

          // Take screenshot
          await page.screenshot({
            path: `/private/tmp/claude-501/-Users-zac-burns-Documents-anthropic-basecamp/647a0c55-ac16-47d1-b36a-9c6b9ecf5b31/scratchpad/${section}.png`
          });
          console.log(`✓ ${section} page loaded`);
        }
      } catch (e) {
        console.log(`- ${section} not found or not clickable`);
      }
    }

    // Get all text content to verify pages loaded
    const pageText = await page.textContent('body');
    console.log('\nPage has content:', pageText.length > 0);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
})();
