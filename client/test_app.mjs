import { chromium } from 'playwright';
import fs from 'fs';

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
    console.log('✓ Dashboard screenshot saved');

    // Get page content and title
    const title = await page.title();
    const content = await page.content();
    console.log('Page title:', title);
    console.log('Dashboard content loaded successfully');

    // Get all text content to verify data is visible
    const pageText = await page.textContent('body');
    console.log('Page has substantial content:', pageText.length > 500 ? 'Yes' : 'No');

    // Look for navigation elements
    console.log('\n--- Navigation Testing ---');
    const navItems = await page.locator('nav a, .sidebar a, header a').all();
    console.log('Navigation elements found:', navItems.length);

    // Try to find links by text content
    const sections = [
      { name: 'Inventory', text: 'Inventory' },
      { name: 'Orders', text: 'Orders' },
      { name: 'Demand', text: 'Demand' },
      { name: 'Backlog', text: 'Backlog' },
      { name: 'Spending', text: 'Spending' },
      { name: 'Reports', text: 'Reports' }
    ];

    for (const section of sections) {
      try {
        // Find link containing the section text
        const selector = `a, button`;
        const links = await page.locator(selector).all();

        let found = false;
        for (const link of links) {
          const text = await link.textContent();
          if (text && text.toLowerCase().includes(section.text.toLowerCase())) {
            const isVisible = await link.isVisible({ timeout: 500 }).catch(() => false);
            if (isVisible) {
              console.log(`\n✓ Found ${section.name} link`);
              console.log(`  Clicking ${section.name}...`);
              await link.click();
              await page.waitForLoadState('networkidle').catch(() => {});
              await page.waitForTimeout(500);

              // Take screenshot
              const screenshotPath = `/private/tmp/claude-501/-Users-zac-burns-Documents-anthropic-basecamp/647a0c55-ac16-47d1-b36a-9c6b9ecf5b31/scratchpad/${section.name.toLowerCase()}.png`;
              await page.screenshot({ path: screenshotPath });
              console.log(`  ✓ ${section.name} page screenshot saved`);

              found = true;
              break;
            }
          }
        }
        if (!found) {
          console.log(`- ${section.name} link not found in navigation`);
        }
      } catch (e) {
        console.log(`- ${section.name}: ${e.message.split('\n')[0]}`);
      }
    }

    console.log('\n--- Dashboard Verification ---');
    // Check for common dashboard elements
    const dashboardElements = [
      { name: 'Total Inventory Value', selector: 'text=/Total.*Value|Inventory.*Value/' },
      { name: 'Low Stock Items', selector: 'text=/Low.*Stock|Stock.*Items/' },
      { name: 'Pending Orders', selector: 'text=/Pending.*Orders|Orders.*Pending/' }
    ];

    for (const elem of dashboardElements) {
      const found = await page.locator(elem.selector).first().isVisible({ timeout: 1000 }).catch(() => false);
      console.log(`${found ? '✓' : '○'} ${elem.name}`);
    }

  } catch (error) {
    console.error('Error during test:', error.message);
  } finally {
    await browser.close();
    console.log('\n--- Test Complete ---');
  }
})();
