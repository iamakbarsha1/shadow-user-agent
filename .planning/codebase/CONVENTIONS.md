# Coding Conventions

**Analysis Date:** 2026-03-23

## Naming Patterns

**Files:**
- Source modules: `camelCase.ts` (e.g., `personaEngine.ts`, `claudeClient.ts`, `urlValidator.ts`)
- Classes: `PascalCase.ts` matching the class name (e.g., `observer.ts` exports `Observer`, `formFiller.ts` exports `FormFiller`)
- Test directories: `__tests__/` co-located within each module directory
- Test files: `<module>.test.ts` (e.g., `personaEngine.test.ts`, `urlValidator.test.ts`)

**Functions:**
- Exported functions: `camelCase` (e.g., `getPersonaConfig`, `validateTargetUrl`, `analyzeWithClaude`)
- Internal functions: `camelCase`
- Factory/builder functions: `build<X>` or `create<X>` prefix (e.g., `buildSessionAnalysisPrompt`, `createApp`, `createMockRun`)

**Variables:**
- Local variables: `camelCase`
- Constants/config objects: `UPPER_SNAKE_CASE` for module-level (e.g., `PERSONAS`, `REQUIRED_ENV_VARS`)
- Boolean variables: descriptive names (e.g., `isDevelopment`, `isChecked`)

**Types and Interfaces:**
- TypeScript interfaces: `PascalCase` (e.g., `PersonaConfig`, `SessionLog`, `AnalysisReport`)
- Type aliases: `PascalCase` (e.g., `PersonaId`)
- Prefer interfaces over type aliases for object shapes (per CLAUDE.md guidelines)

**Classes:**
- `PascalCase` (e.g., `Observer`, `FormFiller`)
- Custom error classes: `<Purpose>Error` pattern (e.g., `InvalidUrlError`, `RunNotFoundError`, `AITimeoutError`)

## Code Style

**Formatting tool:** Prettier (`/.prettierrc.json`)

**Key settings:**
- `semi: true` — semicolons required
- `singleQuote: true` — single quotes for strings
- `trailingComma: 'es5'` — trailing commas in objects and arrays
- `printWidth: 100` — max line length 100 characters
- `tabWidth: 2` — 2-space indentation
- `useTabs: false` — spaces only
- `arrowParens: 'always'` — always parenthesize arrow function args
- `endOfLine: 'lf'` — LF line endings

**Linting tool:** ESLint (`/.eslintrc.json`)

**Key enforced rules:**
- `@typescript-eslint/no-explicit-any: error` — `any` type is banned; use `unknown` with type guards
- `@typescript-eslint/explicit-function-return-type: warn` — explicit return types required on all functions
- `@typescript-eslint/explicit-module-boundary-types: warn` — module exports must be typed
- `@typescript-eslint/no-unused-vars: error` — unused vars disallowed (prefix `_` to ignore)
- `@typescript-eslint/no-floating-promises: error` — all promises must be awaited or handled
- `no-console: warn` — `console.log` is disallowed; `console.warn` and `console.error` are permitted

**ESLint ignores:** `dist/`, `node_modules/`, `*.config.ts`, `frontend/**`, `prisma/**`, `tests/**`, all `__tests__/` directories and `*.test.ts` files.

## TypeScript Configuration (`/tsconfig.json`)

**Strict mode:** `"strict": true` — full strictness enabled

