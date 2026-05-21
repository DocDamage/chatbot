import { SECRequestPacer } from './SECRequestPacer';

export interface EDGARClientOptions {
  userAgent?: string;
  maxRequestsPerSecond?: number;
  dataBaseUrl?: string;
  wwwBaseUrl?: string;
}

export class EDGARClient {
  private readonly userAgent: string;
  private readonly dataBaseUrl: string;
  private readonly wwwBaseUrl: string;
  private readonly pacer: SECRequestPacer;

  constructor(options: EDGARClientOptions = {}) {
    this.userAgent = (options.userAgent || process.env.SEC_USER_AGENT || '').trim();
    if (!this.userAgent) {
      throw new Error('SEC_USER_AGENT is required before accessing SEC EDGAR APIs. Use a real app/contact string.');
    }

    this.dataBaseUrl = options.dataBaseUrl || 'https://data.sec.gov';
    this.wwwBaseUrl = options.wwwBaseUrl || 'https://www.sec.gov';
    this.pacer = new SECRequestPacer(options.maxRequestsPerSecond || Number(process.env.SEC_MAX_REQUESTS_PER_SECOND || 8));
  }

  async getCompanySubmissions(cik: string): Promise<any> {
    const padded = this.padCik(cik);
    return this.getJson(`${this.dataBaseUrl}/submissions/CIK${padded}.json`);
  }

  async getCompanyFacts(cik: string): Promise<any> {
    const padded = this.padCik(cik);
    return this.getJson(`${this.dataBaseUrl}/api/xbrl/companyfacts/CIK${padded}.json`);
  }

  async getCompanyConcept(cik: string, taxonomy: string, concept: string): Promise<any> {
    const padded = this.padCik(cik);
    return this.getJson(`${this.dataBaseUrl}/api/xbrl/companyconcept/CIK${padded}/${encodeURIComponent(taxonomy)}/${encodeURIComponent(concept)}.json`);
  }

  async getFrames(taxonomy: string, concept: string, unit: string, period: string): Promise<any> {
    return this.getJson(`${this.dataBaseUrl}/api/xbrl/frames/${encodeURIComponent(taxonomy)}/${encodeURIComponent(concept)}/${encodeURIComponent(unit)}/${encodeURIComponent(period)}.json`);
  }

  async getCompanyTickers(): Promise<any> {
    return this.getJson(`${this.wwwBaseUrl}/files/company_tickers.json`);
  }

  private async getJson(url: string): Promise<any> {
    await this.pacer.waitTurn();
    const response = await fetch(url, {
      headers: {
        'User-Agent': this.userAgent,
        'Accept-Encoding': 'gzip, deflate',
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`SEC request failed ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  private padCik(cik: string): string {
    const digits = String(cik).replace(/\D/g, '');
    if (!digits) throw new Error('CIK must contain digits');
    return digits.padStart(10, '0');
  }
}
