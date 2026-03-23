import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Observer } from '../observer';
import { chromium, type Browser, type Page } from 'playwright';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Observer', () => {
  let browser: Browser | null = null;
  let page: Page | null = null;
  let observer: Observer | null = null;
  const testRunId = 'test-run-001';
  const testScreenshotDir = '/tmp/observer-test';

  beforeEach(async () => {
    try {
      browser = await chromium.launch({ headless: true });
      page = await browser.newPage();
      observer = new Observer(testRunId, testScreenshotDir);

      // Ensure test directory exists
      await fs.mkdir(testScreenshotDir, { recursive: true });
    } catch (error) {
      console.error('Failed to initialize observer test:', error);
      throw error;
    }
  });

  afterEach(async () => {
    const cleanupTimeout = 5000;
    
    try {
      if (page) {
        await Promise.race([
          page.close(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Page close timeout')), cleanupTimeout))
        ]);
        page = null;
      }
    } catch (error) {
      console.error('Failed to close page:', error);
    }
    
    try {
      if (browser) {
        await Promise.race([
          browser.close(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Browser close timeout')), cleanupTimeout))
        ]);
        browser = null;
      }
    } catch (error) {
      console.error('Failed to close browser:', error);
    }

    // Cleanup test screenshots
    try {
      await fs.rm(testScreenshotDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('initialization', () => {
    it('should create observer with runId and screenshot directory', () => {
      expect(observer).toBeDefined();
      expect(observer.getObservations()).toEqual([]);
    });

    it('should attach to page without errors', async () => {
      await expect(observer.attach(page)).resolves.not.toThrow();
    });
  });

  describe('console error capture', () => {
    it('should capture console errors', async () => {
      if (!observer || !page) throw new Error('Observer or page not initialized');
      
      await observer.attach(page);

      // Use page.evaluate to trigger console error (more reliable than data URL)
      await page.goto('about:blank');

      // Inject and execute code that triggers console.error
      await page.evaluate(() => {
        console.error('Test error message');
      });

      // Wait for observation to be captured with retry
      await page.waitForTimeout(500);

      const observations = observer.getObservations();
      expect(observations.length).toBeGreaterThan(0);

      const consoleError = observations.find((o) => o.eventType === 'console_error');
      expect(consoleError).toBeDefined();
      expect(consoleError?.payload).toHaveProperty('message');
    });
  });

  describe('network failure capture', () => {
    it('should capture 404 responses', async () => {
      if (!observer || !page) throw new Error('Observer or page not initialized');
      
      await observer.attach(page);

      // Serve HTML via route interception so relative URLs resolve
      await page.route('http://test.local/page', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: '<script src="/nonexistent.js"></script>',
        })
      );
      await page.route('**/nonexistent.js', (route) => {
        route.fulfill({
          status: 404,
          body: 'Not found',
        });
      });

      await page.goto('http://test.local/page');
      await page.waitForTimeout(500);

      const observations = observer.getObservations();
      const networkFailure = observations.find((o) => o.eventType === 'network_failure');

      expect(networkFailure).toBeDefined();
      expect(networkFailure?.payload.statusCode).toBe(404);
    });

    it('should capture 500 server errors', async () => {
      if (!observer || !page) throw new Error('Observer or page not initialized');
      
      await observer.attach(page);

      await page.route('http://test.local/page', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: '<script>fetch("/api/error")</script>',
        })
      );
      await page.route('**/api/error', (route) => {
        route.fulfill({
          status: 500,
          body: 'Internal server error',
        });
      });

      await page.goto('http://test.local/page');
      await page.waitForTimeout(1000);

      const observations = observer.getObservations();
      const networkFailure = observations.find(
        (o) => o.eventType === 'network_failure' && o.payload.statusCode === 500
      );

      expect(networkFailure).toBeDefined();
    });
  });

  describe('slow response capture', () => {
    it('should capture slow responses over 3 seconds', async () => {
      if (!observer || !page) throw new Error('Observer or page not initialized');
      
      await observer.attach(page);

      await page.route('http://test.local/page', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: '<script>fetch("/slow-api")</script>',
        })
      );
      // Simulate slow response
      await page.route('**/slow-api', (route) => {
        setTimeout(() => {
          route.fulfill({
            status: 200,
            body: 'OK',
          });
        }, 3500);
      });

      await page.goto('http://test.local/page');
      await page.waitForTimeout(5000);

      const observations = observer.getObservations();
      const slowResponse = observations.find((o) => o.eventType === 'slow_response');

      expect(slowResponse).toBeDefined();
      expect(slowResponse?.payload.duration).toBeGreaterThan(3000);
    }, 15000); // Extended timeout for slow response test
  });

  describe('broken image capture', () => {
    it('should capture broken images (404)', async () => {
      if (!observer || !page) throw new Error('Observer or page not initialized');
      
      await observer.attach(page);

      await page.route('http://test.local/page', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: '<img src="/broken.jpg" />',
        })
      );
      await page.route('**/broken.jpg', (route) => {
        route.fulfill({
          status: 404,
          body: 'Not found',
        });
      });

      await page.goto('http://test.local/page');
      await page.waitForTimeout(500);

      const observations = observer.getObservations();
      const brokenImage = observations.find((o) => o.eventType === 'broken_image');

      expect(brokenImage).toBeDefined();
      expect(brokenImage?.payload.src).toContain('broken.jpg');
    });
  });

  describe('rage click detection', () => {
    it('should detect rage clicks (3+ clicks in 2 seconds)', async () => {
      if (!observer || !page) throw new Error('Observer or page not initialized');
      
      await observer.attach(page);

      await page.goto('about:blank');

      // Simulate rage clicks
      await observer.recordClick(page, 'button#test-btn', 100, 100);
      await observer.recordClick(page, 'button#test-btn', 100, 100);
      await observer.recordClick(page, 'button#test-btn', 100, 100);

      const observations = observer.getObservations();
      const rageClick = observations.find((o) => o.eventType === 'rage_click');

      expect(rageClick).toBeDefined();
      expect(rageClick?.payload.clickCount).toBeGreaterThanOrEqual(3);
      expect(rageClick?.payload.selector).toBe('button#test-btn');
    });

    it('should not detect rage click for spaced out clicks', async () => {
      if (!observer || !page) throw new Error('Observer or page not initialized');
      
      await observer.attach(page);

      await page.goto('about:blank');

      // Clicks spaced more than 2 seconds apart
      await observer.recordClick(page, 'button#test-btn', 100, 100);
      await page.waitForTimeout(2100);
      await observer.recordClick(page, 'button#test-btn', 100, 100);

      const observations = observer.getObservations();
      const rageClick = observations.find((o) => o.eventType === 'rage_click');

      expect(rageClick).toBeUndefined();
    });
  });

  describe('stuck loader detection', () => {
    it('should record stuck loader', async () => {
      if (!observer || !page) throw new Error('Observer or page not initialized');

      await observer.attach(page);

      await page.goto('about:blank');

      await observer.recordStuckLoader(page, '.loading', 5000);

      const observations = observer.getObservations();
      const stuckLoader = observations.find((o) => o.eventType === 'stuck_loader');

      expect(stuckLoader).toBeDefined();
      expect(stuckLoader?.payload.selector).toBe('.loading');
      expect(stuckLoader?.payload.visibleDuration).toBe(5000);
    }, 15000); // Extended timeout for screenshot operations
  });

  describe('screenshot capture', () => {
    it('should capture screenshots for error events', async () => {
      if (!observer || !page) throw new Error('Observer or page not initialized');

      await observer.attach(page);

      await page.goto('about:blank');
      await page.evaluate(() => {
        console.error('Test error for screenshot');
      });
      await page.waitForTimeout(500);

      const observations = observer.getObservations();
      const errorObs = observations.find((o) => o.eventType === 'console_error');

      expect(errorObs).toBeDefined();
      if (errorObs?.screenshotPath) {
        expect(errorObs.screenshotPath).toContain('.png');

        // Verify screenshot file exists
        const exists = await fs
          .access(errorObs.screenshotPath)
          .then(() => true)
          .catch(() => false);
        expect(exists).toBe(true);
      }
    }, 15000); // Extended timeout for screenshot operations
  });

  describe('observation tracking', () => {
    it('should return all captured observations', async () => {
      if (!observer || !page) throw new Error('Observer or page not initialized');
      
      await observer.attach(page);

      // Navigate to blank page and trigger console error via evaluate
      await page.goto('about:blank');
      await page.evaluate(() => {
        console.error('Error 1');
      });
      await page.waitForTimeout(500);

      const observations = observer.getObservations();
      expect(observations.length).toBeGreaterThan(0);
      expect(Array.isArray(observations)).toBe(true);
    });

    it('should provide observation counts by type', async () => {
      if (!observer || !page) throw new Error('Observer or page not initialized');
      
      await observer.attach(page);

      await page.goto('about:blank');
      await page.evaluate(() => {
        console.error('Test');
      });
      await page.waitForTimeout(500);

      const counts = observer.getObservationCounts();
      expect(counts).toHaveProperty('console_error');
      expect(counts.console_error).toBeGreaterThan(0);
    });

    it('should generate unique observation IDs', async () => {
      if (!observer || !page) throw new Error('Observer or page not initialized');
      
      await observer.attach(page);

      await page.goto('about:blank');
      await page.evaluate(() => {
        console.error('E1');
        console.error('E2');
      });
      await page.waitForTimeout(500);

      const observations = observer.getObservations();
      const ids = observations.map((o) => o.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length); // All IDs should be unique
    });
  });
});
