import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  checkSecurityHeaders,
  checkCookieFlags,
  checkXssReflection,
  checkCsrfHeaders,
  checkOpenRedirect,
  checkMixedContent,
  checkClickjacking,
} from '../securityChecks';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

/**
 * Helper to build a mock Response with specific headers and body.
 */
function makeFetchResponse(
  status: number,
  headers: Record<string, string> = {},
  body = ''
): Response {
  const headersMap = new Headers(headers);

  return {
    status,
    ok: status >= 200 && status < 300,
    headers: headersMap,
    text: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('checkSecurityHeaders', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns failed checks for missing security headers', async () => {
    // No security headers set
    mockFetch.mockResolvedValue(makeFetchResponse(200, {}));

    const results = await checkSecurityHeaders('http://example.com');

    expect(results.length).toBeGreaterThan(0);
    const failed = results.filter((r) => !r.passed);
    expect(failed.length).toBeGreaterThan(0);
    expect(failed.every((r) => r.checkName === 'checkSecurityHeaders')).toBe(true);
  });

  it('returns a single passed result when all security headers present', async () => {
    mockFetch.mockResolvedValue(
      makeFetchResponse(200, {
        'x-frame-options': 'DENY',
        'x-content-type-options': 'nosniff',
        'strict-transport-security': 'max-age=31536000',
        'referrer-policy': 'no-referrer',
      })
    );

    const results = await checkSecurityHeaders('http://example.com');

    expect(results).toHaveLength(1);
    expect(results[0].passed).toBe(true);
  });

  it('returns error result (not throw) on network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const results = await checkSecurityHeaders('http://example.com');

    expect(results).toHaveLength(1);
    expect(results[0].passed).toBe(false);
    expect(results[0].severity).toBe('info');
    expect(results[0].evidence).toContain('Network error');
  });
});

describe('checkCookieFlags', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns high severity result for cookie without HttpOnly flag', async () => {
    mockFetch.mockResolvedValue(
      makeFetchResponse(200, {
        'set-cookie': 'session=abc123; Path=/',
      })
    );

    const results = await checkCookieFlags('http://example.com');

    const httpOnlyIssue = results.find((r) => r.title.includes('HttpOnly'));
    expect(httpOnlyIssue).toBeDefined();
    expect(httpOnlyIssue!.severity).toBe('high');
    expect(httpOnlyIssue!.passed).toBe(false);
  });

  it('returns passed result when no cookies are set', async () => {
    mockFetch.mockResolvedValue(makeFetchResponse(200, {}));

    const results = await checkCookieFlags('http://example.com');

    expect(results).toHaveLength(1);
    expect(results[0].passed).toBe(true);
  });

  it('returns error result (not throw) on network error', async () => {
    mockFetch.mockRejectedValue(new Error('Connection refused'));

    const results = await checkCookieFlags('http://example.com');

    expect(results).toHaveLength(1);
    expect(results[0].passed).toBe(false);
    expect(results[0].severity).toBe('info');
  });
});

describe('checkXssReflection', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns critical result when script tag is reflected unescaped', async () => {
    const payload = '<script>alert(1)</script>';
    mockFetch.mockResolvedValue(
      makeFetchResponse(200, { 'content-type': 'text/html' }, `<html>${payload}</html>`)
    );

    const results = await checkXssReflection('http://example.com');

    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe('critical');
    expect(results[0].passed).toBe(false);
  });

  it('returns passed result when script tag is not reflected', async () => {
    mockFetch.mockResolvedValue(
      makeFetchResponse(200, { 'content-type': 'text/html' }, '<html><body>Hello</body></html>')
    );

    const results = await checkXssReflection('http://example.com');

    expect(results).toHaveLength(1);
    expect(results[0].passed).toBe(true);
  });

  it('returns error result (not throw) on network error', async () => {
    mockFetch.mockRejectedValue(new Error('Timeout'));

    const results = await checkXssReflection('http://example.com');

    expect(results).toHaveLength(1);
    expect(results[0].passed).toBe(false);
    expect(results[0].severity).toBe('info');
  });
});

