/**
 * Core tool types and interfaces for the Contextual Agent SDK
 * 
 * This module provides the foundation for tool integration without affecting
 * existing SDK functionality. All interfaces are optional and additive.
 */

// Re-export all tool types for convenience
export * from './tools';
export * from './subscriptions';
export * from './providers';
export * from './registry';