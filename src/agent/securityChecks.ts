/**
 * Security Checks
 *
 * Standalone async HTTP-based security check functions.
 * Each check runs independently and returns a SecurityCheckResult.
 * All checks use native fetch with a 10-second timeout.
 * Checks never throw — network errors return passed: false with info severity.
 */

export interface SecurityCheckResult {
  checkName: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  evidence?: string;
  passed: boolean;
}

/**
 * Creates a fetch with a 10-second AbortController timeout.
 */
function createTimeoutSignal(): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 10_000);
  return controller.signal;
}

/**
 * Wraps a check function to catch network errors and return a safe error result.
 */
function withErrorHandler(
  checkName: string,
  fn: () => Promise<SecurityCheckResult[]>
): Promise<SecurityCheckResult[]> {
  return fn().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    return [
      {
        checkName,
        severity: 'info' as const,
        title: `${checkName}: check failed`,
        description: `Network or fetch error prevented check from completing.`,
        evidence: message,
        passed: false,
      },
    ];
  });
}

/**
 * Check 1: Security Headers
 * GET homepage and inspect response headers for missing security headers.
 *
 * @param baseUrl - The base URL to test
 * @returns Array of SecurityCheckResult (one per missing header, or single passed result)
 */
export async function checkSecurityHeaders(baseUrl: string): Promise<SecurityCheckResult[]> {
  return withErrorHandler('checkSecurityHeaders', async () => {
    const response = await fetch(baseUrl, { signal: createTimeoutSignal() });
    const headers = response.headers;

    const results: SecurityCheckResult[] = [];

    // X-Frame-Options or Content-Security-Policy (frame-ancestors)
    const hasXFrameOptions = headers.has('x-frame-options');
    const csp = headers.get('content-security-policy') ?? '';
    const hasFrameAncestors = csp.includes('frame-ancestors');

    if (!hasXFrameOptions && !hasFrameAncestors) {
      results.push({
        checkName: 'checkSecurityHeaders',
        severity: 'medium',
        title: 'Missing X-Frame-Options or CSP frame-ancestors',
        description:
          'The response does not set X-Frame-Options or Content-Security-Policy with frame-ancestors. This may allow clickjacking attacks.',
        passed: false,
      });
    }

    // X-Content-Type-Options: nosniff
    const xContentType = headers.get('x-content-type-options');
    if (!xContentType || !xContentType.includes('nosniff')) {
      results.push({
        checkName: 'checkSecurityHeaders',
        severity: 'low',
        title: 'Missing X-Content-Type-Options: nosniff',
        description:
          'The response does not set X-Content-Type-Options: nosniff, allowing MIME-type sniffing attacks.',
        passed: false,
      });
    }

    // Strict-Transport-Security (HSTS)
    if (!headers.has('strict-transport-security')) {
      results.push({
        checkName: 'checkSecurityHeaders',
        severity: 'medium',
        title: 'Missing Strict-Transport-Security (HSTS)',
        description:
          'The response does not set the Strict-Transport-Security header, leaving the site vulnerable to protocol downgrade attacks.',
        passed: false,
      });
    }

    // Referrer-Policy
    if (!headers.has('referrer-policy')) {
      results.push({
        checkName: 'checkSecurityHeaders',
        severity: 'low',
        title: 'Missing Referrer-Policy',
        description:
          'The response does not set a Referrer-Policy header. Referrer information may leak to third-party sites.',
        passed: false,
      });
    }

    if (results.length === 0) {
      return [
        {
          checkName: 'checkSecurityHeaders',
          severity: 'info',
          title: 'Security headers: all present',
          description: 'All required security headers are present.',
          passed: true,
        },
      ];
    }

    return results;
  });
}

/**
 * Check 2: Cookie Flags
 * GET homepage and inspect Set-Cookie headers for missing security flags.
 *
 * @param baseUrl - The base URL to test
 * @returns Array of SecurityCheckResult (one per problematic cookie, or single passed result)
 */
