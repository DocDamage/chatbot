#!/usr/bin/env python3
from __future__ import annotations
import json, os, random, re, sys, time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError
from urllib.request import Request, urlopen

API = "https://api.github.com"
REQUIRED = ("## Task objective", "## Permitted scope", "## Dependencies", "## Acceptance criteria", "## Evidence requirements", "## Handoff requirement", "## File-size rule", "## Release-gate integrity")
PHASES = {
0:"Release Governance, Scope Freeze, and Truthful Status",
1:"Restore Repository Integrity and a Fully Green `main`",
2:"Repository Hygiene, Architecture Boundaries, and Maintainability",
3:"CI/CD and Verification Gates That Cannot Produce False Confidence",
4:"Security Hardening and Abuse Resistance",
5:"Database, Persistence, Migration, Backup, and Recovery",
6:"AI Provider, Routing, RAG, Safety, and Evaluation Reliability",
7:"Feature-by-Feature Production Completion",
8:"UX, Accessibility, Onboarding, and Product Polish",
9:"Performance, Capacity, Resilience, and Failure Testing",
10:"Observability, Auditability, and Operational Readiness",
11:"Production Deployment Engineering",
12:"Full Manual QA and Release Candidate Certification",
13:"Versioning, Release Packaging, and Launch",
14:"Post-Release Maintenance Baseline",
}
TASK_TITLES = {
0:"Create the master production completion tracker|Create the production feature manifest|Reconcile existing release documents|Establish release decisions|Create GitHub milestones and issues",
1:"Reproduce the latest CI failure locally|Correct clipboard behavior and tests|Remove the client lint warning|Repair stale gitlink/submodule state|Decide and repair GitHub Pages|Make all current CI stages execute|Add branch protection",
2:"Create a complete code and route inventory|Build a reachability map|Remove or isolate legacy and duplicate implementations|Enforce the 300-line source guideline|Consolidate environment templates|Create configuration schemas|Normalize documentation and generated artifacts",
3:"Split and harden CI jobs|Implement meaningful server coverage policy|Implement client coverage thresholds|Replace fake accessibility testing|Add real browser E2E testing|Add dependency and supply-chain gates|Add migration CI|Add container and package smoke tests",
4:"Produce a complete threat model|Harden authentication and session policy|Formalize route authorization|Upgrade and harden uploads|Harden file browsing and workspace access|Harden local command execution|Harden SSRF and outbound requests|Harden Redis and rate limiting|Security headers and browser policy|Secrets and API-key lifecycle|Audit logging|Independent security review",
5:"Select and document the production database|Centralize migration management|Test PostgreSQL as a first-class target|Enforce user ownership and data isolation|Transaction and consistency review|Backup implementation|Restore drill|Data retention, deletion, and export",
6:"Declare supported providers and models|Provider contract tests|Real provider canary tests|Timeout, retry, circuit breaker, and cancellation|Token, context, and cost controls|RAG production hardening|Grounding and citation release gates|Domain and safety evals|Eval regression enforcement",
7:"Core chat and streaming|Authentication, setup, and settings|Conversations and sharing|Modes and specialist routing|Coding workflow|File Explorer|Audio browser and analysis|Document, image, and video ingestion|Knowledge Base and RAG UI|Knowledge Online approval workflow|Knowledge OS|Local tools|Sprite Lab|SEC ingestion|Gaming and game-development features|Creative writing and roleplay|Music, FL Studio, and desktop bridges|GIS|Administration and exports|Webhooks, automation, notifications, and real-time features",
8:"Information architecture review|Unified state design|Dangerous-action UX|First-run onboarding|WCAG 2.2 AA implementation|Manual assistive-technology test|Responsive and browser matrix|Product copy and diagnostics",
9:"Define service objectives|Build representative load profiles|Load and soak tests|Resource and abuse caps|Dependency failure matrix|Startup and shutdown reliability|Performance regression gate",
10:"Structured logging standard|Metrics|Distributed tracing|Health endpoints|Dashboards and alerts|Runbooks|Operational support bundle",
11:"Select the production hosting architecture|Harden the Docker image|Correct Docker Compose defaults|Reverse proxy and TLS|Staging environment|Automated deployment pipeline|Migration and rollback strategy|Production smoke suite",
12:"Clean-machine installation|Manual workflow matrix|Cross-configuration matrix|Long-running and large-data scenarios|Security acceptance|Documentation acceptance|Release evidence reconciliation|Final release candidate sign-off",
13:"Version and tag|Release artifacts|Controlled rollout|Post-deploy verification|Initial operating review",
14:"Dependency update policy|Vulnerability response SLA|Regression and eval maintenance|Quarterly restore and incident drills|Feature lifecycle policy",
}
VERIFIED = {
"P00-T01":("agent/p00-t01-master-production-tracker","84ef639bda41d585240041a0657cd21f2e9f8cde","docs/implementation/evidence/PHASE-00/P00-T01/2026-08-04_84ef639b"),
"P00-T02":("agent/p00-t02-production-feature-manifest","027eacd948cadb0f8b749385c51acd13a287051c","docs/implementation/evidence/PHASE-00/P00-T02/2026-08-04_027eacd9"),
"P00-T03":("agent/p00-t03-reconcile-release-documents","27c225dfae2a9d475331af56e9030ba93f8d42e5","docs/implementation/evidence/PHASE-00/P00-T03/2026-08-04_27c225df"),
"P00-T04":("agent/p00-t04-establish-release-decisions","923d3a14de0c1b6b9b5aab31cd14663869b3dda7","docs/implementation/evidence/PHASE-00/P00-T04/2026-08-05_923d3a14"),
}

