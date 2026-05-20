import { USPTOPatentTool } from '../../tools/science/USPTOPatentTool';
export class PatentRetriever {
  constructor(private readonly uspto = new USPTOPatentTool()) {}
  search(query: string) {
    return this.uspto.search(query);
  }
}
