export interface AnatomyLookupInput {
  query?: string;
}

const anatomyMap = [
  {
    pattern: /\b(knee|acl|mcl|meniscus|patella)\b/i,
    region: 'knee',
    structures: ['femur', 'tibia', 'patella', 'menisci', 'ACL', 'PCL', 'MCL', 'LCL', 'quadriceps tendon', 'patellar tendon'],
    function: 'The knee hinges and slightly rotates to support walking, running, jumping, squatting, and load transfer.'
  },
  {
    pattern: /\b(shoulder|rotator cuff|deltoid|labrum)\b/i,
    region: 'shoulder',
    structures: ['humerus', 'scapula', 'clavicle', 'rotator cuff', 'deltoid', 'labrum', 'biceps tendon'],
    function: 'The shoulder trades stability for range of motion, so muscle control and scapular movement matter a lot.'
  },
  {
    pattern: /\b(back|spine|disc|sciatica|lumbar)\b/i,
    region: 'spine/back',
    structures: ['vertebrae', 'intervertebral discs', 'facet joints', 'spinal nerves', 'erector spinae', 'multifidus', 'core musculature'],
    function: 'The spine protects nerves, supports posture, and transmits force between the upper and lower body.'
  },
  {
    pattern: /\b(heart|cardio|pulse|blood pressure)\b/i,
    region: 'cardiovascular system',
    structures: ['heart chambers', 'valves', 'arteries', 'veins', 'capillaries', 'autonomic nervous system'],
    function: 'The cardiovascular system moves oxygen, nutrients, hormones, and waste products through circulation.'
  }
];

export class AnatomyLookupTool {
  run(input: AnatomyLookupInput = {}) {
    const query = input.query || '';
    const match = anatomyMap.find(item => item.pattern.test(query)) || {
      region: 'general anatomy',
      structures: ['bones', 'joints', 'muscles', 'tendons', 'ligaments', 'nerves', 'blood vessels'],
      function: 'Anatomy is best understood by linking structures to movement, sensation, circulation, and protection.'
    };

    return {
      domain: 'health',
      tool: 'AnatomyLookupTool',
      region: match.region,
      keyStructures: match.structures,
      function: match.function,
      studyMethod: [
        'Name the structure.',
        'Locate it relative to nearby structures.',
        'Explain its function.',
        'Connect symptoms or movement limits to possible involved structures without diagnosing.'
      ]
    };
  }
}
