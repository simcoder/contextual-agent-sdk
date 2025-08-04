#!/usr/bin/env node

/**
 * Usage Monitoring Script for Contextual Agent SDK
 * Created by simcoder technologies a subsidiary of SCS Group
 * 
 * This script helps monitor SDK downloads, usage, and attribution compliance
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

class SDKMonitor {
  constructor() {
    this.packageName = 'contextual-agent-sdk';
    this.githubRepo = 'simcoder/contextual-agent-sdk';
    this.resultsDir = path.join(__dirname, '../monitoring-results');
    
    // Create results directory if it doesn't exist
    if (!fs.existsSync(this.resultsDir)) {
      fs.mkdirSync(this.resultsDir, { recursive: true });
    }
  }

  /**
   * Get NPM download statistics
   */
  async getNPMDownloads() {
    console.log('📊 Fetching NPM download statistics...');
    
    const periods = ['last-day', 'last-week', 'last-month'];
    const results = {};
    
    for (const period of periods) {
      try {
        const data = await this.makeRequest(`https://api.npmjs.org/downloads/point/${period}/${this.packageName}`);
        results[period] = JSON.parse(data);
        console.log(`   ${period}: ${results[period].downloads} downloads`);
      } catch (error) {
        console.error(`   Failed to get ${period} data:`, error.message);
        results[period] = { error: error.message };
      }
    }

    // Get historical data (last 90 days)
    try {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const historicalData = await this.makeRequest(`https://api.npmjs.org/downloads/range/${startDate}:${endDate}/${this.packageName}`);
      results.historical = JSON.parse(historicalData);
      console.log(`   Historical (90 days): ${results.historical.downloads.reduce((sum, day) => sum + day.downloads, 0)} total downloads`);
    } catch (error) {
      console.error('   Failed to get historical data:', error.message);
      results.historical = { error: error.message };
    }

    return results;
  }

  /**
   * Get GitHub repository statistics
   */
  async getGitHubStats() {
    console.log('🔍 Fetching GitHub statistics...');
    
    try {
      const repoData = await this.makeRequest(`https://api.github.com/repos/${this.githubRepo}`, {
        'User-Agent': 'contextual-agent-sdk-monitor'
      });
      
      const repo = JSON.parse(repoData);
      const stats = {
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        watchers: repo.watchers_count,
        open_issues: repo.open_issues_count,
        subscribers: repo.subscribers_count,
        size: repo.size,
        created_at: repo.created_at,
        updated_at: repo.updated_at,
        pushed_at: repo.pushed_at,
        language: repo.language,
        topics: repo.topics
      };
      
      console.log(`   ⭐ Stars: ${stats.stars}`);
      console.log(`   🍴 Forks: ${stats.forks}`);
      console.log(`   👀 Watchers: ${stats.watchers}`);
      
      return stats;
    } catch (error) {
      console.error('   Failed to get GitHub stats:', error.message);
      return { error: error.message };
    }
  }

  /**
   * Search for attribution mentions
   */
  async searchAttributionMentions() {
    console.log('🔎 Searching for attribution mentions...');
    
    const searchQueries = [
      `"${this.packageName}"`,
      '"simcoder technologies"',
      '"Contextual Agent SDK"',
      '"seamless voice-text context switching"'
    ];
    
    // This would require GitHub search API authentication for better results
    // For now, just provide the search URLs
    const results = {
      manual_searches: searchQueries.map(query => ({
        query,
        github_search_url: `https://github.com/search?q=${encodeURIComponent(query)}&type=code`,
        google_search_url: `https://www.google.com/search?q=${encodeURIComponent(query)}`
      }))
    };
    
    console.log('   Manual search URLs generated for attribution monitoring');
    
    return results;
  }

  /**
   * Check for potential code copying using simple heuristics
   */
  async checkCodeCopying() {
    console.log('⚖️ Checking for potential code copying...');
    
    // This is a simplified check - in practice, you'd use tools like:
    // - SCANOSS (scanoss scan)
    // - ScanCode (scancode)
    // - Vendetect (vendetect)
    
    const suggestions = [
      'Use SCANOSS: pip install scanoss && scanoss scan /path/to/suspect/repo',
      'Use ScanCode: pip install scancode-toolkit && scancode /path/to/suspect/repo',
             'Use Vendetect: pip install vendetect && vendetect /path/to/suspect/repo https://github.com/simcoder/contextual-agent-sdk',
      'Set up Google Alerts for "contextual-agent-sdk" and "simcoder technologies"'
    ];
    
    return { suggestions };
  }

  /**
   * Generate monitoring report
   */
  async generateReport() {
    console.log('📋 Generating comprehensive monitoring report...\n');
    
    const timestamp = new Date().toISOString();
    const report = {
      timestamp,
      package_name: this.packageName,
      github_repo: this.githubRepo,
      npm_downloads: await this.getNPMDownloads(),
      github_stats: await this.getGitHubStats(),
      attribution_search: await this.searchAttributionMentions(),
      code_copying_check: await this.checkCodeCopying()
    };
    
    // Save report to file
    const reportFile = path.join(this.resultsDir, `monitoring-report-${Date.now()}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    // Generate human-readable summary
    this.generateSummary(report);
    
    console.log(`\n📄 Full report saved to: ${reportFile}`);
    
    return report;
  }

  /**
   * Generate human-readable summary
   */
  generateSummary(report) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 CONTEXTUAL AGENT SDK MONITORING SUMMARY');
    console.log('='.repeat(60));
    
    // NPM Downloads Summary
    console.log('\n📈 NPM Downloads:');
    if (report.npm_downloads['last-day']?.downloads) {
      console.log(`   Yesterday: ${report.npm_downloads['last-day'].downloads}`);
    }
    if (report.npm_downloads['last-week']?.downloads) {
      console.log(`   Last 7 days: ${report.npm_downloads['last-week'].downloads}`);
    }
    if (report.npm_downloads['last-month']?.downloads) {
      console.log(`   Last 30 days: ${report.npm_downloads['last-month'].downloads}`);
    }
    
    // GitHub Stats Summary
    console.log('\n🔍 GitHub Repository:');
    if (report.github_stats.stars !== undefined) {
      console.log(`   ⭐ Stars: ${report.github_stats.stars}`);
      console.log(`   🍴 Forks: ${report.github_stats.forks}`);
      console.log(`   👀 Watchers: ${report.github_stats.watchers}`);
    }
    
    // Attribution Monitoring
    console.log('\n🔎 Attribution Monitoring:');
    console.log('   Manual searches required for:');
    report.attribution_search.manual_searches?.forEach(search => {
      console.log(`   • ${search.query}`);
    });
    
    // Recommendations
    console.log('\n💡 Recommendations:');
    console.log('   • Set up automated alerts for your package name');
    console.log('   • Use license scanning tools regularly');
    console.log('   • Monitor GitHub traffic insights weekly');
    console.log('   • Track attribution compliance monthly');
    
    console.log('\n' + '='.repeat(60));
  }

  /**
   * Helper method to make HTTP requests
   */
  makeRequest(url, headers = {}) {
    return new Promise((resolve, reject) => {
      const options = {
        headers: {
          'User-Agent': 'contextual-agent-sdk-monitor/1.0',
          ...headers
        }
      };
      
      https.get(url, options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          }
        });
      }).on('error', (err) => {
        reject(err);
      });
    });
  }
}

// Run monitoring if called directly
if (require.main === module) {
  const monitor = new SDKMonitor();
  monitor.generateReport().catch(console.error);
}

module.exports = SDKMonitor; 