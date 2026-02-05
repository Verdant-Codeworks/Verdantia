/**
 * Context object for template rendering.
 * Supports nested objects with dot-notation access.
 */
export interface TemplateContext {
  [key: string]: any;
}

/**
 * Parsed template tokens.
 * Each token represents a portion of the template string.
 */
export type TemplateToken =
  | { type: 'text'; value: string }
  | { type: 'variable'; path: string }
  | { type: 'choice'; options: string[] }
  | { type: 'conditional'; condition: string; trueValue: string; falseValue?: string }
  | { type: 'reference'; templateName: string }
  | { type: 'directional'; direction: string; path: string };
