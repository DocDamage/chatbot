import fs from 'fs';
import path from 'path';
import { ApprovedRepositoryGateway } from '../../src/core/coding/security/ApprovedRepositoryGateway';
import { generateCycloneDxSbom } from '../../src/core/coding/findings/CycloneDxSbom';

const root = process.cwd();
const output = path.join(root, 'docs', 'architecture', 'generated', 'sbom.cyclonedx.json');
fs.writeFileSync(output, `${JSON.stringify(generateCycloneDxSbom(new ApprovedRepositoryGateway(root)), null, 2)}\n`);
