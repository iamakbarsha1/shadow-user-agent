import { chromium, type Browser, type BrowserContext, type Page, type Locator } from 'playwright';
import type { PersonaConfig } from '../types/persona';
import type { SessionLog } from '../types/observation';
import { Observer } from './observer';
import { FormFiller } from './formFiller';
import { logger } from '../utils/logger';
import * as path from 'path';

/**
 * Browser Agent
 *
 * Autonomous Playwright session that navigates a web application using
 * a persona-driven strategy. Discovers interactive elements, clicks them,
 * fills forms, and continues until maxSteps is reached.
 */

interface BrowserAgentOptions {
  runId: string;
  targetUrl: string;
  persona: PersonaConfig;
  screenshotDir?: string;
}

export class BrowserAgent {
  private runId: string;
  private targetUrl: string;
  private persona: PersonaConfig;
  private screenshotDir: string;
  private observer: Observer;
  private formFiller: FormFiller;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private stepsExecuted = 0;
  private visitedUrls = new Set<string>();

  constructor(options: BrowserAgentOptions) {
    this.runId = options.runId;
    this.targetUrl = options.targetUrl;
    this.persona = options.persona;
    this.screenshotDir =
      options.screenshotDir ||
      path.join(process.env.SCREENSHOT_STORAGE_PATH || '/tmp/agent-sessions', this.runId);

    this.observer = new Observer(this.runId, this.screenshotDir);
    this.formFiller = new FormFiller(this.persona.formFillStrategy);
  }