**Additional strict flags:**
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noImplicitReturns: true`
- `noFallthroughCasesInSwitch: true`
- `isolatedModules: true`

**Target:** ES2022, CommonJS modules, Node resolution

**Path aliases:** None detected — imports use relative paths.

## Import Organization

**Order observed in source files:**
1. Third-party packages (e.g., `import Anthropic from '@anthropic-ai/sdk'`)
2. Internal utilities (e.g., `import { logger } from '../utils/logger'`)
3. Internal types (e.g., `import type { PersonaConfig } from '../types/persona'`)

**Type-only imports:** Use `import type { ... }` syntax for type-only imports (e.g., `import type { Express } from 'express'`).

**No barrel files (index.ts):** Each file is imported directly by path.

## Error Handling

**Pattern:** All errors extend custom typed error classes defined in `src/utils/errors.ts`.

**Custom error class structure:**
```typescript
export class InvalidUrlError extends Error {
  code = 'INVALID_URL';  // machine-readable code used in API responses
  constructor(url: string) {
    super(`URL is invalid or not reachable: ${url}`);
    this.name = 'InvalidUrlError';  // name always set explicitly
  }
}
```

**Available error classes in `src/utils/errors.ts`:**
- `InvalidUrlError` — `code: 'INVALID_URL'`
- `UnknownPersonaError` — `code: 'UNKNOWN_PERSONA'`
- `RunNotFoundError` — `code: 'RUN_NOT_FOUND'`
- `ReportNotFoundError` — `code: 'REPORT_NOT_FOUND'`
- `UnauthorizedError` — `code: 'UNAUTHORIZED'`
- `RunLimitExceededError` — `code: 'RUN_LIMIT_EXCEEDED'`
- `AgentCrashError` — `code: 'AGENT_CRASH'`
- `AITimeoutError` — `code: 'AI_TIMEOUT'`
- `InsufficientCreditsError` — `code: 'INSUFFICIENT_CREDITS'`, has `availableTokens: number` property

**API error response format:**
```json
{
  "error": {
    "code": "INVALID_URL",
    "message": "The provided URL is not reachable or is malformed.",
    "details": {}
  }
}
```

**Never use plain `new Error()`** for application errors; always use a typed class.

## Logging

**Framework:** `pino` — imported as `import { logger } from '../utils/logger'`

**Logger configured at:** `src/utils/logger.ts`
- Development: `pino-pretty` transport with colorized output, `HH:MM:ss` timestamps
- Production: raw JSON output
- Log level: `process.env.LOG_LEVEL || 'info'`
- Error serializers: `pino.stdSerializers.err` for both `error` and `err` keys

**Call patterns:**
```typescript
logger.info({ runId, personaId }, 'Agent run started');
logger.error({ err, runId }, 'Agent process crashed');
logger.warn({ url }, 'Blocked SSRF attempt');
logger.debug({ payload }, 'Observation captured');
```

**Rule:** Never use `console.log` in application code. ESLint enforces this. `console.warn` and `console.error` are allowed but `pino` is preferred for structured logging.

## Code Documentation

**JSDoc required on all exported functions.** Example from `src/agent/personaEngine.ts`:
```typescript
/**
 * Retrieves the configuration for a given persona.
 * Throws UnknownPersonaError if the persona ID is not recognized.
 *
 * @param personaId - The ID of the persona to retrieve
 * @returns PersonaConfig object containing all persona settings
 * @throws {UnknownPersonaError} If personaId is not valid
 */
export function getPersonaConfig(personaId: string): PersonaConfig {
```

**Module-level JSDoc comments** are used at the top of files to describe purpose:
```typescript
/**
 * Application-wide logger using pino.
 * Configured with pretty printing in development and JSON output in production.
 */
```

**Inline comments** used for non-obvious logic (e.g., explaining why a timeout is used, why a workaround exists).

## Git Conventions

**Commit format:** Conventional Commits
- `feat:` — new features
- `fix:` — bug fixes
- `chore:` — maintenance tasks
- `test:` — test changes
- `docs:` — documentation
- `refactor:` — refactoring without behavior change

**Branch prefixes:**
- `feature/` — new features
- `fix/` — bug fixes
- `chore/` — maintenance

**PR rules:**
- Max 400 lines per PR
- At least one reviewer required
- Tests must pass before merge

## Module Design

**Exports:** Named exports are preferred over default exports for utility modules and functions. Default exports used only for framework entry points (e.g., Express app, config files).

**Class vs functions:** Classes used for stateful components (`Observer`, `FormFiller`). Plain functions used for stateless utilities (`getPersonaConfig`, `validateTargetUrl`, `analyzeWithClaude`).

---

*Convention analysis: 2026-03-23*
