import type { Page } from 'playwright';
import type { Observation } from '../types/observation';
import { logger } from '../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Observer
 *
 * Passive monitoring layer that captures browser events during agent runs.
 * Captures 7 event types: console errors, network failures, slow responses,
 * layout shifts, rage clicks, broken images, and stuck loaders.
 */

export class Observer {
  private observations: Observation[] = [];
  private screenshotDir: string;
  private runId: string;
  private clickTracker = new Map<string, { times: number[]; count: number }>();
  private requestTimes = new Map<string, number>();

  constructor(runId: string, screenshotDir: string) {
    this.runId = runId;
    this.screenshotDir = screenshotDir;
  }

  /**
   * Attaches all event listeners to the Playwright page
   */
  async attach(page: Page): Promise<void> {
    logger.info({ runId: this.runId }, 'Attaching observer to page');

    // Ensure screenshot directory exists
    await fs.mkdir(this.screenshotDir, { recursive: true });

    // 1. Console errors
    page.on('console', async (msg) => {
      if (msg.type() === 'error') {
        const observation = await this.recordConsoleError(page, msg.text(), msg.location().url);
        logger.warn({ runId: this.runId, observation }, 'Console error captured');
      }
    });

    // 2. Page errors (uncaught exceptions)
    page.on('pageerror', async (error) => {
      const observation = await this.recordConsoleError(
        page,
        error.message,
        page.url(),
        error.stack
      );
      logger.warn({ runId: this.runId, observation }, 'Page error captured');
    });

    // 3. Network failures and slow responses
    page.on('response', async (response) => {
      const url = response.url();
      const requestId = `${response.request().method()}-${url}`;
      const startTime = this.requestTimes.get(requestId) || Date.now();
      const duration = Date.now() - startTime;

      // Network failure (status >= 400)
      if (response.status() >= 400) {
        const observation = await this.recordNetworkFailure(
          page,
          url,
          response.status(),
          duration,
          response.request().method()
        );
        logger.warn({ runId: this.runId, observation }, 'Network failure captured');
      }

      // Slow response (> 3000ms)
      if (duration > 3000) {
        const observation = this.recordSlowResponse(
          url,
          duration,
          response.request().method()
        );
        logger.warn({ runId: this.runId, observation }, 'Slow response captured');
      }

      this.requestTimes.delete(requestId);
    });

    // Track request start times
    page.on('request', (request) => {
      const requestId = `${request.method()}-${request.url()}`;
      this.requestTimes.set(requestId, Date.now());
    });

    // 4. Broken images
    page.on('response', async (response) => {
      if (
        response.request().resourceType() === 'image' &&
        (response.status() === 404 || response.status() >= 400)
      ) {
        const observation = await this.recordBrokenImage(page, response.url());
        logger.warn({ runId: this.runId, observation }, 'Broken image captured');
      }
    });

    logger.info({ runId: this.runId }, 'Observer attached successfully');
  }

  /**
   * Records a console error observation
   */
  private async recordConsoleError(
    page: Page,
    message: string,
    url: string,
    stack?: string
  ): Promise<Observation> {
    const screenshotPath = await this.captureScreenshot(page, 'console_error');

    const observation: Observation = {
      id: this.generateObservationId(),
      eventType: 'console_error',
      timestamp: new Date().toISOString(),
      payload: {
        message,
        stack,
        url,
      },
      screenshotPath,
    };

    this.observations.push(observation);
    return observation;
  }

  /**
   * Records a network failure observation
   */
  private async recordNetworkFailure(
    page: Page,
    url: string,
    statusCode: number,
    responseTime: number,
    method: string
  ): Promise<Observation> {
    const screenshotPath = await this.captureScreenshot(page, 'network_failure');

    const observation: Observation = {
      id: this.generateObservationId(),
      eventType: 'network_failure',
      timestamp: new Date().toISOString(),
      payload: {
        url,
        statusCode,
        responseTime,
        method,
      },
      screenshotPath,
    };

    this.observations.push(observation);
    return observation;
  }

