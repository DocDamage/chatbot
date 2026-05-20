import axios from 'axios';

export class AnalysisApiTool {
  private readonly baseUrl = process.env.SIXSIGMA_ANALYSIS_API_URL || 'http://localhost:8000';
  private readonly apiKey = process.env.SIXSIGMA_ANALYSIS_API_KEY;

  async uploadDataset(filePath: string) {
    return this.post('/upload_dataset', { filePath });
  }

  async analyzeDescriptive(datasetId: string) {
    return this.post('/analyze_descriptive', { datasetId });
  }

  async analyzeCapability(datasetId: string, params: Record<string, any>) {
    return this.post('/analyze_capability', { datasetId, ...params });
  }

  async analyzeRegression(datasetId: string, params: Record<string, any>) {
    return this.post('/analyze_regression', { datasetId, ...params });
  }

  async analyzeDoe(datasetId: string, params: Record<string, any>) {
    return this.post('/analyze_doe', { datasetId, ...params });
  }

  async analyzeControlChart(datasetId: string, params: Record<string, any>) {
    return this.post('/analyze_control_chart', { datasetId, ...params });
  }

  async analyzeTtest(datasetId: string, params: Record<string, any>) {
    return this.post('/analyze_ttest', { datasetId, ...params });
  }

  async exportAnalysisJson(analysisId: string) {
    return this.post('/export_analysis_json', { analysisId });
  }

  async exportAnalysisCsv(analysisId: string) {
    return this.post('/export_analysis_csv', { analysisId });
  }

  async exportAnalysisReport(analysisId: string) {
    return this.post('/export_analysis_report', { analysisId });
  }

  private async post(path: string, body: Record<string, any>) {
    if (!this.apiKey) {
      return { available: false, source: this.baseUrl, note: 'Set SIXSIGMA_ANALYSIS_API_KEY to enable the Blackbelt FastAPI analysis backend.' };
    }
    const response = await axios.post(`${this.baseUrl}${path}`, body, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
      timeout: 30000
    });
    return response.data;
  }
}
