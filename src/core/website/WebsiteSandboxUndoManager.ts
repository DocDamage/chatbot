/**
 * Phase PX-16: Website Sandbox & Undo Manager
 * PX16-T08
 */

import fs from 'node:fs';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { SandboxTransaction } from './WebsiteTypes';

export class WebsiteSandboxUndoManager {
  private projectRoot: string;
  private transactions: Map<string, SandboxTransaction> = new Map();
  private auditLog: Array<{ timestamp: string; action: string; details: any }> = [];

  constructor(projectRoot: string) {
    this.projectRoot = path.resolve(projectRoot);
  }

  public beginTransaction(proposalId?: string): string {
    const txId = `tx-${uuidv4()}`;
    const tx: SandboxTransaction = {
      id: txId,
      timestamp: new Date().toISOString(),
      proposalId,
      affectedFiles: [],
      status: 'COMMITTED'
    };
    this.transactions.set(txId, tx);
    this.recordAudit('BEGIN_TRANSACTION', { txId, proposalId });
    return txId;
  }

  public stageFileWrite(txId: string, relativePath: string, newContent: string): void {
    const tx = this.transactions.get(txId);
    if (!tx) throw new Error(`Transaction ${txId} not found`);

    // Verify confinement: file must stay within projectRoot
    const targetPath = path.resolve(this.projectRoot, relativePath);
    const relative = path.relative(this.projectRoot, targetPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`Write confinement violation: '${relativePath}' is outside project root.`);
    }

    // Read pre-edit bytes if file exists
    let preEditContent = '';
    if (fs.existsSync(targetPath)) {
      preEditContent = fs.readFileSync(targetPath, 'utf8');
    }

    tx.affectedFiles.push({
      filePath: relativePath.replace(/\\/g, '/'),
      preEditContent,
      postEditContent: newContent
    });

    // Write file in sandbox
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, newContent, 'utf8');
    this.recordAudit('FILE_WRITTEN', { txId, relativePath, bytesWritten: Buffer.byteLength(newContent) });
  }

  public rollbackTransaction(txId: string): boolean {
    const tx = this.transactions.get(txId);
    if (!tx) return false;

    for (const item of tx.affectedFiles) {
      const fullPath = path.resolve(this.projectRoot, item.filePath);
      if (item.preEditContent) {
        fs.writeFileSync(fullPath, item.preEditContent, 'utf8');
      } else {
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      }
    }

    tx.status = 'ROLLED_BACK';
    this.recordAudit('TRANSACTION_ROLLED_BACK', { txId, affectedFiles: tx.affectedFiles.map(f => f.filePath) });
    return true;
  }

  public getTransaction(txId: string): SandboxTransaction | undefined {
    return this.transactions.get(txId);
  }

  public listTransactions(): SandboxTransaction[] {
    return Array.from(this.transactions.values());
  }

  public getAuditLog(): Array<{ timestamp: string; action: string; details: any }> {
    return [...this.auditLog];
  }

  private recordAudit(action: string, details: any): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      details
    });
  }
}