def env(name:str)->str:
    value=os.environ.get(name,"").strip()
    if not value: raise RuntimeError(f"Missing environment variable: {name}")
    return value
TOKEN, REPO, REF, SHA = env("GITHUB_TOKEN"), env("GITHUB_REPOSITORY"), env("GITHUB_REF_NAME"), env("GITHUB_SHA")
OUT=Path(os.environ.get("P00_T05_OUTPUT_ROOT","docs/implementation/evidence/PHASE-00/P00-T05"))

def request(method:str,path:str,payload:dict[str,Any]|None=None)->Any:
    data=None if payload is None else json.dumps(payload).encode()
    headers={"Accept":"application/vnd.github+json","Authorization":f"Bearer {TOKEN}","X-GitHub-Api-Version":"2022-11-28","User-Agent":"DocDamage-chatbot-P00-T05"}
    if data is not None: headers["Content-Type"]="application/json"
    for attempt in range(1,9):
        try:
            with urlopen(Request(API+path,data=data,headers=headers,method=method),timeout=60) as response:
                raw=response.read(); return json.loads(raw) if raw else None
        except HTTPError as exc:
            body=exc.read().decode(errors="replace")
            if exc.code not in {403,429,500,502,503,504} or attempt==8: raise RuntimeError(f"{method} {path}: HTTP {exc.code}: {body}") from exc
            delay=float(exc.headers.get("Retry-After") or min(90,2**attempt+random.random())); print(f"retry {method} {path} in {delay:.1f}s",flush=True); time.sleep(delay)
    raise AssertionError

def pages(path:str)->list[dict[str,Any]]:
    result=[]; page=1; sep="&" if "?" in path else "?"
    while True:
        batch=request("GET",f"{path}{sep}per_page=100&page={page}")
        if not isinstance(batch,list): raise RuntimeError(f"Expected list from {path}")
        result.extend(batch)
        if len(batch)<100: return result
        page+=1

def mutate(method:str,path:str,payload:dict[str,Any])->Any:
    result=request(method,path,payload); time.sleep(.45+random.random()*.2); return result

