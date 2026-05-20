export class NasaDataTool {
  async search(query: string) {
    return { query, source: 'NASA/data.gov APIs', note: 'Use dataset-specific NASA APIs for live space-science records.' };
  }
}
