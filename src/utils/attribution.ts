/**
 * Attribution utilities for Contextual Agent SDK
 * Created by simcoder technologies a subsidiary of SCS Group
 */

export interface AttributionInfo {
  library: string;
  version: string;
  author: string;
  company: string;
  innovation: string;
  url: string;
  repository: string;
  license: string;
}

/**
 * Get attribution information for the SDK
 */
export function getAttribution(): AttributionInfo {
  return {
    library: "Contextual Agent SDK",
    version: "1.0.0",
    author: "simcoder technologies a subsidiary of SCS Group",
    company: "SCS Group",
    innovation: "Seamless Voice-Text Context Switching Technology",
    url: "https://github.com/simcoder/contextual-agent-sdk",
    repository: "https://github.com/simcoder/contextual-agent-sdk",
    license: "MIT"
  };
}

/**
 * Generate HTML attribution string
 */
export function getHTMLAttribution(): string {
  const info = getAttribution();
  return `Powered by <a href="${info.url}">${info.library}</a> by simcoder technologies`;
}

/**
 * Generate markdown attribution string
 */
export function getMarkdownAttribution(): string {
  const info = getAttribution();
  return `Uses [${info.library}](${info.url}) by simcoder technologies for ${info.innovation.toLowerCase()}`;
}

/**
 * Generate plain text attribution string
 */
export function getTextAttribution(): string {
  const info = getAttribution();
  return `Powered by ${info.library} by simcoder technologies - ${info.url}`;
}

/**
 * Generate JSON attribution object
 */
export function getJSONAttribution(): Record<string, any> {
  const info = getAttribution();
  return {
    "contextual-agent-sdk": {
      author: info.author,
      company: info.company,
      innovation: info.innovation,
      url: info.url,
      license: info.license
    }
  };
}

/**
 * Send usage telemetry for monitoring (optional and privacy-compliant)
 */
export async function reportUsage(options?: {
  projectName?: string;
  environment?: 'development' | 'production';
  userAgent?: string;
  features?: string[];
  disableTelemetry?: boolean;
}): Promise<void> {
  // Only send telemetry if explicitly enabled and in production
  if (options?.disableTelemetry !== false || process.env.NODE_ENV !== 'production') {
    return;
  }

  try {
    const telemetryEndpoint = 'https://api.simcoder.tech/sdk/usage';
    const payload = {
      sdk: 'contextual-agent-sdk',
      version: getAttribution().version,
      timestamp: new Date().toISOString(),
      environment: options?.environment || 'unknown',
      features: options?.features || [],
      // Anonymous identifier based on SDK usage
      instanceId: generateAnonymousId(),
      // Optional project info (user-provided)
      projectName: options?.projectName,
      userAgent: options?.userAgent
    };

    await fetch(telemetryEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `contextual-agent-sdk/${payload.version}`
      },
      body: JSON.stringify(payload)
    }).catch(() => {
      // Silently fail - telemetry should never break the application
    });
  } catch (error) {
    // Silently fail - telemetry should never break the application
  }
}

/**
 * Generate anonymous identifier for usage tracking
 */
function generateAnonymousId(): string {
  // Create a non-invasive identifier based on basic system info
  const nodeVersion = process.version;
  const platform = process.platform;
  const arch = process.arch;
  
  // Simple hash of environment info (not personally identifiable)
  const envHash = Buffer.from(`${nodeVersion}-${platform}-${arch}`).toString('base64');
  return envHash.substring(0, 16);
}

/**
 * Log attribution to console (useful for development)
 */
export function logAttribution(): void {
  const info = getAttribution();
  console.log(`
🤖 ${info.library} v${info.version}
🏢 Created by: ${info.author}
🚀 Innovation: ${info.innovation}
🔗 Repository: ${info.repository}
📄 License: ${info.license}

Thank you for using Contextual Agent SDK!
Please include attribution in your project.
  `);
}

/**
 * Check if attribution is properly included in package.json
 */
export function validateAttribution(packageJson: any): {
  isValid: boolean;
  suggestions: string[];
} {
  const suggestions: string[] = [];
  let isValid = true;

  if (!packageJson.author || typeof packageJson.author === 'string' && packageJson.author === '') {
    suggestions.push("Add author information to package.json");
  }

  if (!packageJson.credits || !packageJson.credits['contextual-agent-sdk']) {
    suggestions.push("Add credits section with contextual-agent-sdk attribution");
    isValid = false;
  }

  if (!packageJson.repository || !packageJson.repository.url) {
    suggestions.push("Add repository URL to package.json");
  }

  return { isValid, suggestions };
}

/**
 * Create attribution badge for README files
 */
export function getAttributionBadge(style: 'markdown' | 'html' = 'markdown'): string {
  const info = getAttribution();
  const badgeUrl = `https://img.shields.io/badge/Powered%20by-Contextual%20Agent%20SDK-blue`;
  
  if (style === 'html') {
    return `<a href="${info.url}"><img src="${badgeUrl}" alt="Powered by Contextual Agent SDK" /></a>`;
  }
  
  return `[![Powered by Contextual Agent SDK](${badgeUrl})](${info.url})`;
}

// Auto-log attribution when SDK is imported (in development)
if (process.env.NODE_ENV === 'development') {
  logAttribution();
} 