def body(task_id:str,title:str,phase:int,position:int)->str:
    if phase==0: deps="None." if position==1 else f"`P00-T{position-1:02d}` verified."
    else: deps=f"Phase {phase-1} exit gate verified. Earlier Phase {phase} outputs are dependencies only when this task consumes them; do not infer verification from issue order."
    historical=""
    if task_id in VERIFIED:
        branch,commit,evidence=VERIFIED[task_id]
        historical=f"\n## Existing verified evidence\n\n- Status: `VERIFIED`\n- Branch: `{branch}`\n- Implementation commit: `{commit}`\n- Evidence: `{evidence}`\n- This traceability issue must remain closed unless that evidence is invalidated.\n"
    return f"""# {task_id} — {title}

## Task objective

Complete **{title}** for **Phase {phase} — {PHASES[phase]}** exactly as defined by the authoritative production-completion plan and `docs/implementation/MASTER_PRODUCTION_COMPLETION_TRACKER.md`.

## Permitted scope

- Work only on `{task_id}`.
- Implement every requirement in the authoritative `{task_id}` task section; do not redefine or omit requirements in this issue.
- Do not begin another task in the same thread or alter another task's status without its own committed evidence.

## Dependencies

- {deps}
- Accepted ADRs, the production feature manifest, current handoff, and prior verified evidence remain binding where applicable.

## Acceptance criteria

- Every task-specific requirement and applicable phase constraint in the authoritative plan is implemented.
- Focused tests, relevant suites, type checks, lint, security checks, and runtime QA pass at the correct layers.
- Negative, failure, authorization, accessibility, persistence, recovery, deployment, or operational paths are verified wherever applicable.
- The task is not marked `VERIFIED` until implementation, evidence, documentation, and runtime verification requirements are satisfied against the same exact commit.

## Evidence requirements

- Create `docs/implementation/evidence/PHASE-{phase:02d}/{task_id}/<YYYY-MM-DD>_<SHORT-SHA>/`.
- Record exact branch, full commit SHA, changed files, commands, exit codes, result summaries, runtime checklist, artifacts/screenshots where applicable, and known limitations.
- Sensitive output must be sanitized. Narrative assertions, route presence, compilation, or mock-only tests are not sufficient evidence.

## Handoff requirement

- Replace `docs/implementation/handoffs/CURRENT_HANDOFF.md` and archive `docs/implementation/handoffs/archive/{task_id}_HANDOFF.md`.
- Name exactly one next authorized task, include its complete new-thread prompt, and close the current thread.

## File-size rule

Keep production source files below 300 lines where reasonably possible. Do not split cohesive code into meaningless fragments. Register and justify necessary production-source exceptions in `docs/architecture/large-file-register.md`.

## Release-gate integrity

**Do not weaken, skip, delete, bypass, relabel, broadly exclude, or convert required tests or release gates merely to make CI pass.** Do not lower coverage thresholds, add `continue-on-error`, substitute mocks for required runtime verification, disable security controls, or mark manual QA complete without evidence.
{historical}""".strip()+"\n"

