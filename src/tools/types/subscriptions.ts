/**
 * Subscription tier types for tool access control
 * 
 * These types define subscription-based access to tool integrations
 * without affecting existing subscription functionality.
 */

export type SubscriptionTier = 'BASIC' | 'PRO' | 'ENTERPRISE';

export interface ToolUsageQuota {
  /** Usage limit for basic tier */
  basic: number;
  /** Usage limit for pro tier */
  pro: number;
  /** Usage limit for enterprise tier (-1 = unlimited) */
  enterprise: number;
}

export interface SubscriptionLimits {
  /** Maximum number of tool integrations allowed */
  maxToolIntegrations: number;
  /** Tool categories allowed for this tier */
  toolCategoriesAllowed: string[];
  /** Monthly usage quotas per tool */
  monthlyQuotas: Record<string, number>;
  /** Whether custom tools are allowed */
  customToolsEnabled: boolean;
  /** Whether workflow automation is available */
  workflowAutomationEnabled: boolean;
}

export interface ToolAccessValidation {
  /** Whether the tool can be accessed */
  allowed: boolean;
  /** Reason for denial if not allowed */
  reason?: 'INSUFFICIENT_TIER' | 'QUOTA_EXCEEDED' | 'CATEGORY_RESTRICTED' | 'INTEGRATION_LIMIT_REACHED';
  /** Required tier if access denied due to tier */
  requiredTier?: SubscriptionTier;
  /** Current usage vs limit if quota exceeded */
  usage?: {
    current: number;
    limit: number;
    resetDate?: Date;
  };
}

export interface SubscriptionContext {
  /** Current subscription tier */
  tier: SubscriptionTier;
  /** Organization ID for quota tracking */
  organizationId: string;
  /** Current subscription limits */
  limits: SubscriptionLimits;
  /** Active integrations count */
  currentIntegrations: number;
}