import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validateTargetUrl } from '../urlValidator';
import { InvalidUrlError } from '../errors';

describe('validateTargetUrl', () => {
  describe('valid URLs', () => {
    it('accepts public HTTP URLs', () => {
      expect(() => validateTargetUrl('http://example.com')).not.toThrow();
    });

    it('accepts public HTTPS URLs', () => {
      expect(() => validateTargetUrl('https://example.com/path?q=1')).not.toThrow();
    });

    it('accepts URLs with subdomains', () => {
      expect(() => validateTargetUrl('https://app.example.com')).not.toThrow();
    });

    it('accepts URLs with ports that are not blocked', () => {
      expect(() => validateTargetUrl('https://example.com:8443')).not.toThrow();
    });

    it('accepts demo.playwright.dev', () => {
      expect(() =>
        validateTargetUrl('https://demo.playwright.dev/todomvc')
      ).not.toThrow();
    });
  });

  describe('protocol blocking', () => {
    it('rejects ftp:// protocol', () => {
      expect(() => validateTargetUrl('ftp://example.com')).toThrow(InvalidUrlError);
    });

    it('rejects file:// protocol', () => {
      expect(() => validateTargetUrl('file:///etc/passwd')).toThrow(InvalidUrlError);
    });

    it('rejects javascript: protocol', () => {
      expect(() => validateTargetUrl('javascript:alert(1)')).toThrow(InvalidUrlError);
    });

    it('rejects data: protocol', () => {
      expect(() => validateTargetUrl('data:text/html,<h1>test</h1>')).toThrow(InvalidUrlError);
    });
  });

  describe('malformed URLs', () => {
    it('rejects empty string', () => {
      expect(() => validateTargetUrl('')).toThrow(InvalidUrlError);
    });

    it('rejects plain text without protocol', () => {
      expect(() => validateTargetUrl('example.com')).toThrow(InvalidUrlError);
    });

    it('rejects random strings', () => {
      expect(() => validateTargetUrl('not-a-url-at-all')).toThrow(InvalidUrlError);
    });
  });

  describe('SSRF — loopback blocking', () => {
    it('rejects localhost', () => {
      expect(() => validateTargetUrl('http://localhost')).toThrow(InvalidUrlError);
    });

    it('rejects 127.0.0.1', () => {
      expect(() => validateTargetUrl('http://127.0.0.1')).toThrow(InvalidUrlError);
    });

    it('rejects 0.0.0.0', () => {
      expect(() => validateTargetUrl('http://0.0.0.0')).toThrow(InvalidUrlError);
    });

    it('rejects IPv6 loopback ::1', () => {
      expect(() => validateTargetUrl('http://[::1]')).toThrow(InvalidUrlError);
    });
  });

  describe('SSRF — private IP ranges', () => {
    it('rejects 10.x.x.x (Class A private)', () => {
      expect(() => validateTargetUrl('http://10.0.0.1')).toThrow(InvalidUrlError);
    });

    it('rejects 172.16.x.x (Class B private)', () => {
      expect(() => validateTargetUrl('http://172.16.0.1')).toThrow(InvalidUrlError);
    });

    it('rejects 172.31.x.x (Class B private upper boundary)', () => {
      expect(() => validateTargetUrl('http://172.31.255.255')).toThrow(InvalidUrlError);
    });

    it('allows 172.32.x.x (public — just above private range)', () => {
      expect(() => validateTargetUrl('http://172.32.0.1')).not.toThrow();
    });

    it('rejects 192.168.x.x (Class C private)', () => {
      expect(() => validateTargetUrl('http://192.168.1.1')).toThrow(InvalidUrlError);
    });

    it('rejects 169.254.x.x (link-local)', () => {
      expect(() => validateTargetUrl('http://169.254.169.254')).toThrow(InvalidUrlError);
    });
  });

  describe('SSRF — metadata endpoints', () => {
    it('rejects AWS metadata endpoint by IP', () => {
      expect(() => validateTargetUrl('http://169.254.169.254/latest/meta-data')).toThrow(
        InvalidUrlError
      );
    });

    it('rejects GCP metadata by hostname', () => {
      expect(() =>
        validateTargetUrl('http://metadata.google.internal/computeMetadata/v1/')
      ).toThrow(InvalidUrlError);
    });
  });

  describe('SSRF — blocked ports', () => {
    it('rejects SSH port 22', () => {
      expect(() => validateTargetUrl('http://example.com:22')).toThrow(InvalidUrlError);
    });

    it('rejects PostgreSQL port 5432', () => {
      expect(() => validateTargetUrl('http://example.com:5432')).toThrow(InvalidUrlError);
    });

    it('rejects Redis port 6379', () => {
      expect(() => validateTargetUrl('http://example.com:6379')).toThrow(InvalidUrlError);
    });

    it('rejects MySQL port 3306', () => {
      expect(() => validateTargetUrl('http://example.com:3306')).toThrow(InvalidUrlError);
    });
  });

  describe('ALLOWED_INTERNAL_HOSTS whitelist', () => {
    beforeEach(() => {
      process.env.ALLOWED_INTERNAL_HOSTS = '192.168.1.10,staging.internal';
    });

    afterEach(() => {
      delete process.env.ALLOWED_INTERNAL_HOSTS;
    });

    it('allows explicitly whitelisted private IPs', () => {
      expect(() => validateTargetUrl('http://192.168.1.10')).not.toThrow();
    });

    it('still blocks non-whitelisted private IPs', () => {
      expect(() => validateTargetUrl('http://192.168.1.99')).toThrow(InvalidUrlError);
    });
  });

  describe('error type', () => {
    it('throws InvalidUrlError with the blocked URL', () => {
      try {
        validateTargetUrl('http://localhost');
      } catch (err) {
        expect(err).toBeInstanceOf(InvalidUrlError);
        expect((err as InvalidUrlError).code).toBe('INVALID_URL');
        expect((err as InvalidUrlError).message).toContain('localhost');
      }
    });
  });
});
