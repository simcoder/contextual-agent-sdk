/**
 * Tools module entry point
 * 
 * Exports all tool-related interfaces and implementations.
 * This is a completely new module that adds tool functionality without
 * affecting existing SDK features.
 */

// Core implementations
export { BaseToolProvider } from './ToolProvider';
export { ToolRegistry } from './ToolRegistry';
export { ToolProviderUtils } from './ToolProvider';

// Tool providers
export * from './providers';

// Re-export all types for convenience
export * from './types';

// Re-export the main interfaces with cleaner names
export type { ToolProvider } from './types/providers';
export type { ToolRegistry as IToolRegistry } from './types/registry';

/**
 * Default export: ToolRegistry for quick setup
 */
export { ToolRegistry as default } from './ToolRegistry';