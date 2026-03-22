/**
 * Persona-related type definitions
 */

export type PersonaId = 'new_user' | 'power_user' | 'mobile_user' | 'edge_case';

export type NavigationSpeed = 'slow' | 'normal' | 'fast';

export type FormFillStrategy = 'careful' | 'fast' | 'random';

export type ErrorTolerance = 'abort' | 'continue' | 'retry';

export interface PersonaConfig {
  id: PersonaId;
  label: string;
  description: string;
  navigationSpeed: NavigationSpeed;
  maxSteps: number;
  formFillStrategy: FormFillStrategy;
  errorTolerance: ErrorTolerance;
  viewportWidth: number;
  viewportHeight: number;
  userAgentOverride?: string;
  promptContext: string;
}