export async function checkCookieFlags(baseUrl: string): Promise<SecurityCheckResult[]> {
  return withErrorHandler('checkCookieFlags', async () => {
    const response = await fetch(baseUrl, { signal: createTimeoutSignal() });

    // node-fetch / undici exposes Set-Cookie via getSetCookie() or raw headers
    const setCookieValues: string[] = [];
    response.headers.forEach((value, name) => {
      if (name.toLowerCase() === 'set-cookie') {
        setCookieValues.push(value);
      }
    });

    if (setCookieValues.length === 0) {
      return [
        {
          checkName: 'checkCookieFlags',
          severity: 'info',
          title: 'Cookie flags: no cookies set',
          description: 'No Set-Cookie headers found on homepage response.',
          passed: true,
        },
      ];
    }

    const results: SecurityCheckResult[] = [];
    const isHttps = baseUrl.startsWith('https://');

    for (const cookie of setCookieValues) {
      const cookieName = cookie.split('=')[0].trim();
      const lowerCookie = cookie.toLowerCase();

      if (!lowerCookie.includes('httponly')) {
        results.push({
          checkName: 'checkCookieFlags',
          severity: 'high',
          title: `Cookie "${cookieName}" missing HttpOnly flag`,
          description:
            'Cookie is accessible via JavaScript. HttpOnly flag prevents XSS-based session hijacking.',
          evidence: cookie,
          passed: false,
        });
      }

      if (isHttps && !lowerCookie.includes('secure')) {
        results.push({
          checkName: 'checkCookieFlags',
          severity: 'medium',
          title: `Cookie "${cookieName}" missing Secure flag`,
          description:
            'Cookie can be transmitted over HTTP. The Secure flag restricts cookie transmission to HTTPS only.',
          evidence: cookie,
          passed: false,
        });
      }

      if (!lowerCookie.includes('samesite')) {
        results.push({
          checkName: 'checkCookieFlags',
          severity: 'medium',
          title: `Cookie "${cookieName}" missing SameSite flag`,
          description:
            'Cookie does not specify SameSite attribute, leaving it potentially vulnerable to CSRF attacks.',
          evidence: cookie,
          passed: false,
        });
      }
    }

    if (results.length === 0) {
      return [
        {
          checkName: 'checkCookieFlags',
          severity: 'info',
          title: 'Cookie flags: all cookies properly configured',
          description: 'All cookies have HttpOnly, Secure (for HTTPS), and SameSite flags set.',
          passed: true,
        },
      ];
    }

    return results;
  });
}

/**
 * Check 3: XSS Reflection
 * Send a script tag as a query parameter and check if it is reflected unescaped.
 *
 * @param baseUrl - The base URL to test
 * @returns Single SecurityCheckResult
 */
export async function checkXssReflection(baseUrl: string): Promise<SecurityCheckResult[]> {
  return withErrorHandler('checkXssReflection', async () => {
    const payload = '<script>alert(1)</script>';
    const testUrl = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}q=${encodeURIComponent(payload)}`;

    const response = await fetch(testUrl, { signal: createTimeoutSignal() });
    const body = await response.text();

    if (body.includes(payload)) {
      return [
        {
          checkName: 'checkXssReflection',
          severity: 'critical',
          title: 'XSS: script tag reflected unescaped',
          description:
            'The application reflects user-supplied input containing a script tag without HTML encoding. This is a confirmed reflected XSS vulnerability.',
          evidence: `Payload reflected in response body: ${payload}`,
          passed: false,
        },
      ];
    }

    return [
      {
        checkName: 'checkXssReflection',
        severity: 'info',
        title: 'XSS reflection: not detected',
        description: 'Script tag payload was not reflected unescaped in the response body.',
        passed: true,
      },
    ];
  });
}

/**
 * Check 4: CSRF Headers
 * POST to base URL without Origin or Referer headers and check if the request succeeds.
 *
 * @param baseUrl - The base URL to test
 * @returns Single SecurityCheckResult
 */
export async function checkCsrfHeaders(baseUrl: string): Promise<SecurityCheckResult[]> {
  return withErrorHandler('checkCsrfHeaders', async () => {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Deliberately omitting Origin and Referer headers
      },
      body: JSON.stringify({ test: 1 }),
      signal: createTimeoutSignal(),
    });

    if (response.status !== 403 && response.status !== 401 && response.status < 400) {
      return [
        {
          checkName: 'checkCsrfHeaders',
          severity: 'high',
          title: 'Potential CSRF: POST accepted without Origin/Referer',
          description:
            'The server accepted a POST request without Origin or Referer headers and returned a non-error response. This may indicate missing CSRF protection.',
          evidence: `Response status: ${response.status}`,
          passed: false,
        },
      ];
    }

    return [
      {
        checkName: 'checkCsrfHeaders',
        severity: 'info',
        title: 'CSRF headers: server rejected cross-origin POST',
        description: 'Server returned an error response to POST without Origin/Referer headers.',
        evidence: `Response status: ${response.status}`,
        passed: true,
      },
    ];
  });
}

/**
 * Check 5: Open Redirect
 * GET with a redirect query param pointing to an external URL.
 *
 * @param baseUrl - The base URL to test
 * @returns Single SecurityCheckResult
 */
export async function checkOpenRedirect(baseUrl: string): Promise<SecurityCheckResult[]> {
  return withErrorHandler('checkOpenRedirect', async () => {
    const evilUrl = 'https://evil.com';
    const testUrl = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}redirect=${encodeURIComponent(evilUrl)}`;

    const response = await fetch(testUrl, {
      redirect: 'manual',
      signal: createTimeoutSignal(),
    });

    // Check if it redirected to the evil domain
    const location = response.headers.get('location') ?? '';
    if (
      response.status >= 300 &&
      response.status < 400 &&
      (location.startsWith(evilUrl) || location.includes('evil.com'))
    ) {
      return [
        {
          checkName: 'checkOpenRedirect',
          severity: 'high',
          title: 'Open redirect detected',
          description:
            'The server redirected to an attacker-controlled external URL via the redirect parameter. This enables phishing attacks.',
          evidence: `Location header: ${location}`,
          passed: false,
        },
      ];
    }

    return [
      {
        checkName: 'checkOpenRedirect',
        severity: 'info',
        title: 'Open redirect: not detected',
        description: 'Server did not redirect to the external URL in the redirect parameter.',
        passed: true,
      },
    ];
  });
}

