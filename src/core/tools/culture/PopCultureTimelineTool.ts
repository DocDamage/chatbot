export class PopCultureTimelineTool {
  build(query: string) {
    const range = query.match(/(\d{4}).*?(\d{4})/);
    const start = range ? Number(range[1]) : 1920;
    const end = range ? Number(range[2]) : new Date().getFullYear();
    return [
      { year: start, event: 'Timeline begins', confidence: 0.7 },
      { year: end, event: 'Timeline endpoint', confidence: 0.7 }
    ];
  }
}
