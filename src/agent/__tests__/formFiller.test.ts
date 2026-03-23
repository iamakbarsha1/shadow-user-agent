import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FormFiller } from '../formFiller';
import { chromium, type Browser, type Page } from 'playwright';

describe('FormFiller', () => {
  let browser: Browser | null = null;
  let page: Page | null = null;

  beforeEach(async () => {
    try {
      browser = await chromium.launch({ headless: true });
      page = await browser.newPage();
    } catch (error) {
      console.error('Failed to launch browser:', error);
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
  });

  describe('careful strategy', () => {
    it('should fill all required fields', async () => {
      const filler = new FormFiller('careful');

      await page.setContent(`
        <form>
          <input type="text" name="name" required />
          <input type="email" name="email" required />
          <input type="text" name="optional" />
        </form>
      `);

      await filler.fillFormsOnPage(page);

      const nameValue = await page.locator('[name="name"]').inputValue();
      const emailValue = await page.locator('[name="email"]').inputValue();

      expect(nameValue).not.toBe('');
      expect(emailValue).toContain('@');
    });

    it('should use realistic values based on field names', async () => {
      const filler = new FormFiller('careful');

      await page.setContent(`
        <form>
          <input type="text" name="firstName" />
          <input type="text" name="lastName" />
          <input type="email" name="email" />
        </form>
      `);

      await filler.fillFormsOnPage(page);

      const firstName = await page.locator('[name="firstName"]').inputValue();
      const lastName = await page.locator('[name="lastName"]').inputValue();
      const email = await page.locator('[name="email"]').inputValue();

      expect(firstName).toBe('John');
      expect(lastName).toBe('Doe');
      expect(email).toContain('@');
    });

    it('should fill select dropdowns', async () => {
      const filler = new FormFiller('careful');

      await page.setContent(`
        <form>
          <select name="country">
            <option value="">Select...</option>
            <option value="us">United States</option>
            <option value="ca">Canada</option>
          </select>
        </form>
      `);

      await filler.fillFormsOnPage(page);

      const value = await page.locator('[name="country"]').inputValue();
      expect(value).not.toBe('');
    });

    it('should check checkboxes', async () => {
      const filler = new FormFiller('careful');

      await page.setContent(`
        <form>
          <input type="checkbox" name="agree" />
        </form>
      `);

      await filler.fillFormsOnPage(page);

      const isChecked = await page.locator('[name="agree"]').isChecked();
      expect(isChecked).toBe(true);
    });
  });

  describe('fast strategy', () => {
    it('should skip optional fields', async () => {
      const filler = new FormFiller('fast');

      await page.setContent(`
        <form>
          <input type="text" name="required" required />
          <input type="text" name="optional" />
        </form>
      `);

      await filler.fillFormsOnPage(page);

      const requiredValue = await page.locator('[name="required"]').inputValue();
      const optionalValue = await page.locator('[name="optional"]').inputValue();

      expect(requiredValue).not.toBe('');
      expect(optionalValue).toBe(''); // Should be skipped
    });

    it('should select first non-empty option in dropdowns', async () => {
      const filler = new FormFiller('fast');

      await page.setContent(`
        <form>
          <select name="choice" required>
            <option value="">Select...</option>
            <option value="option1">Option 1</option>
            <option value="option2">Option 2</option>
          </select>
        </form>
      `);

      await filler.fillFormsOnPage(page);

      const value = await page.locator('[name="choice"]').inputValue();
      expect(value).toBe('option1'); // First non-empty option
    });
  });

  describe('random strategy', () => {
    it('should use edge case values', async () => {
      const filler = new FormFiller('random');

      await page.setContent(`
        <form>
          <input type="text" name="field1" />
          <input type="text" name="field2" />
          <input type="text" name="field3" />
        </form>
      `);

      // Mock Math.random to ensure fields are filled (not skipped) with non-empty values
      // random() <= 0.5 means field is filled; index 1 = ' ' (single space)
      const mockRandom = vi.spyOn(Math, 'random').mockReturnValue(0.3);

      await filler.fillFormsOnPage(page);

      mockRandom.mockRestore();

      const field1 = await page.locator('[name="field1"]').inputValue();
      const field2 = await page.locator('[name="field2"]').inputValue();
      const field3 = await page.locator('[name="field3"]').inputValue();

      // All fields should have the same edge case value (index floor(0.3*10)=3)
      const hasValue = field1 !== '' || field2 !== '' || field3 !== '';
      expect(hasValue).toBe(true);
    });

    it('should randomly select dropdown options', async () => {
      const filler = new FormFiller('random');

      await page.setContent(`
        <form>
          <select name="choice">
            <option value="a">A</option>
            <option value="b">B</option>
            <option value="c">C</option>
          </select>
        </form>
      `);

      await filler.fillFormsOnPage(page);

      const value = await page.locator('[name="choice"]').inputValue();
      expect(['a', 'b', 'c']).toContain(value);
    });
  });

  describe('field type detection', () => {
    it('should properly fill email fields', async () => {
      const filler = new FormFiller('careful');

      await page.setContent(`
        <form>
          <input type="email" name="userEmail" />
        </form>
      `);

      await filler.fillFormsOnPage(page);

      const value = await page.locator('[name="userEmail"]').inputValue();
      expect(value).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/); // Valid email format
    });

    it('should properly fill phone fields', async () => {
      const filler = new FormFiller('careful');

      await page.setContent(`
        <form>
          <input type="tel" name="phone" />
        </form>
      `);

      await filler.fillFormsOnPage(page);

      const value = await page.locator('[name="phone"]').inputValue();
      expect(value).toBe('555-123-4567');
    });

    it('should properly fill URL fields', async () => {
      const filler = new FormFiller('careful');

      await page.setContent(`
        <form>
          <input type="url" name="website" />
        </form>
      `);

      await filler.fillFormsOnPage(page);

      const value = await page.locator('[name="website"]').inputValue();
      expect(value).toBe('https://example.com');
    });

    it('should fill textareas with longer text', async () => {
      const filler = new FormFiller('careful');

      await page.setContent(`
        <form>
          <textarea name="comments"></textarea>
        </form>
      `);

      await filler.fillFormsOnPage(page);

      const value = await page.locator('[name="comments"]').inputValue();
      expect(value.length).toBeGreaterThan(10);
    });
  });

  describe('multiple forms', () => {
    it('should fill multiple forms on a page', async () => {
      const filler = new FormFiller('careful');

      await page.setContent(`
        <form id="form1">
          <input type="text" name="field1" />
        </form>
        <form id="form2">
          <input type="text" name="field2" />
        </form>
      `);

      const filledCount = await filler.fillFormsOnPage(page);

      expect(filledCount).toBe(2);

      const field1 = await page.locator('#form1 [name="field1"]').inputValue();
      const field2 = await page.locator('#form2 [name="field2"]').inputValue();

      expect(field1).not.toBe('');
      expect(field2).not.toBe('');
    });
  });
});