  /**
   * Starts the browser agent and executes the autonomous navigation
   */
  async run(): Promise<SessionLog> {
    const startTime = new Date().toISOString();

    try {
      logger.info(
        {
          runId: this.runId,
          targetUrl: this.targetUrl,
          personaId: this.persona.id,
        },
        'Starting browser agent'
      );

      await this.initialize();
      await this.navigate();

      const endTime = new Date().toISOString();

      const sessionLog: SessionLog = {
        runId: this.runId,
        url: this.targetUrl,
        personaId: this.persona.id,
        startTime,
        endTime,
        observations: this.observer.getObservations(),
        screenshotPaths: this.observer
          .getObservations()
          .map((o) => o.screenshotPath)
          .filter((p): p is string => !!p),
        totalSteps: this.stepsExecuted,
        status: 'complete',
      };

      logger.info(
        {
          runId: this.runId,
          totalSteps: this.stepsExecuted,
          observationCount: sessionLog.observations.length,
        },
        'Browser agent completed successfully'
      );

      return sessionLog;
    } catch (error) {
      logger.error({ error, runId: this.runId }, 'Browser agent failed');

      const endTime = new Date().toISOString();

      return {
        runId: this.runId,
        url: this.targetUrl,
        personaId: this.persona.id,
        startTime,
        endTime,
        observations: this.observer.getObservations(),
        screenshotPaths: [],
        totalSteps: this.stepsExecuted,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Initializes the browser, context, and page with persona configuration
   */
  private async initialize(): Promise<void> {
    // Launch browser
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    // Create context with persona viewport and user agent
    this.context = await this.browser.newContext({
      viewport: {
        width: this.persona.viewportWidth,
        height: this.persona.viewportHeight,
      },
      userAgent: this.persona.userAgentOverride,
    });

    // Set up network interception to block off-origin requests
    await this.context.route('**/*', (route) => {
      const requestUrl = new URL(route.request().url());
      const targetOrigin = new URL(this.targetUrl).origin;

      // Allow same-origin requests and common CDNs
      if (
        requestUrl.origin === targetOrigin ||
        this.isAllowedExternalResource(requestUrl.hostname)
      ) {
        void route.continue();
      } else {
        logger.debug(
          { blocked: requestUrl.href, runId: this.runId },
          'Blocked off-origin request'
        );
        void route.abort();
      }
    });

    // Create page
    this.page = await this.context.newPage();

    // Attach observer
    await this.observer.attach(this.page);

    logger.info(
      {
        runId: this.runId,
        viewport: `${this.persona.viewportWidth}x${this.persona.viewportHeight}`,
        userAgent: this.persona.userAgentOverride || 'default',
      },
      'Browser initialized'
    );
  }

  /**
   * Checks if a hostname is an allowed external resource (CDNs, etc.)
   */
  private isAllowedExternalResource(hostname: string): boolean {
    const allowedPatterns = [
      'googleapis.com',
      'gstatic.com',
      'cloudflare.com',
      'jsdelivr.net',
      'unpkg.com',
      'cdnjs.cloudflare.com',
    ];

    return allowedPatterns.some((pattern) => hostname.includes(pattern));
  }

  /**
   * Main navigation loop
   */
  private async navigate(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    // Navigate to target URL
    await this.page.goto(this.targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
    this.visitedUrls.add(this.page.url());

    logger.info({ runId: this.runId, url: this.page.url() }, 'Navigated to target URL');

    // Navigation loop
    while (this.stepsExecuted < this.persona.maxSteps) {
      try {
        // Apply navigation speed delay
        await this.applyNavigationDelay();

        // Try to fill forms
        const filledForms = await this.formFiller.fillFormsOnPage(this.page);
        if (filledForms > 0) {
          logger.debug({ runId: this.runId, filledForms }, 'Filled forms on page');
          this.stepsExecuted++;
          continue;
        }

        // Discover and click interactive elements
        const clicked = await this.discoverAndClick();

        if (!clicked) {
          logger.info(
            { runId: this.runId, stepsExecuted: this.stepsExecuted },
            'No more interactive elements found'
          );
          break;
        }

        this.stepsExecuted++;

        // Check for stuck loaders
        await this.checkForStuckLoaders();
      } catch (error) {
        logger.warn({ error, runId: this.runId }, 'Step execution failed');

        // Error tolerance handling
        if (this.persona.errorTolerance === 'abort') {
          logger.info({ runId: this.runId }, 'Aborting due to error (persona: abort)');
          break;
        } else if (this.persona.errorTolerance === 'retry') {
          // Retry once
          await this.applyNavigationDelay();
          continue;
        }
        // 'continue': keep going
      }
    }

    logger.info(
      {
        runId: this.runId,
        stepsExecuted: this.stepsExecuted,
        maxSteps: this.persona.maxSteps,
      },
      'Navigation loop completed'
    );
  }

  /**
   * Discovers interactive elements and clicks the most prominent one
   */
  private async discoverAndClick(): Promise<boolean> {
    if (!this.page) return false;

    // Discover clickable elements
    const interactiveSelectors = [
      'button:visible',
      'a:visible',
      'input[type="submit"]:visible',
      'input[type="button"]:visible',
      '[role="button"]:visible',
      '[onclick]:visible',
    ];

    for (const selector of interactiveSelectors) {
      const elements = await this.page.locator(selector).all();

      for (const element of elements) {
        try {
          const isVisible = await element.isVisible();
          const isEnabled = await element.isEnabled();

          if (!isVisible || !isEnabled) continue;

          // Get element position for rage click tracking
          const box = await element.boundingBox();
          if (!box) continue;

          const centerX = box.x + box.width / 2;
          const centerY = box.y + box.height / 2;

          // Get selector for tracking
          const elementSelector = await this.getElementSelector(element);

          // Track click for rage click detection
          await this.observer.recordClick(this.page, elementSelector, centerX, centerY);

          // Click the element
          await element.click({ timeout: 5000 });

          logger.debug(
            { runId: this.runId, selector: elementSelector },
            'Clicked interactive element'
          );

          // Wait for navigation or network idle
          await this.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

          return true;
        } catch {
          // Element not clickable, try next one
          continue;
        }
      }
    }

    return false;
  }

  /**
   * Gets a selector string for an element
   */
  private async getElementSelector(element: Locator): Promise<string> {
    try {
      const tagName = await element.evaluate((el: { tagName: string }) => el.tagName.toLowerCase());
      const id = await element.getAttribute('id');
      const className = await element.getAttribute('class');

      if (id) return `${tagName}#${id}`;
      if (className) return `${tagName}.${className.split(' ')[0]}`;
      return tagName;
    } catch {
      return 'unknown';
    }
  }

  /**
   * Checks for stuck loaders (spinners visible > 5s)
   */
  private async checkForStuckLoaders(): Promise<void> {
    if (!this.page) return;

    const loaderSelectors = [
      '[class*="loading"]:visible',
      '[class*="spinner"]:visible',
      '[aria-busy="true"]:visible',
    ];

    for (const selector of loaderSelectors) {
      try {
        const loader = this.page.locator(selector).first();
        const isVisible = await loader.isVisible({ timeout: 1000 }).catch(() => false);

        if (isVisible) {
          // Wait 5 seconds to see if it's stuck
          await this.page.waitForTimeout(5000);
          const stillVisible = await loader.isVisible().catch(() => false);

          if (stillVisible) {
            await this.observer.recordStuckLoader(this.page, selector, 5000);
          }
        }
      } catch {
        // No loader found, continue
      }
    }
  }

  /**
   * Applies navigation delay based on persona speed
   */
  private async applyNavigationDelay(): Promise<void> {
    const delays = {
      slow: 2000, // 2 seconds
      normal: 1000, // 1 second
      fast: 500, // 0.5 seconds
    };

    const delay = delays[this.persona.navigationSpeed];
    await this.page?.waitForTimeout(delay);
  }

  /**
   * Cleans up browser resources
   */
  private async cleanup(): Promise<void> {
    try {
      if (this.page) await this.page.close();
      if (this.context) await this.context.close();
      if (this.browser) await this.browser.close();

      logger.info({ runId: this.runId }, 'Browser cleanup completed');
    } catch (error) {
      logger.error({ error, runId: this.runId }, 'Browser cleanup failed');
    }
  }
}
