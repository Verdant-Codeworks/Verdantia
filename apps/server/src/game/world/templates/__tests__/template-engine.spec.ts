import { describe, it, expect, beforeEach } from 'vitest';
import { TemplateEngineService } from '../template-engine.service';
import type { TemplateContext } from '../template.types';

describe('TemplateEngineService', () => {
  let service: TemplateEngineService;

  beforeEach(() => {
    service = new TemplateEngineService();
  });

  describe('parse', () => {
    it('should parse plain text', () => {
      const tokens = service.parse('Hello, world!');
      expect(tokens).toEqual([{ type: 'text', value: 'Hello, world!' }]);
    });

    it('should parse variable substitution {variable}', () => {
      const tokens = service.parse('Hello, {name}!');
      expect(tokens).toHaveLength(3);
      expect(tokens[0]).toEqual({ type: 'text', value: 'Hello, ' });
      expect(tokens[1]).toEqual({ type: 'variable', path: 'name' });
      expect(tokens[2]).toEqual({ type: 'text', value: '!' });
    });

    it('should parse dot-notation paths {obj.nested.value}', () => {
      const tokens = service.parse('{user.profile.name}');
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toEqual({ type: 'variable', path: 'user.profile.name' });
    });

    it('should parse random choice {$a|b|c}', () => {
      const tokens = service.parse('{$one|two|three}');
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toEqual({
        type: 'choice',
        options: ['one', 'two', 'three'],
      });
    });

    it('should parse conditional {?cond:text}', () => {
      const tokens = service.parse('{?hasItems:You have items}');
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toEqual({
        type: 'conditional',
        condition: 'hasItems',
        trueValue: 'You have items',
      });
    });

    it('should parse conditional with else {?cond:true|false}', () => {
      const tokens = service.parse('{?hasItems:You have items|You have nothing}');
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toEqual({
        type: 'conditional',
        condition: 'hasItems',
        trueValue: 'You have items',
        falseValue: 'You have nothing',
      });
    });

    it('should parse template reference {@ref}', () => {
      const tokens = service.parse('{@greeting}');
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toEqual({
        type: 'reference',
        templateName: 'greeting',
      });
    });

    it('should parse directional reference {#north.biome}', () => {
      const tokens = service.parse('{#north.biome}');
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toEqual({
        type: 'directional',
        direction: 'north',
        path: 'biome',
      });
    });

    it('should handle mixed content', () => {
      const tokens = service.parse('Hello {name}, you {$stand|sit} in {location.name}.');
      expect(tokens).toHaveLength(7);
      expect(tokens[0]).toEqual({ type: 'text', value: 'Hello ' });
      expect(tokens[1]).toEqual({ type: 'variable', path: 'name' });
      expect(tokens[2]).toEqual({ type: 'text', value: ', you ' });
      expect(tokens[3]).toEqual({ type: 'choice', options: ['stand', 'sit'] });
      expect(tokens[4]).toEqual({ type: 'text', value: ' in ' });
      expect(tokens[5]).toEqual({ type: 'variable', path: 'location.name' });
      expect(tokens[6]).toEqual({ type: 'text', value: '.' });
    });

    it('should handle empty braces', () => {
      const tokens = service.parse('{}');
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toEqual({ type: 'text', value: '' });
    });

    it('should handle malformed templates gracefully', () => {
      const tokens = service.parse('Hello {name');
      // Malformed template (no closing brace) gets treated as:
      // - "Hello " (text)
      // - "{name" (text, since no closing brace)
      expect(tokens).toHaveLength(2);
      expect(tokens[0]).toEqual({ type: 'text', value: 'Hello ' });
      expect(tokens[1]).toEqual({ type: 'text', value: '{name' });
    });
  });

  describe('render', () => {
    it('should substitute variables', () => {
      const context: TemplateContext = { name: 'Alice' };
      const result = service.render('Hello, {name}!', context, 123);
      expect(result).toBe('Hello, Alice!');
    });

    it('should resolve nested paths', () => {
      const context: TemplateContext = {
        user: {
          profile: {
            name: 'Bob',
          },
        },
      };
      const result = service.render('User: {user.profile.name}', context, 123);
      expect(result).toBe('User: Bob');
    });

    it('should make deterministic random choices with same seed', () => {
      const template = '{$one|two|three}';
      const context: TemplateContext = {};
      const result1 = service.render(template, context, 42);
      const result2 = service.render(template, context, 42);
      expect(result1).toBe(result2);
    });

    it('should make different choices with different seeds', () => {
      const template = '{$one|two|three}';
      const context: TemplateContext = {};
      const results = new Set<string>();

      // Generate 20 results with different seeds
      for (let i = 0; i < 20; i++) {
        results.add(service.render(template, context, i));
      }

      // Should have gotten at least 2 different results
      expect(results.size).toBeGreaterThan(1);
      // All results should be valid options
      results.forEach(result => {
        expect(['one', 'two', 'three']).toContain(result);
      });
    });

    it('should render truthy conditionals', () => {
      const context: TemplateContext = { hasItems: true };
      const result = service.render('{?hasItems:You have items}', context, 123);
      expect(result).toBe('You have items');
    });

    it('should skip falsy conditionals', () => {
      const context: TemplateContext = { hasItems: false };
      const result = service.render('{?hasItems:You have items}', context, 123);
      expect(result).toBe('');
    });

    it('should render else branch for falsy conditionals', () => {
      const context: TemplateContext = { hasItems: false };
      const result = service.render(
        '{?hasItems:You have items|You have nothing}',
        context,
        123,
      );
      expect(result).toBe('You have nothing');
    });

    it('should handle conditional with path lookup', () => {
      const context: TemplateContext = {
        user: { hasItems: true },
      };
      const result = service.render('{?user.hasItems:Yes|No}', context, 123);
      expect(result).toBe('Yes');
    });

    it('should handle conditional with equality comparison', () => {
      const context: TemplateContext = { size: 'city' };
      const result = service.render('{?size === \'city\':Big place|Small place}', context, 123);
      expect(result).toBe('Big place');
    });

    it('should handle conditional with includes check', () => {
      const context: TemplateContext = {
        tags: ['trading', 'coastal'],
      };
      const result = service.render(
        '{?tags.includes(\'trading\'):This is a trading post|Not a trading post}',
        context,
        123,
      );
      expect(result).toBe('This is a trading post');
    });

    it('should resolve template references', () => {
      const context: TemplateContext = {
        templates: {
          greeting: { template: 'Hello, {name}!' },
        },
        name: 'Alice',
      };
      const result = service.render('{@greeting}', context, 123);
      expect(result).toBe('Hello, Alice!');
    });

    it('should resolve nested template references', () => {
      const context: TemplateContext = {
        templates: {
          outer: { template: 'Outer: {@inner}' },
          inner: { template: 'Inner: {value}' },
        },
        value: 42,
      };
      const result = service.render('{@outer}', context, 123);
      expect(result).toBe('Outer: Inner: 42');
    });

    it('should handle missing template references gracefully', () => {
      const context: TemplateContext = {
        templates: {},
      };
      const result = service.render('{@missing}', context, 123);
      expect(result).toBe('[@missing]');
    });

    it('should resolve directional context', () => {
      const context: TemplateContext = {
        north: {
          biome: 'forest',
        },
      };
      const result = service.render('To the north: {#north.biome}', context, 123);
      expect(result).toBe('To the north: forest');
    });

    it('should handle missing directional context gracefully', () => {
      const context: TemplateContext = {};
      const result = service.render('To the north: {#north.biome}', context, 123);
      expect(result).toBe('To the north: ');
    });

    it('should handle missing variables gracefully', () => {
      const context: TemplateContext = {};
      const result = service.render('Hello, {name}!', context, 123);
      expect(result).toBe('Hello, !');
    });

    it('should handle undefined nested paths gracefully', () => {
      const context: TemplateContext = { user: {} };
      const result = service.render('{user.profile.name}', context, 123);
      expect(result).toBe('');
    });

    it('should render complex template with multiple token types', () => {
      const context: TemplateContext = {
        settlement: {
          name: 'Riverdale',
          size: 'town',
          problem: {
            shortDesc: 'missing livestock',
          },
        },
      };
      const template =
        'You {$arrive at|approach} the {settlement.size} of {settlement.name}. ' +
        '{?settlement.problem:Worried villagers speak about {settlement.problem.shortDesc}.|All is peaceful.}';

      const result = service.render(template, context, 42);
      expect(result).toMatch(/^You (arrive at|approach) the town of Riverdale\. /);
      expect(result).toContain('Worried villagers speak about missing livestock.');
    });
  });

  describe('determinism', () => {
    it('should produce identical output for identical inputs', () => {
      const template =
        'You {$stand|sit|lie} in {location.name}. ' +
        '{?hasEnemy:A {enemy.name} approaches!|All is quiet.} ' +
        '{@weather}';

      const context: TemplateContext = {
        location: { name: 'the forest' },
        hasEnemy: true,
        enemy: { name: 'goblin' },
        templates: {
          weather: { template: 'The sky is {$clear|cloudy|stormy}.' },
        },
      };

      const seed = 12345;
      const result1 = service.render(template, context, seed);
      const result2 = service.render(template, context, seed);
      const result3 = service.render(template, context, seed);

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });

    it('should produce different output for different seeds', () => {
      const template = '{$one|two|three|four|five}';
      const context: TemplateContext = {};

      const result1 = service.render(template, context, 1);
      const result2 = service.render(template, context, 2);
      const result3 = service.render(template, context, 3);

      const results = [result1, result2, result3];
      const uniqueResults = new Set(results);

      // With 5 options and 3 different seeds, we should get at least 2 unique results
      expect(uniqueResults.size).toBeGreaterThan(1);
    });

    it('should maintain determinism across template references', () => {
      const context: TemplateContext = {
        templates: {
          choice1: { template: '{$a|b|c}' },
          choice2: { template: '{$x|y|z}' },
        },
      };

      const template = '{@choice1} and {@choice2}';
      const seed = 999;

      const result1 = service.render(template, context, seed);
      const result2 = service.render(template, context, seed);

      expect(result1).toBe(result2);
    });
  });

  describe('edge cases', () => {
    it('should handle empty template', () => {
      const result = service.render('', {}, 123);
      expect(result).toBe('');
    });

    it('should handle template with only whitespace', () => {
      const result = service.render('   ', {}, 123);
      expect(result).toBe('   ');
    });

    it('should handle empty choice options', () => {
      const result = service.render('{$}', {}, 123);
      expect(result).toBe('');
    });

    it('should trim whitespace in choice options', () => {
      const context: TemplateContext = {};
      const result = service.render('{$one | two | three}', context, 123);
      expect(['one', 'two', 'three']).toContain(result);
    });

    it('should handle null values in context', () => {
      const context: TemplateContext = { value: null };
      const result = service.render('{value}', context, 123);
      expect(result).toBe('');
    });

    it('should handle numeric values in context', () => {
      const context: TemplateContext = { count: 42 };
      const result = service.render('Count: {count}', context, 123);
      expect(result).toBe('Count: 42');
    });

    it('should handle boolean values in context', () => {
      const context: TemplateContext = { isActive: true };
      const result = service.render('Active: {isActive}', context, 123);
      expect(result).toBe('Active: true');
    });

    it('should prevent infinite recursion in template references', () => {
      const context: TemplateContext = {
        templates: {
          recursive: { template: 'Loop: {@recursive}' },
        },
      };

      const result = service.render('{@recursive}', context, 123);
      expect(result).toContain('[MAX_DEPTH_EXCEEDED]');
    });

    it('should handle deeply nested but valid template references', () => {
      const context: TemplateContext = {
        templates: {
          level1: { template: '{@level2}' },
          level2: { template: '{@level3}' },
          level3: { template: '{@level4}' },
          level4: { template: 'Bottom' },
        },
      };

      const result = service.render('{@level1}', context, 123);
      expect(result).toBe('Bottom');
    });
  });
});
