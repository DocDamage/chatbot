export interface BOMBuilderInput {
  query?: string;
}

export class BOMBuilderTool {
  run(input: BOMBuilderInput = {}) {
    const query = input.query || '';
    const projectType = this.projectType(query);

    return {
      domain: 'engineering',
      tool: 'BOMBuilderTool',
      projectType,
      parts: this.partsFor(projectType),
      columns: ['item', 'quantity', 'specification', 'supplier/part number', 'unit cost', 'lead time', 'risk/substitute'],
      reviewChecklist: [
        'Confirm electrical/mechanical compatibility.',
        'Add spares for fragile or low-cost parts.',
        'Track long-lead or single-source parts.',
        'Include tools, fasteners, connectors, wire, enclosure, and safety equipment.'
      ]
    };
  }

  private projectType(query: string): string {
    if (/\brobot|rover|drive\b/i.test(query)) return 'mobile_robot';
    if (/\bled|lighting\b/i.test(query)) return 'led_controller';
    if (/\bsensor|logger|iot\b/i.test(query)) return 'sensor_logger';
    return 'general_prototype';
  }

  private partsFor(projectType: string): string[] {
    const parts: Record<string, string[]> = {
      mobile_robot: ['microcontroller', 'motor driver', 'DC gear motors', 'wheels', 'battery pack', 'fuse/switch', 'chassis', 'fasteners', 'wiring/connectors'],
      led_controller: ['microcontroller', 'LED strip/module', 'power supply', 'MOSFET/driver', 'fuse', 'enclosure', 'connectors'],
      sensor_logger: ['microcontroller', 'sensor module', 'storage or wireless module', 'power supply', 'enclosure', 'calibration reference'],
      general_prototype: ['controller', 'power supply', 'interface components', 'mechanical mounting', 'connectors', 'test equipment']
    };
    return parts[projectType];
  }
}
