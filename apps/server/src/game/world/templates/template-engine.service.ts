import { Injectable, Logger } from '@nestjs/common';
import type { TemplateContext, TemplateToken } from './template.types';

/**
 * Template Engine Service
 *
 * Provides deterministic template rendering with support for:
 * - Variable substitution: {variable} or {object.nested.path}
 * - Random choices: {$option1|option2|option3}
 * - Conditionals: {?condition:true text} or {?condition:true text|false text}
 * - Template references: {@templateName}
 * - Directional context: {#north.biome}
 *
 * All random operations are seeded for determinism - same seed produces same output.
 */
@Injectable()
export class TemplateEngineService {
  private readonly logger = new Logger(TemplateEngineService.name);
  private static readonly MAX_REFERENCE_DEPTH = 10;

  /**
   * Parse a template string into tokens.
   *
   * @param template - Template string with embedded syntax
   * @returns Array of parsed tokens
   */
  parse(template: string): TemplateToken[] {
    const tokens: TemplateToken[] = [];
    let position = 0;

    while (position < template.length) {
      const openBrace = template.indexOf('{', position);

      if (openBrace === -1) {
        // No more tokens, rest is plain text
        if (position < template.length) {
          tokens.push({ type: 'text', value: template.slice(position) });
        }
        break;
      }

      // Add any plain text before the token
      if (openBrace > position) {
        tokens.push({ type: 'text', value: template.slice(position, openBrace) });
      }

      const closeBrace = this.findMatchingCloseBrace(template, openBrace);
      if (closeBrace === -1) {
        // Malformed template - treat rest as text
        tokens.push({ type: 'text', value: template.slice(openBrace) });
        break;
      }

      const content = template.slice(openBrace + 1, closeBrace);
      const token = this.parseToken(content);
      tokens.push(token);

      position = closeBrace + 1;
    }

    return tokens;
  }