describe('checkCsrfHeaders', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns high severity when POST accepted without Origin/Referer', async () => {
    mockFetch.mockResolvedValue(makeFetchResponse(200, {}));

    const results = await checkCsrfHeaders('http://example.com');

    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe('high');
    expect(results[0].passed).toBe(false);
  });

  it('returns passed when server rejects POST with 403', async () => {
    mockFetch.mockResolvedValue(makeFetchResponse(403, {}));

    const results = await checkCsrfHeaders('http://example.com');

    expect(results).toHaveLength(1);
    expect(results[0].passed).toBe(true);
  });

  it('returns error result (not throw) on network error', async () => {
    mockFetch.mockRejectedValue(new Error('Connection refused'));

    const results = await checkCsrfHeaders('http://example.com');

    expect(results).toHaveLength(1);
    expect(results[0].passed).toBe(false);
  });
});

describe('checkOpenRedirect', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns high severity when redirect points to external domain', async () => {
    mockFetch.mockResolvedValue(
      makeFetchResponse(302, { location: 'https://evil.com/phishing' })
    );

    const results = await checkOpenRedirect('http://example.com');

    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe('high');
    expect(results[0].passed).toBe(false);
  });

  it('returns passed when redirect is to same-origin', async () => {
    mockFetch.mockResolvedValue(
      makeFetchResponse(302, { location: 'http://example.com/dashboard' })
    );

    const results = await checkOpenRedirect('http://example.com');

    expect(results).toHaveLength(1);
    expect(results[0].passed).toBe(true);
  });

  it('returns passed when no redirect occurs', async () => {
    mockFetch.mockResolvedValue(makeFetchResponse(200, {}));

    const results = await checkOpenRedirect('http://example.com');

    expect(results).toHaveLength(1);
    expect(results[0].passed).toBe(true);
  });

  it('returns error result (not throw) on network error', async () => {
    mockFetch.mockRejectedValue(new Error('DNS resolution failed'));

    const results = await checkOpenRedirect('http://example.com');

    expect(results).toHaveLength(1);
    expect(results[0].passed).toBe(false);
  });
});

describe('checkMixedContent', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('skips check for HTTP URLs and returns passed with info', async () => {
    const results = await checkMixedContent('http://example.com');

    expect(mockFetch).not.toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0].passed).toBe(true);
    expect(results[0].severity).toBe('info');
  });

  it('returns medium severity when mixed content found on HTTPS page', async () => {
    const html = `<html><head><script src="http://cdn.example.com/script.js"></script></head></html>`;
    mockFetch.mockResolvedValue(makeFetchResponse(200, {}, html));

    const results = await checkMixedContent('https://example.com');

    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe('medium');
    expect(results[0].passed).toBe(false);
  });

  it('returns passed for HTTPS page without mixed content', async () => {
    const html = `<html><head><script src="https://cdn.example.com/script.js"></script></head></html>`;
    mockFetch.mockResolvedValue(makeFetchResponse(200, {}, html));

    const results = await checkMixedContent('https://example.com');

    expect(results).toHaveLength(1);
    expect(results[0].passed).toBe(true);
  });
});

describe('checkClickjacking', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns medium severity when neither X-Frame-Options nor CSP frame-ancestors is set', async () => {
    mockFetch.mockResolvedValue(makeFetchResponse(200, {}));

    const results = await checkClickjacking('http://example.com');

    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe('medium');
    expect(results[0].passed).toBe(false);
  });

  it('returns passed when X-Frame-Options is set', async () => {
    mockFetch.mockResolvedValue(makeFetchResponse(200, { 'x-frame-options': 'SAMEORIGIN' }));

    const results = await checkClickjacking('http://example.com');

    expect(results).toHaveLength(1);
    expect(results[0].passed).toBe(true);
  });

  it('returns passed when CSP frame-ancestors is set', async () => {
    mockFetch.mockResolvedValue(
      makeFetchResponse(200, { 'content-security-policy': "frame-ancestors 'none'" })
    );

    const results = await checkClickjacking('http://example.com');

    expect(results).toHaveLength(1);
    expect(results[0].passed).toBe(true);
  });

  it('returns error result (not throw) on network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network unreachable'));

    const results = await checkClickjacking('http://example.com');

    expect(results).toHaveLength(1);
    expect(results[0].passed).toBe(false);
    expect(results[0].severity).toBe('info');
  });
});
