/**
 * Contract & Policy Gate - Enforces AI contracts at enforcement points
 */

import { AIContract, Capability, CanonWritePolicy } from '../../types/contract';
import { logger } from '../observability/logger';

export class ContractGate {
  /**
   * Validate if a capability is allowed by the contract
   */
  validateCapability(contract: AIContract, capability: Capability): boolean {
    const allowed = contract.allowed_capabilities.includes(capability);
    if (!allowed) {
      logger.warn(`Capability ${capability} not allowed in contract ${contract.contract_id}`);
    }
    return allowed;
  }

  /**
   * Validate if a tool is allowed by the contract
   */
  validateTool(contract: AIContract, tool: string): boolean {
    if (!contract.allowed_tools || contract.allowed_tools.length === 0) {
      return true; // No tool restrictions
    }
    const allowed = contract.allowed_tools.includes(tool);
    if (!allowed) {
      logger.warn(`Tool ${tool} not allowed in contract ${contract.contract_id}`);
    }
    return allowed;
  }

  /**
   * Validate canon write policy
   */
  validateCanonWrite(contract: AIContract, requestedLevel: CanonWritePolicy): boolean {
    const policy = contract.canon_write_policy;
    
    if (policy === CanonWritePolicy.NONE) {
      return false;
    }
    
    if (policy === CanonWritePolicy.DIRECT) {
      return true;
    }
    
    // SUGGEST_ONLY and CONFIRM_REQUIRED require additional checks
    return policy === requestedLevel;
  }

  /**
   * Validate cost limit
   */
  validateCost(contract: AIContract, estimatedCost: number): boolean {
    const valid = estimatedCost <= contract.max_cost_per_request;
    if (!valid) {
      logger.warn(`Estimated cost ${estimatedCost} exceeds limit ${contract.max_cost_per_request}`);
    }
    return valid;
  }

  /**
   * Check if request should be blocked due to contract violations
   */
  validateRequest(
    contract: AIContract,
    capability: Capability,
    tool?: string,
    estimatedCost?: number
  ): { allowed: boolean; reason?: string } {
    if (!this.validateCapability(contract, capability)) {
      return { allowed: false, reason: `Capability ${capability} not allowed` };
    }

    if (tool && !this.validateTool(contract, tool)) {
      return { allowed: false, reason: `Tool ${tool} not allowed` };
    }

    if (estimatedCost !== undefined && !this.validateCost(contract, estimatedCost)) {
      return { allowed: false, reason: `Cost ${estimatedCost} exceeds limit` };
    }

    return { allowed: true };
  }
}

