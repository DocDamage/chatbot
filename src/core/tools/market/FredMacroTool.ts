import axios from 'axios';

export class FredMacroTool {
  private readonly apiKey = process.env.FRED_API_KEY;

  async getSeries(seriesId: string) {
    if (!this.apiKey) {
      return { available: false, seriesId, source: 'FRED', note: 'Set FRED_API_KEY for live macro data.' };
    }
    const response = await axios.get('https://api.stlouisfed.org/fred/series/observations', {
      params: { series_id: seriesId, api_key: this.apiKey, file_type: 'json' },
      timeout: 10000
    });
    return response.data;
  }

  async getLatestObservation(seriesId: string) {
    const data: any = await this.getSeries(seriesId);
    if (!data.observations) return data;
    return { seriesId, latest: data.observations[data.observations.length - 1], source: 'FRED' };
  }

  async compareSeries(seriesIds: string[]) {
    return Promise.all(seriesIds.map(seriesId => this.getLatestObservation(seriesId)));
  }

  async macroSnapshot() {
    return this.compareSeries(['FEDFUNDS', 'CPIAUCSL', 'UNRATE', 'DGS10', 'DGS2', 'GDP', 'M2SL']);
  }
}
