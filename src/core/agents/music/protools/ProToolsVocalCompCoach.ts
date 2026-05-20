import { ProToolsPlaylistAdvisorTool } from '../../../tools/music/ProToolsPlaylistAdvisorTool';
import { ProToolsVocalCompTool } from '../../../tools/music/ProToolsVocalCompTool';

export class ProToolsVocalCompCoach {
  private comp = new ProToolsVocalCompTool();
  private playlists = new ProToolsPlaylistAdvisorTool();

  advise(input: string) {
    return {
      domain: 'music',
      component: 'ProToolsVocalCompCoach',
      comp: this.comp.run({ query: input }),
      playlists: this.playlists.run({ query: input })
    };
  }
}