/**
 * Check 6: Mixed Content
 * Fetch page HTML and look for http:// in src/href attributes (HTTPS pages only).
 *
 * @param baseUrl - The base URL to test
 * @returns Single SecurityCheckResult
 */
export async function checkMixedContent(baseUrl: string): Promise<SecurityCheckResult[]> {
  return withErrorHandler('checkMixedContent', async () => {
    if (!baseUrl.startsWith('https://')) {
      return [
        {
          checkName: 'checkMixedContent',
          severity: 'info',
          title: 'Mixed content: check skipped (HTTP URL)',
          description: 'Mixed content check only applies to HTTPS pages.',
          passed: true,
        },
      ];
    }

    const response = await fetch(baseUrl, { signal: createTimeoutSignal() });
    const html = await response.text();

    // Look for http:// references in src= or href= attributes
    const mixedContentPattern = /(?:src|href)=["']http:\/\//gi;
    const matches = html.match(mixedContentPattern);

    if (matches && matches.length > 0) {
      return [
        {
          checkName: 'checkMixedContent',
          severity: 'medium',
          title: 'Mixed content detected',
          description:
            'The HTTPS page contains references to HTTP resources via src= or href= attributes. This can trigger browser mixed content warnings and expose users to man-in-the-middle attacks.',
          evidence: `Found ${matches.length} mixed content reference(s): ${matches.slice(0, 3).join(', ')}`,
          passed: false,
        },
      ];
    }

    return [
      {
        checkName: 'checkMixedContent',
        severity: 'info',
        title: 'Mixed content: not detected',
        description: 'No HTTP resource references found in HTTPS page.',
        passed: true,
      },
    ];
  });
}

/**
 * Check 7: Clickjacking
 * Inspect X-Frame-Options and Content-Security-Policy frame-ancestors directives.
 *
 * @param baseUrl - The base URL to test
 * @returns Single SecurityCheckResult
 */
export async function checkClickjacking(baseUrl: string): Promise<SecurityCheckResult[]> {
  return withErrorHandler('checkClickjacking', async () => {
    const response = await fetch(baseUrl, { signal: createTimeoutSignal() });
    const headers = response.headers;

    const hasXFrameOptions = headers.has('x-frame-options');
    const csp = headers.get('content-security-policy') ?? '';
    const hasFrameAncestors = csp.includes('frame-ancestors');

    if (!hasXFrameOptions && !hasFrameAncestors) {
      return [
        {
          checkName: 'checkClickjacking',
          severity: 'medium',
          title: 'Clickjacking protection missing',
          description:
            'Neither X-Frame-Options nor Content-Security-Policy frame-ancestors is set. The page can be embedded in an iframe, enabling clickjacking attacks.',
          passed: false,
        },
      ];
    }

    const evidence: string[] = [];
    if (hasXFrameOptions) {
      evidence.push(`X-Frame-Options: ${headers.get('x-frame-options')}`);
    }
    if (hasFrameAncestors) {
      evidence.push(`CSP frame-ancestors present`);
    }

    return [
      {
        checkName: 'checkClickjacking',
        severity: 'info',
        title: 'Clickjacking protection: present',
        description: 'Clickjacking protection header(s) are set.',
        evidence: evidence.join(', '),
        passed: true,
      },
    ];
  });
}