def main()->int:
    tasks=[]
    for phase,titles in TASK_TITLES.items():
        for position,title in enumerate(titles.split("|"),1):
            task_id=f"P{phase:02d}-T{position:02d}"; issue_body=body(task_id,title,phase,position)
            if any(h not in issue_body for h in REQUIRED): raise RuntimeError(f"Body validation failed: {task_id}")
            tasks.append({"id":task_id,"title":f"[{task_id}] {title}","body":issue_body,"phase":phase,"state":"closed" if task_id in VERIFIED else "open"})
    if len(PHASES)!=15 or len(tasks)!=124 or len({t['id'] for t in tasks})!=124: raise RuntimeError("Catalog count/uniqueness failure")
    existing=pages(f"/repos/{REPO}/milestones?state=all"); by_phase={}
    for item in existing:
        match=re.match(r"^PHASE (\d+) — ",item.get("title",""))
        if match:
            phase=int(match.group(1))
            if phase in by_phase: raise RuntimeError(f"Duplicate Phase {phase} milestones")
            by_phase[phase]=item
    milestones=[]; phase_number={}
    for phase,title in PHASES.items():
        desired={"title":f"PHASE {phase} — {title}","description":f"Complete Phase {phase} exactly as defined by the authoritative production-completion plan. The milestone closes only after every Phase {phase} task is VERIFIED with committed evidence.","state":"open"}
        item=by_phase.get(phase); action="unchanged"
        if item is None: item=mutate("POST",f"/repos/{REPO}/milestones",desired); action="created"
        else:
            patch={k:v for k,v in desired.items() if (item.get(k) or "")!=v}
            if patch: item=mutate("PATCH",f"/repos/{REPO}/milestones/{item['number']}",patch); action="updated"
        phase_number[phase]=item["number"]; milestones.append({"phase":phase,"number":item["number"],"title":item["title"],"url":item["html_url"],"action":action})
    current_issues=[i for i in pages(f"/repos/{REPO}/issues?state=all") if "pull_request" not in i]; by_task={}
    for item in current_issues:
        match=re.match(r"^\[(P\d{2}-T\d{2})\]\s",item.get("title",""))
        if match:
            if match.group(1) in by_task: raise RuntimeError(f"Duplicate issue {match.group(1)}")
            by_task[match.group(1)]=item
    results=[]
    for index,task in enumerate(tasks,1):
        item=by_task.get(task["id"]); action="unchanged"; milestone=phase_number[task["phase"]]
        if item is None: item=mutate("POST",f"/repos/{REPO}/issues",{"title":task["title"],"body":task["body"],"milestone":milestone}); action="created"
        else:
            patch={}
            if item.get("title")!=task["title"]: patch["title"]=task["title"]
            if (item.get("body") or "").replace("\r\n","\n").rstrip()!=task["body"].rstrip(): patch["body"]=task["body"]
            if (item.get("milestone") or {}).get("number")!=milestone: patch["milestone"]=milestone
            if patch: item=mutate("PATCH",f"/repos/{REPO}/issues/{item['number']}",patch); action="updated"
        if item["state"]!=task["state"]:
            payload={"state":task["state"]}
            if task["state"]=="closed": payload["state_reason"]="completed"
            item=mutate("PATCH",f"/repos/{REPO}/issues/{item['number']}",payload); action=(action+"+state" if action!="unchanged" else "state")
        results.append({"taskId":task["id"],"number":item["number"],"title":item["title"],"state":item["state"],"milestone":milestone,"url":item["html_url"],"action":action}); print(f"[{index:03d}/124] {task['id']}: {action}",flush=True)
    read_milestones={m["number"]:m for m in pages(f"/repos/{REPO}/milestones?state=all")}; read_issues={}
    for item in [i for i in pages(f"/repos/{REPO}/issues?state=all") if "pull_request" not in i]:
        match=re.match(r"^\[(P\d{2}-T\d{2})\]\s",item.get("title",""))
        if match:
            if match.group(1) in read_issues: raise RuntimeError(f"Read-back duplicate {match.group(1)}")
            read_issues[match.group(1)]=item
    errors=[]
    for phase,title in PHASES.items():
        item=read_milestones.get(phase_number[phase])
        if not item or item["title"]!=f"PHASE {phase} — {title}": errors.append(f"Milestone {phase} mismatch")
    for task in tasks:
        item=read_issues.get(task["id"])
        if not item: errors.append(f"Missing {task['id']}"); continue
        if item["title"]!=task["title"]: errors.append(f"Title {task['id']}")
        if (item.get("body") or "").replace("\r\n","\n").rstrip()!=task["body"].rstrip(): errors.append(f"Body {task['id']}")
        if (item.get("milestone") or {}).get("number")!=phase_number[task["phase"]]: errors.append(f"Milestone {task['id']}")
        if item["state"]!=task["state"]: errors.append(f"State {task['id']}")
    if errors: raise RuntimeError("Read-back failures: "+", ".join(errors))
    now=datetime.now(timezone.utc); evidence=OUT/f"{now:%Y-%m-%d}_{SHA[:8]}"; artifacts=evidence/"artifacts"; artifacts.mkdir(parents=True,exist_ok=True)
    payload={"taskId":"P00-T05","repository":REPO,"branch":REF,"sourceCommit":SHA,"status":"IMPLEMENTED_NOT_VERIFIED","generatedAt":now.isoformat(),"counts":{"milestones":len(milestones),"issues":len(results),"closedVerifiedIssues":sum(i["state"]=="closed" for i in results),"openIssues":sum(i["state"]=="open" for i in results)},"milestones":milestones,"issues":results,"verificationErrors":errors}
    (artifacts/"github-object-results.json").write_text(json.dumps(payload,indent=2)+"\n")
    md=["# P00-T05 GitHub Object Results","",f"- Repository: `{REPO}`",f"- Branch: `{REF}`",f"- Source commit: `{SHA}`",f"- Generated: `{now.isoformat()}`",f"- Milestones verified: **{len(milestones)}**",f"- Issues verified: **{len(results)}**","","## Milestones","","| Phase | Number | Action | URL |","|---:|---:|---|---|"]
    md += [f"| {i['phase']} | {i['number']} | {i['action']} | {i['url']} |" for i in milestones]
    md += ["","## Issues","","| Task | Issue | State | Action | URL |","|---|---:|---|---|---|"]+[f"| `{i['taskId']}` | {i['number']} | {i['state']} | {i['action']} | {i['url']} |" for i in results]
    (artifacts/"github-object-results.md").write_text("\n".join(md)+"\n"); print(f"evidence_dir={evidence}",flush=True); return 0

if __name__=="__main__":
    try: raise SystemExit(main())
    except Exception as exc: print(f"ERROR: {exc}",file=sys.stderr,flush=True); raise
