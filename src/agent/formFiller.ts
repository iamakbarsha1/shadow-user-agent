import type { Page, Locator } from 'playwright';
import type { FormFillStrategy } from '../types/persona';
import { logger } from '../utils/logger';

/**
 * Form Filler
 *
 * Fills form fields with realistic data based on persona's form fill strategy.
 * - careful: Validates before submitting, fills all required fields
 * - fast: Skips optional fields, uses shortcuts
 * - random: Empty fields, special characters, edge cases
 */

interface FormField {
  element: Locator;
  type: string;
  name?: string;
  placeholder?: string;
  required: boolean;
}

export class FormFiller {
  private strategy: FormFillStrategy;

  constructor(strategy: FormFillStrategy) {
    this.strategy = strategy;
  }

  /**
   * Fills all visible forms on the page according to strategy
   */
  async fillFormsOnPage(page: Page): Promise<number> {
    const forms = await page.locator('form').all();
    let filledCount = 0;

    for (const form of forms) {
      const isVisible = await form.isVisible().catch(() => false);
      if (isVisible) {
        await this.fillForm(form);
        filledCount++;
      }
    }

    return filledCount;
  }

  /**
   * Fills a single form
   */
  private async fillForm(form: Locator): Promise<void> {
    const fields = await this.discoverFormFields(form);

    for (const field of fields) {
      await this.fillField(field);
    }
  }

  /**
   * Discovers all fillable fields in a form
   */
  private async discoverFormFields(form: Locator): Promise<FormField[]> {
    const fields: FormField[] = [];

    // Find input fields
    const inputs = await form.locator('input').all();
    for (const input of inputs) {
      const type = (await input.getAttribute('type')) || 'text';
      const name = await input.getAttribute('name');
      const placeholder = await input.getAttribute('placeholder');
      const required = (await input.getAttribute('required')) !== null;

      // Skip hidden, submit, and button inputs
      if (['hidden', 'submit', 'button', 'image', 'reset'].includes(type)) {
        continue;
      }

      fields.push({ element: input, type, name: name ?? undefined, placeholder: placeholder ?? undefined, required });
    }

    // Find textareas
    const textareas = await form.locator('textarea').all();
    for (const textarea of textareas) {
      const name = await textarea.getAttribute('name');
      const placeholder = await textarea.getAttribute('placeholder');
      const required = (await textarea.getAttribute('required')) !== null;

      fields.push({
        element: textarea,
        type: 'textarea',
        name: name ?? undefined,
        placeholder: placeholder ?? undefined,
        required,
      });
    }

    // Find select dropdowns
    const selects = await form.locator('select').all();
    for (const select of selects) {
      const name = await select.getAttribute('name');
      const required = (await select.getAttribute('required')) !== null;

      fields.push({ element: select, type: 'select', name: name ?? undefined, placeholder: undefined, required });
    }

    return fields;
  }

  /**
   * Fills a single field based on strategy
   */
  private async fillField(field: FormField): Promise<void> {
    try {
      // Fast strategy: skip optional fields
      if (this.strategy === 'fast' && !field.required) {
        return;
      }

      // Random strategy: randomly skip fields
      if (this.strategy === 'random' && Math.random() > 0.5) {
        return; // Leave field empty
      }

      const value = this.generateValue(field);

      if (field.type === 'select') {
        await this.fillSelect(field.element, value);
      } else if (field.type === 'checkbox' || field.type === 'radio') {
        await field.element.check();
      } else {
        await field.element.fill(value);
      }
    } catch (error) {
      logger.warn({ error, field: field.name }, 'Failed to fill field');
    }
  }

  /**
   * Fills a select dropdown
   */
  private async fillSelect(select: Locator, value: string): Promise<void> {
    const options = await select.locator('option').all();

    if (options.length === 0) return;

    // Fast: select first non-empty option
    if (this.strategy === 'fast') {
      if (options.length > 1) {
        await select.selectOption({ index: 1 }); // Skip placeholder
      }
      return;
    }

    // Random: select random option
    if (this.strategy === 'random') {
      const randomIndex = Math.floor(Math.random() * options.length);
      await select.selectOption({ index: randomIndex });
      return;
    }

    // Careful: select meaningful option based on value
    for (let i = 0; i < options.length; i++) {
      const optionText = await options[i].textContent();
      if (optionText && optionText.toLowerCase().includes(value.toLowerCase())) {
        await select.selectOption({ index: i });
        return;
      }
    }

    // Default: select second option (skip placeholder)
    if (options.length > 1) {
      await select.selectOption({ index: 1 });
    }
  }

  /**
   * Generates a value for a field based on its type and strategy
   */
  private generateValue(field: FormField): string {
    // Random strategy: use edge case values
    if (this.strategy === 'random') {
      return this.getRandomEdgeCaseValue(field.type);
    }

    // Careful or Fast: use realistic values
    return this.getRealisticValue(field);
  }

  /**
   * Generates realistic values based on field characteristics
   */
  private getRealisticValue(field: FormField): string {
    const name = (field.name || field.placeholder || '').toLowerCase();

    // Email fields
    if (field.type === 'email' || name.includes('email')) {
      return 'test.user@example.com';
    }

    // Password fields
    if (field.type === 'password' || name.includes('password')) {
      return 'TestPassword123!';
    }

    // Phone fields
    if (field.type === 'tel' || name.includes('phone') || name.includes('tel')) {
      return '555-123-4567';
    }

    // Number fields
    if (field.type === 'number' || name.includes('age') || name.includes('quantity')) {
      return '25';
    }

    // URL fields
    if (field.type === 'url' || name.includes('website') || name.includes('url')) {
      return 'https://example.com';
    }

    // Date fields
    if (field.type === 'date' || name.includes('date')) {
      return '2025-01-15';
    }

    // Name fields
    if (name.includes('name') || name.includes('first') || name.includes('last')) {
      return name.includes('first') ? 'John' : name.includes('last') ? 'Doe' : 'John Doe';
    }

    // Address fields
    if (name.includes('address') || name.includes('street')) {
      return '123 Main Street';
    }

    if (name.includes('city')) {
      return 'San Francisco';
    }

    if (name.includes('state') || name.includes('province')) {
      return 'CA';
    }

    if (name.includes('zip') || name.includes('postal')) {
      return '94102';
    }

    if (name.includes('country')) {
      return 'United States';
    }

    // Textarea
    if (field.type === 'textarea' || name.includes('comment') || name.includes('message')) {
      return 'This is a test message from the Shadow User Agent.';
    }

    // Default text
    return 'Test Input';
  }

  /**
   * Generates edge case values for random strategy
   */
  private getRandomEdgeCaseValue(_type: string): string {
    const edgeCases = [
      '', // Empty string
      ' ', // Single space
      '<script>alert("test")</script>', // XSS attempt
      "'; DROP TABLE users; --", // SQL injection attempt
      '../../../etc/passwd', // Path traversal
      '😀🎉💀', // Emojis
      'A'.repeat(1000), // Very long string
      '!@#$%^&*()', // Special characters
      '\n\n\n', // Newlines
      '   leading and trailing spaces   ',
    ];

    return edgeCases[Math.floor(Math.random() * edgeCases.length)];
  }
}
