export class PopCultureCanonResolver {
  resolve(query: string) {
    return {
      query,
      disputedSubjectivePoints: ['Importance rankings depend on criteria: popularity, influence, innovation, awards, box office/sales, or critical reception.']
    };
  }
}
