import axios from 'axios';

export class SecEdgarTool {
  private readonly baseUrl = 'https://data.sec.gov';
  private readonly userAgent = process.env.SEC_USER_AGENT || 'ChatBot/1.0 contact@example.com';

  async getCompanySubmissions(cik: string) {
    const padded = cik.padStart(10, '0');
    const response = await axios.get(`${this.baseUrl}/submissions/CIK${padded}.json`, {
      headers: { 'User-Agent': this.userAgent, Accept: 'application/json' },
      timeout: 10000
    });
    return response.data;
  }

  async getCompanyFacts(cik: string) {
    const padded = cik.padStart(10, '0');
    const response = await axios.get(`${this.baseUrl}/api/xbrl/companyfacts/CIK${padded}.json`, {
      headers: { 'User-Agent': this.userAgent, Accept: 'application/json' },
      timeout: 10000
    });
    return response.data;
  }

  async getRecent10K(_ticker: string) {
    return {
      available: false,
      source: 'SEC EDGAR',
      note: 'Ticker-to-CIK lookup is required before fetching the latest 10-K.'
    };
  }

  extractRiskFactors(filingText: string): string[] {
    return filingText
      .split(/\n+/)
      .filter(line => /risk factor|uncertain|adverse|material/i.test(line))
      .slice(0, 10);
  }

  extractRevenueSegments(filingText: string): string[] {
    return filingText
      .split(/\n+/)
      .filter(line => /segment|revenue|net sales/i.test(line))
      .slice(0, 10);
  }
}