  /**
   * Records a slow response observation
   */
  private recordSlowResponse(url: string, duration: number, method: string): Observation {
    const observation: Observation = {
      id: this.generateObservationId(),
      eventType: 'slow_response',
      timestamp: new Date().toISOString(),
      payload: {
        url,
        duration,
        method,
      },
    };

    this.observations.push(observation);
    return observation;
  }

  /**
   * Records a layout shift observation
   */
  async recordLayoutShift(
    page: Page,
    selector: string,
    clsScore: number
  ): Promise<Observation> {
    const screenshotPath = await this.captureScreenshot(page, 'layout_shift');

    const observation: Observation = {
      id: this.generateObservationId(),
      eventType: 'layout_shift',
      timestamp: new Date().toISOString(),
      payload: {
        selector,
        clsScore,
      },
      screenshotPath,
    };

    this.observations.push(observation);
    return observation;
  }

  /**
   * Tracks clicks and detects rage clicks (3+ clicks in 2 seconds)
   */
  async recordClick(page: Page, selector: string, x: number, y: number): Promise<void> {
    const now = Date.now();
    const tracking = this.clickTracker.get(selector) || { times: [], count: 0 };

    // Remove clicks older than 2 seconds
    tracking.times = tracking.times.filter((t) => now - t < 2000);
    tracking.times.push(now);
    tracking.count++;

    this.clickTracker.set(selector, tracking);

    // Rage click detected (3+ clicks in 2s)
    if (tracking.times.length >= 3) {
      const screenshotPath = await this.captureScreenshot(page, 'rage_click');

      const observation: Observation = {
        id: this.generateObservationId(),
        eventType: 'rage_click',
        timestamp: new Date().toISOString(),
        payload: {
          selector,
          coordinates: { x, y },
          clickCount: tracking.count,
        },
        screenshotPath,
      };

      this.observations.push(observation);
      logger.warn({ runId: this.runId, observation }, 'Rage click detected');

      // Reset tracker after detection
      this.clickTracker.delete(selector);
    }
  }

  /**
   * Records a broken image observation
   */
  private async recordBrokenImage(page: Page, src: string): Promise<Observation> {
    const screenshotPath = await this.captureScreenshot(page, 'broken_image');

    const observation: Observation = {
      id: this.generateObservationId(),
      eventType: 'broken_image',
      timestamp: new Date().toISOString(),
      payload: {
        src,
      },
      screenshotPath,
    };

    this.observations.push(observation);
    return observation;
  }

  /**
   * Records a stuck loader observation
   */
  async recordStuckLoader(
    page: Page,
    selector: string,
    visibleDuration: number
  ): Promise<Observation> {
    const screenshotPath = await this.captureScreenshot(page, 'stuck_loader');

    const observation: Observation = {
      id: this.generateObservationId(),
      eventType: 'stuck_loader',
      timestamp: new Date().toISOString(),
      payload: {
        selector,
        visibleDuration,
      },
      screenshotPath,
    };

    this.observations.push(observation);
    logger.warn({ runId: this.runId, observation }, 'Stuck loader detected');
    return observation;
  }

  /**
   * Captures a screenshot and returns the file path
   */
  private async captureScreenshot(page: Page, eventType: string): Promise<string> {
    try {
      const timestamp = Date.now();
      const filename = `${eventType}_${timestamp}.png`;
      const filepath = path.join(this.screenshotDir, filename);

      await page.screenshot({ path: filepath, fullPage: false });

      return filepath;
    } catch (error) {
      logger.error({ error, runId: this.runId }, 'Failed to capture screenshot');
      return '';
    }
  }

  /**
   * Generates a unique observation ID
   */
  private generateObservationId(): string {
    return `obs-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Returns all captured observations
   */
  getObservations(): Observation[] {
    return this.observations;
  }

  /**
   * Returns the count of observations by type
   */
  getObservationCounts(): Record<string, number> {
    const counts: Record<string, number> = {};

    this.observations.forEach((obs) => {
      counts[obs.eventType] = (counts[obs.eventType] || 0) + 1;
    });

    return counts;
  }
}
