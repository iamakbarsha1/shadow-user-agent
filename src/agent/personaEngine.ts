import type { PersonaConfig, PersonaId } from '../types/persona';
import { UnknownPersonaError } from '../utils/errors';

/**
 * Persona Engine
 *
 * Defines 4 user archetypes that drive both Playwright navigation and AI analysis.
 * Each persona represents a realistic user behavior pattern.
 */

const PERSONAS: Record<PersonaId, PersonaConfig> = {
  new_user: {
    id: 'new_user',
    label: 'New User',
    description:
      'First-time visitor with no product knowledge. Explores slowly, reads labels, gets confused by jargon, gives up if blocked.',
    navigationSpeed: 'slow',
    maxSteps: 25,
    formFillStrategy: 'careful',
    errorTolerance: 'abort',
    viewportWidth: 1280,
    viewportHeight: 800,
    promptContext:
      'You are a first-time user visiting this app. You have no prior knowledge of its features. You read every label carefully before clicking. If anything is confusing or broken, you stop and note it. You do not know to try workarounds.',
  },

  power_user: {
    id: 'power_user',
    label: 'Power User',
    description:
      'Experienced user who navigates fast, uses keyboard shortcuts, skips instructions, and expects everything to work instantly.',
    navigationSpeed: 'fast',
    maxSteps: 50,
    formFillStrategy: 'fast',
    errorTolerance: 'continue',
    viewportWidth: 1920,
    viewportHeight: 1080,
    promptContext:
      'You are a power user who knows web apps well. You navigate fast, click through flows confidently, and notice immediately when things are slower than expected, have visual glitches, or behave inconsistently. You note performance and responsiveness issues.',
  },

  mobile_user: {
    id: 'mobile_user',
    label: 'Mobile User',
    description:
      'User on a small screen with touch interactions. Sensitive to layout breaks, oversized elements, and horizontal scroll.',
    navigationSpeed: 'normal',
    maxSteps: 30,
    formFillStrategy: 'careful',
    errorTolerance: 'continue',
    viewportWidth: 390,
    viewportHeight: 844,
    userAgentOverride:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
    promptContext:
      'You are a user on an iPhone 14 with a 390px viewport. You are sensitive to elements that overflow the screen, text that is too small to tap, buttons that are too close together, and pages that require horizontal scrolling.',
  },

  edge_case: {
    id: 'edge_case',
    label: 'Edge-Case User',
    description:
      'Intentionally tries to break the app. Submits empty forms, uses special characters, navigates back mid-flow, opens multiple tabs.',
    navigationSpeed: 'normal',
    maxSteps: 40,
    formFillStrategy: 'random',
    errorTolerance: 'retry',
    viewportWidth: 1280,
    viewportHeight: 800,
    promptContext:
      'You are a user who accidentally stresses the application. You submit forms with empty fields, paste special characters into text inputs, press the browser back button mid-transaction, and refresh at unexpected moments. Note every error, blank screen, or unexpected behaviour that results.',
  },

  security_scanner: {
    id: 'security_scanner',
    label: 'Security Scanner',
    description:
      'Specialized agent that probes for XSS, CSRF, insecure headers, cookie flags, open redirects, mixed content, and clickjacking vulnerabilities.',
    navigationSpeed: 'fast',
    maxSteps: 50,
    formFillStrategy: 'random',
    errorTolerance: 'continue',
    viewportWidth: 1280,
    viewportHeight: 800,
    promptContext: 'You are a security scanner probing for vulnerabilities.',
  },
};

/**
 * Retrieves the configuration for a given persona.
 * Throws UnknownPersonaError if the persona ID is not recognized.
 *
 * @param personaId - The ID of the persona to retrieve
 * @returns PersonaConfig object containing all persona settings
 * @throws {UnknownPersonaError} If personaId is not valid
 */
export function getPersonaConfig(personaId: string): PersonaConfig {
  if (!isValidPersonaId(personaId)) {
    throw new UnknownPersonaError(personaId);
  }

  return PERSONAS[personaId];
}

/**
 * Validates if a string is a valid persona ID.
 *
 * @param personaId - The ID to validate
 * @returns True if valid, false otherwise
 */
export function isValidPersonaId(personaId: string): personaId is PersonaId {
  return personaId in PERSONAS;
}

/**
 * Returns all available persona IDs.
 *
 * @returns Array of all persona IDs
 */
export function getAllPersonaIds(): PersonaId[] {
  return Object.keys(PERSONAS) as PersonaId[];
}

/**
 * Returns all persona configurations.
 *
 * @returns Array of all PersonaConfig objects
 */
export function getAllPersonas(): PersonaConfig[] {
  return Object.values(PERSONAS);
}
