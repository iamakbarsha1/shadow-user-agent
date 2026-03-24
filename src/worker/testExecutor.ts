import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { logger } from '../utils/logger';

/**
 * Test Executor
 *
 * Runs a single Playwright test file in a sandboxed subprocess.
 * Writes the test code to a temp file, invokes `npx playwright test`,
 * captures combined stdout/stderr, and returns the result.
 */

export interface TestRunResult {
  passed: boolean;
  duration: number; // ms
  output: string;
}

const EXECUTION_TIMEOUT_MS = parseInt(process.env.TEST_EXECUTION_TIMEOUT_MS || '60000', 10);

/**
 * Runs test code as a Playwright test file and returns the result.
 * The temp file is always deleted after execution.
 */
export async function runTestCode(testCode: string): Promise<TestRunResult> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'shadow-test-'));
  const testFile = path.join(tmpDir, 'test.spec.ts');

  try {
    await fs.writeFile(testFile, testCode, 'utf-8');

    const { passed, duration, output } = await executePlaywright(testFile, tmpDir);

    return { passed, duration, output };
  } finally {
    // Always clean up temp dir
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Invokes npx playwright test on a single spec file.
 * Returns combined output and pass/fail status.
 */
function executePlaywright(
  testFile: string,
  cwd: string
): Promise<{ passed: boolean; duration: number; output: string }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const outputChunks: string[] = [];

    // Use a minimal Playwright config: no retries, no parallelism, plain list reporter
    const child = spawn(
      'npx',
      [
        'playwright',
        'test',
        testFile,
        '--reporter=list',
        '--retries=0',
        '--workers=1',
      ],
      {
        cwd,
        env: {
          ...process.env,
          // Suppress Playwright update notices
          PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1',
          CI: '1',
        },
        timeout: EXECUTION_TIMEOUT_MS,
      }
    );

    child.stdout?.on('data', (chunk: Buffer) => {
      outputChunks.push(chunk.toString());
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      outputChunks.push(chunk.toString());
    });

    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      outputChunks.push(`\n[Shadow] Execution timed out after ${EXECUTION_TIMEOUT_MS}ms`);
    }, EXECUTION_TIMEOUT_MS + 2000);

    child.on('close', (code) => {
      clearTimeout(timeout);
      const duration = Date.now() - start;
      const output = outputChunks.join('').slice(0, 10000); // cap at 10KB
      resolve({ passed: code === 0, duration, output });
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      const duration = Date.now() - start;
      logger.error({ err }, 'Playwright subprocess error');
      resolve({
        passed: false,
        duration,
        output: `[Shadow] Failed to spawn Playwright: ${err.message}`,
      });
    });
  });
}
