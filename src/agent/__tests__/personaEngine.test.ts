import { describe, it, expect } from 'vitest';
import {
  getPersonaConfig,
  isValidPersonaId,
  getAllPersonaIds,
  getAllPersonas,
} from '../personaEngine';
import { UnknownPersonaError } from '../../utils/errors';

describe('Persona Engine', () => {
  describe('getPersonaConfig', () => {
    it('should return config for new_user persona', () => {
      const config = getPersonaConfig('new_user');

      expect(config.id).toBe('new_user');
      expect(config.label).toBe('New User');
      expect(config.navigationSpeed).toBe('slow');
      expect(config.maxSteps).toBe(25);
      expect(config.formFillStrategy).toBe('careful');
      expect(config.errorTolerance).toBe('abort');
      expect(config.viewportWidth).toBe(1280);
      expect(config.viewportHeight).toBe(800);
      expect(config.promptContext).toContain('first-time user');
      expect(config.userAgentOverride).toBeUndefined();
    });

    it('should return config for power_user persona', () => {
      const config = getPersonaConfig('power_user');

      expect(config.id).toBe('power_user');
      expect(config.label).toBe('Power User');
      expect(config.navigationSpeed).toBe('fast');
      expect(config.maxSteps).toBe(50);
      expect(config.formFillStrategy).toBe('fast');
      expect(config.errorTolerance).toBe('continue');
      expect(config.viewportWidth).toBe(1920);
      expect(config.viewportHeight).toBe(1080);
      expect(config.promptContext).toContain('power user');
    });

    it('should return config for mobile_user persona', () => {
      const config = getPersonaConfig('mobile_user');

      expect(config.id).toBe('mobile_user');
      expect(config.label).toBe('Mobile User');
      expect(config.navigationSpeed).toBe('normal');
      expect(config.maxSteps).toBe(30);
      expect(config.formFillStrategy).toBe('careful');
      expect(config.errorTolerance).toBe('continue');
      expect(config.viewportWidth).toBe(390);
      expect(config.viewportHeight).toBe(844);
      expect(config.userAgentOverride).toContain('iPhone');
      expect(config.promptContext).toContain('iPhone 14');
    });

    it('should return config for edge_case persona', () => {
      const config = getPersonaConfig('edge_case');

      expect(config.id).toBe('edge_case');
      expect(config.label).toBe('Edge-Case User');
      expect(config.navigationSpeed).toBe('normal');
      expect(config.maxSteps).toBe(40);
      expect(config.formFillStrategy).toBe('random');
      expect(config.errorTolerance).toBe('retry');
      expect(config.viewportWidth).toBe(1280);
      expect(config.viewportHeight).toBe(800);
      expect(config.promptContext).toContain('stresses the application');
    });

    it('should throw UnknownPersonaError for invalid persona', () => {
      expect(() => getPersonaConfig('invalid_persona')).toThrow(UnknownPersonaError);
      expect(() => getPersonaConfig('invalid_persona')).toThrow(
        'Unknown persona ID: invalid_persona'
      );
    });

    it('should throw UnknownPersonaError for empty string', () => {
      expect(() => getPersonaConfig('')).toThrow(UnknownPersonaError);
    });

    it('should throw UnknownPersonaError for similar but wrong ID', () => {
      expect(() => getPersonaConfig('newuser')).toThrow(UnknownPersonaError);
      expect(() => getPersonaConfig('new-user')).toThrow(UnknownPersonaError);
      expect(() => getPersonaConfig('NEW_USER')).toThrow(UnknownPersonaError);
    });
  });

  describe('isValidPersonaId', () => {
    it('should return true for valid persona IDs', () => {
      expect(isValidPersonaId('new_user')).toBe(true);
      expect(isValidPersonaId('power_user')).toBe(true);
      expect(isValidPersonaId('mobile_user')).toBe(true);
      expect(isValidPersonaId('edge_case')).toBe(true);
    });

    it('should return false for invalid persona IDs', () => {
      expect(isValidPersonaId('invalid')).toBe(false);
      expect(isValidPersonaId('')).toBe(false);
      expect(isValidPersonaId('new-user')).toBe(false);
      expect(isValidPersonaId('NEW_USER')).toBe(false);
    });
  });

  describe('getAllPersonaIds', () => {
    it('should return all 5 persona IDs', () => {
      const ids = getAllPersonaIds();

      expect(ids).toHaveLength(5);
      expect(ids).toContain('new_user');
      expect(ids).toContain('power_user');
      expect(ids).toContain('mobile_user');
      expect(ids).toContain('edge_case');
      expect(ids).toContain('security_scanner');
    });

    it('should return array of strings', () => {
      const ids = getAllPersonaIds();

      ids.forEach((id) => {
        expect(typeof id).toBe('string');
      });
    });
  });

  describe('getAllPersonas', () => {
    it('should return all 5 persona configs', () => {
      const personas = getAllPersonas();

      expect(personas).toHaveLength(5);
    });

    it('should return valid PersonaConfig objects', () => {
      const personas = getAllPersonas();

      personas.forEach((persona) => {
        expect(persona).toHaveProperty('id');
        expect(persona).toHaveProperty('label');
        expect(persona).toHaveProperty('description');
        expect(persona).toHaveProperty('navigationSpeed');
        expect(persona).toHaveProperty('maxSteps');
        expect(persona).toHaveProperty('formFillStrategy');
        expect(persona).toHaveProperty('errorTolerance');
        expect(persona).toHaveProperty('viewportWidth');
        expect(persona).toHaveProperty('viewportHeight');
        expect(persona).toHaveProperty('promptContext');

        // Validate types
        expect(['new_user', 'power_user', 'mobile_user', 'edge_case', 'security_scanner']).toContain(
          persona.id
        );
        expect(['slow', 'normal', 'fast']).toContain(persona.navigationSpeed);
        expect(['careful', 'fast', 'random']).toContain(persona.formFillStrategy);
        expect(['abort', 'continue', 'retry']).toContain(persona.errorTolerance);
        expect(typeof persona.maxSteps).toBe('number');
        expect(typeof persona.viewportWidth).toBe('number');
        expect(typeof persona.viewportHeight).toBe('number');
        expect(typeof persona.promptContext).toBe('string');
      });
    });

    it('should include mobile_user with userAgentOverride', () => {
      const personas = getAllPersonas();
      const mobileUser = personas.find((p) => p.id === 'mobile_user');

      expect(mobileUser).toBeDefined();
      expect(mobileUser?.userAgentOverride).toBeDefined();
      expect(mobileUser?.userAgentOverride).toContain('iPhone');
    });

    it('should have correct viewport for mobile_user (390x844)', () => {
      const personas = getAllPersonas();
      const mobileUser = personas.find((p) => p.id === 'mobile_user');

      expect(mobileUser?.viewportWidth).toBe(390);
      expect(mobileUser?.viewportHeight).toBe(844);
    });

    it('should have correct maxSteps for each persona', () => {
      const personas = getAllPersonas();

      const newUser = personas.find((p) => p.id === 'new_user');
      expect(newUser?.maxSteps).toBe(25);

      const powerUser = personas.find((p) => p.id === 'power_user');
      expect(powerUser?.maxSteps).toBe(50);

      const mobileUser = personas.find((p) => p.id === 'mobile_user');
      expect(mobileUser?.maxSteps).toBe(30);

      const edgeCase = personas.find((p) => p.id === 'edge_case');
      expect(edgeCase?.maxSteps).toBe(40);
    });
  });

  describe('Persona behavior characteristics', () => {
    it('new_user should be slow and careful', () => {
      const config = getPersonaConfig('new_user');

      expect(config.navigationSpeed).toBe('slow');
      expect(config.formFillStrategy).toBe('careful');
      expect(config.errorTolerance).toBe('abort');
    });

    it('power_user should be fast and tolerant', () => {
      const config = getPersonaConfig('power_user');

      expect(config.navigationSpeed).toBe('fast');
      expect(config.formFillStrategy).toBe('fast');
      expect(config.errorTolerance).toBe('continue');
      expect(config.maxSteps).toBeGreaterThan(40); // Most steps
    });

    it('mobile_user should have mobile viewport', () => {
      const config = getPersonaConfig('mobile_user');

      expect(config.viewportWidth).toBeLessThan(500);
      expect(config.userAgentOverride).toBeDefined();
    });

    it('edge_case should use random strategy with retry', () => {
      const config = getPersonaConfig('edge_case');

      expect(config.formFillStrategy).toBe('random');
      expect(config.errorTolerance).toBe('retry');
    });
  });
});
