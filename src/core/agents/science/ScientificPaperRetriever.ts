import { OpenAlexTool } from '../../tools/science/OpenAlexTool';
export class ScientificPaperRetriever {
  constructor(private readonly openAlex = new OpenAlexTool()) {}
  search(query: string) {
    return this.openAlex.works(query);
  }
}
