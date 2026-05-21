import { PlanDocumentService } from '../core/planning/PlanDocumentService';
import { ChatRequestDto } from '../types/chat';

export async function enrichChatRequestWithPlan(
  request: ChatRequestDto,
  workspaceRoot = process.cwd()
): Promise<ChatRequestDto> {
  if (!request.activePlanId || request.activePlanContent) {
    return request;
  }

  const plan = await new PlanDocumentService(workspaceRoot).getPlan(request.activePlanId);
  return {
    ...request,
    activePlanContent: plan?.content,
  };
}
