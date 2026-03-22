import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Observer } from '../observer';
import { chromium, type Browser, type Page } from 'playwright';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Observer', () => {
  let browser: Browser;
  let page: Page;
  let observer: Observer;
  const testRunId = 'test-run-001';
  const testScreenshotDir = '/tmp/observer-test';

  beforeEach(async () => {
    browser = await chromium.launch();
    page = await browser.newPage();
    observer = new Observer(testRunId, testScreenshotDir);

    // Ensure test directory exists
    await fs.mkdir(testScreenshotDir, { recursive: true });
  });

  afterEach(async () => {
    await page.close();
    await browser.close();

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
      await observer.attach(page);

      // Navigate to page and trigger console error
      await page.goto('data:text/html,<script>console.error("Test error")</script>');

      // Wait for observation
      await page.waitForTimeout(100);

      const observations = observer.getObservations();
      expect(observations.length).toBeGreaterThan(0);

      const consoleError = observations.find((o) => o.eventType === 'console_error');
      expect(consoleError).toBeDefined();
      expect(consoleError?.payload).toHaveProperty('message');
    });
  });

  describe('network failure capture', () => {
    it('should capture 404 responses', async () => {
      await observer.attach(page);

      // Block all requests to simulate 404
      await page.route('**/nonexistent.js', (route) => {
        route.fulfill({
          status: 404,
          body: 'Not found',
        });
      });

      await page.goto('data:text/html,<script src="/nonexistent.js"></script>');
      await page.waitForTimeout(500);

      const observations = observer.getObservations();
      const networkFailure = observations.find((o) => o.eventType === 'network_failure');

      expect(networkFailure).toBeDefined();
      expect(networkFailure?.payload.statusCode).toBe(404);
    });

    it('should capture 500 server errors', async () => {
      await observer.attach(page);

      await page.route('**/api/error', (route) => {
        route.fulfill({
          status: 500,
          body: 'Internal server error',
        });
      });

      await page.goto('data:text/html,<script>fetch("/api/error")</script>');
      await page.waitForTimeout(500);

      const observations = observer.getObservations();
      const networkFailure = observations.find(
        (o) => o.eventType === 'network_failure' && o.payload.statusCode === 500
      );

      expect(networkFailure).toBeDefined();
    });
  });

  describe('slow response capture', () => {
    it('should capture slow responses over 3 seconds', async () => {
      await observer.attach(page);

      // Simulate slow response
      await page.route('**/slow-api', (route) => {
        setTimeout(() => {
          route.fulfill({
            status: 200,
            body: 'OK',
          });
        }, 3500);
      });

      await page.goto('data:text/html,<script>fetch("/slow-api")</script>');
      await page.waitForTimeout(4000);

      const observations = observer.getObservations();
      const slowResponse = observations.find((o) => o.eventType === 'slow_response');

      expect(slowResponse).toBeDefined();
      expect(slowResponse?.payload.duration).toBeGreaterThan(3000);
    });
  });

  describe('broken image capture', () => {
    it('should capture broken images (404)', async () => {
      await observer.attach(page);

      await page.route('**/broken.jpg', (route) => {
        route.fulfill({
          status: 404,
          body: 'Not found',
        });
      });

      await page.goto('data:text/html,<img src="/broken.jpg" />');
      await page.waitForTimeout(500);

      const observations = observer.getObservations();
      const brokenImage = observations.find((o) => o.eventType === 'broken_image');

      expect(brokenImage).toBeDefined();
      expect(brokenImage?.payload.src).toContain('broken.jpg');
    });
  });

  describe('rage click detection', () => {
    it('should detect rage clicks (3+ clicks in 2 seconds)', async () => {
      await observer.attach(page);

      await page.goto('data:text/html,<button id="test-btn">Click me</button>');
      const button = page.locator('#test-btn');

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
      await observer.attach(page);

      await page.goto('data:text/html,<button id="test-btn">Click me</button>');

      // Clicks spaced more than 2 seconds apart
      await observer.recordClick(page, 'button#test-btn', 100, 100);
      await page.waitForTimeout(2500);
      await observer.recordClick(page, 'button#test-btn', 100, 100);

      const observations = observer.getObservations();
      const rageClick = observations.find((o) => o.eventType === 'rage_click');

      expect(rageClick).toBeUndefined();
    });
  });

  describe('stuck loader detection', () => {
    it('should record stuck loader', async () => {
      await observer.attach(page);

      await page.goto('data:text/html,<div class="loading">Loading...</div>');

      await observer.recordStuckLoader(page, '.loading', 5000);

      const observations = observer.getObservations();
      const stuckLoader = observations.find((o) => o.eventType === 'stuck_loader');

      expect(stuckLoader).toBeDefined();
      expect(stuckLoader?.payload.selector).toBe('.loading');
      expect(stuckLoader?.payload.visibleDuration).toBe(5000);
    });
  });

  describe('screenshot capture', () => {
    it('should capture screenshots for error events', async () => {
      await observer.attach(page);

      await page.goto('data:text/html,<script>console.error("Test")</script>');
      await page.waitForTimeout(200);

      const observations = observer.getObservations();
      const errorObs = observations.find((o) => o.eventType === 'console_error');

      expect(errorObs?.screenshotPath).toBeDefined();
      expect(errorObs?.screenshotPath).toContain('.png');

      // Verify screenshot file exists
      if (errorObs?.screenshotPath) {
        const exists = await fs
          .access(errorObs.screenshotPath)
          .then(() => true)
          .catch(() => false);
        expect(exists).toBe(true);
      }
    });
  });

  describe('observation tracking', () => {
    it('should return all captured observations', async () => {
      await observer.attach(page);

      // Trigger multiple events
      await page.goto('data:text/html,<script>console.error("Error 1")</script>');
      await page.waitForTimeout(100);

      const observations = observer.getObservations();
      expect(observations.length).toBeGreaterThan(0);
      expect(Array.isArray(observations)).toBe(true);
    });

    it('should provide observation counts by type', async () => {
      await observer.attach(page);

      await page.goto('data:text/html,<script>console.error("Test")</script>');
      await page.waitForTimeout(200);

      const counts = observer.getObservationCounts();
      expect(counts).toHaveProperty('console_error');
      expect(counts.console_error).toBeGreaterThan(0);
    });

    it('should generate unique observation IDs', async () => {
      await observer.attach(page);

      await page.goto(
        'data:text/html,<script>console.error("E1"); console.error("E2");</script>'
      );
      await page.waitForTimeout(200);

      const observations = observer.getObservations();
      const ids = observations.map((o) => o.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length); // All IDs should be unique
    });
  });
});