  /**
   * Find the matching closing brace for an opening brace.
   * Returns -1 if not found.
   */
  private findMatchingCloseBrace(template: string, openIndex: number): number {
    let depth = 1;
    for (let i = openIndex + 1; i < template.length; i++) {
      const char = template[i];
      if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0) {
          return i;
        }
      }
    }
    return -1;
  }

  /**
   * Find the index of a pipe character at brace nesting level 0.
   * Returns -1 if not found.
   */
  private findTopLevelPipe(text: string): number {
    let braceDepth = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '{') {
        braceDepth++;
      } else if (char === '}') {
        braceDepth--;
      } else if (char === '|' && braceDepth === 0) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Parse a single token content (the text between { and }).
   */
  private parseToken(content: string): TemplateToken {
    if (!content) {
      return { type: 'text', value: '' };
    }

    const firstChar = content[0];

    // Random choice: {$option1|option2|option3}
    if (firstChar === '$') {
      const options = content.slice(1).split('|').map(s => s.trim());
      return { type: 'choice', options };
    }

    // Conditional: {?condition:true text} or {?condition:true text|false text}
    if (firstChar === '?') {
      const colonIndex = content.indexOf(':');
      if (colonIndex === -1) {
        // Malformed conditional - treat as text
        return { type: 'text', value: `{${content}}` };
      }

      const condition = content.slice(1, colonIndex).trim();
      const rest = content.slice(colonIndex + 1);

      // Find the pipe separator at brace nesting level 0
      const pipeIndex = this.findTopLevelPipe(rest);

      if (pipeIndex === -1) {
        // No else clause
        return { type: 'conditional', condition, trueValue: rest };
      } else {
        // Has else clause
        const trueValue = rest.slice(0, pipeIndex);
        const falseValue = rest.slice(pipeIndex + 1);
        return { type: 'conditional', condition, trueValue, falseValue };
      }
    }

    // Template reference: {@templateName}
    if (firstChar === '@') {
      const templateName = content.slice(1).trim();
      return { type: 'reference', templateName };
    }

    // Directional reference: {#north.biome}
    if (firstChar === '#') {
      const dotIndex = content.indexOf('.');
      if (dotIndex === -1) {
        // Malformed directional - treat as text
        return { type: 'text', value: `{${content}}` };
      }

      const direction = content.slice(1, dotIndex).trim();
      const path = content.slice(dotIndex + 1).trim();
      return { type: 'directional', direction, path };
    }

    // Variable substitution: {variable} or {object.nested.path}
    return { type: 'variable', path: content.trim() };
  }

  /**
   * Render a template with the given context and seed.
   *
   * @param template - Template string to render
   * @param context - Context object with variables
   * @param seed - Seed for deterministic random choices
   * @returns Rendered string
   */
  render(template: string, context: TemplateContext, seed: number): string {
    return this.renderWithDepth(template, context, seed, 0);
  }

  /**
   * Internal render with depth tracking to prevent infinite recursion.
   */
  private renderWithDepth(
    template: string,
    context: TemplateContext,
    seed: number,
    depth: number,
  ): string {
    if (depth >= TemplateEngineService.MAX_REFERENCE_DEPTH) {
      this.logger.warn(`Maximum reference depth (${TemplateEngineService.MAX_REFERENCE_DEPTH}) exceeded`);
      return '[MAX_DEPTH_EXCEEDED]';
    }

    const tokens = this.parse(template);
    const random = this.createSeededRandom(seed);
    let result = '';

    for (const token of tokens) {
      switch (token.type) {
        case 'text':
          result += token.value;
          break;

        case 'variable':
          const value = this.resolvePath(context, token.path);
          result += value !== undefined && value !== null ? String(value) : '';
          break;

        case 'choice':
          if (token.options.length > 0) {
            const index = Math.floor(random() * token.options.length);
            result += token.options[index];
          }
          break;

        case 'conditional': {
          const conditionValue = this.evaluateCondition(token.condition, context);
          if (conditionValue) {
            // Recursively render the true branch
            result += this.renderWithDepth(token.trueValue, context, seed, depth + 1);
          } else if (token.falseValue !== undefined) {
            // Recursively render the false branch
            result += this.renderWithDepth(token.falseValue, context, seed, depth + 1);
          }
          break;
        }

        case 'reference': {
          const templates = context.templates as Record<string, { template: string }> | undefined;
          const referencedTemplate = templates?.[token.templateName];
          if (referencedTemplate) {
            // Render the referenced template with incremented depth
            result += this.renderWithDepth(
              referencedTemplate.template,
              context,
              seed + token.templateName.length, // Vary seed slightly
              depth + 1,
            );
          } else {
            this.logger.warn(`Template reference not found: ${token.templateName}`);
            result += `[@${token.templateName}]`;
          }
          break;
        }

        case 'directional': {
          const directionalContext = context[token.direction];
          if (directionalContext && typeof directionalContext === 'object') {
            const value = this.resolvePath(directionalContext as TemplateContext, token.path);
            result += value !== undefined ? String(value) : '';
          }
          break;
        }
      }
    }

    return result;
  }

  /**
   * Create a seeded random number generator using mulberry32.
   * Same seed always produces the same sequence of numbers.
   *
   * @param seed - Integer seed value
   * @returns Function that returns random numbers in [0, 1)
   */
  private createSeededRandom(seed: number): () => number {
    // Initialize state with a proper hash of the seed
    let state = seed | 0;
    state = Math.imul(state, 0x85ebca6b);
    state = (state ^ (state >>> 13)) | 0;

    return () => {
      // Mulberry32 PRNG algorithm
      state = Math.imul(state ^ (state >>> 15), state | 1);
      state ^= state + Math.imul(state ^ (state >>> 7), state | 61);
      const result = ((state ^ (state >>> 14)) >>> 0) / 4294967296;
      return result;
    };
  }

  /**
   * Resolve a dot-notation path in the context.
   * Example: "settlement.name" resolves to context.settlement.name
   *
   * @param context - Context object
   * @param path - Dot-notation path
   * @returns Resolved value or undefined
   */
  private resolvePath(context: TemplateContext, path: string): any {
    const parts = path.split('.');
    let current: any = context;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  /**
   * Evaluate a conditional expression.
   * Supports simple path lookups and basic comparisons.
   *
   * @param condition - Condition string (e.g., "settlement.problem" or "size === 'city'")
   * @param context - Context object
   * @returns Boolean result
   */
  private evaluateCondition(condition: string, context: TemplateContext): boolean {
    // Handle simple equality comparisons: "variable === 'value'"
    const equalsMatch = condition.match(/^(.+?)\s*===\s*['"](.+?)['"]$/);
    if (equalsMatch) {
      const [, path, expectedValue] = equalsMatch;
      const actualValue = this.resolvePath(context, path.trim());
      return actualValue === expectedValue;
    }

    // Handle includes: "array.includes('value')"
    const includesMatch = condition.match(/^(.+?)\.includes\(['"](.+?)['"]\)$/);
    if (includesMatch) {
      const [, path, searchValue] = includesMatch;
      const array = this.resolvePath(context, path.trim());
      return Array.isArray(array) && array.includes(searchValue);
    }

    // Otherwise, treat as a simple path lookup (truthy check)
    const value = this.resolvePath(context, condition.trim());
    return !!value;
  }
}
