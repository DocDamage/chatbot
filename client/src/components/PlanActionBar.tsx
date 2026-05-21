interface PlanActionBarProps {
  planId: string;
  planPath: string;
  onSwitchToImplement: () => void;
  onOpenPlan: (planId: string) => void;
}

function PlanActionBar({ planId, planPath, onSwitchToImplement, onOpenPlan }: PlanActionBarProps) {
  const copyPlanPath = () => {
    void navigator.clipboard?.writeText(planPath);
  };

  return (
    <div className="assistant-cta-bar" aria-label="Saved plan actions">
      <span>Plan saved: {planPath}</span>
      <button type="button" onClick={onSwitchToImplement}>Switch to Implement</button>
      <button type="button" onClick={() => onOpenPlan(planId)}>Open Plan</button>
      <button type="button" onClick={copyPlanPath}>Copy Plan Path</button>
    </div>
  );
}

export default PlanActionBar;
