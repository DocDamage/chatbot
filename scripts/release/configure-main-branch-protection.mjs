const DEFAULT_REPOSITORY = "DocDamage/chatbot";
const DEFAULT_BRANCH = "main";
const REQUIRED_CHECK = "Required CI gate";
const API_VERSION = "2026-03-10";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const repository = process.env.GITHUB_REPOSITORY || DEFAULT_REPOSITORY;
const branch = process.env.GITHUB_BRANCH || DEFAULT_BRANCH;
const token = process.env.BRANCH_PROTECTION_TOKEN;

function fail(message) {
  console.error(`Branch-protection configuration failed: ${message}`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function endpoint(pathname) {
  return `https://api.github.com/repos/${repository}${pathname}`;
}

async function request(method, pathname, body) {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": API_VERSION,
    "User-Agent": "chatbot-p01-t07-branch-protection",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(endpoint(pathname), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const detail =
      typeof payload === "object" && payload?.message
        ? payload.message
        : String(payload || response.statusText);
    throw new Error(`${method} ${pathname} returned ${response.status}: ${detail}`);
  }

  return payload;
}

function protectionPayload(appId) {
  return {
    required_status_checks: {
      strict: true,
      contexts: [],
      checks: [{ context: REQUIRED_CHECK, app_id: appId }],
    },
    enforce_admins: false,
    required_pull_request_reviews: {
      dismiss_stale_reviews: true,
      require_code_owner_reviews: false,
      required_approving_review_count: 1,
      require_last_push_approval: true,
    },
    restrictions: null,
    required_linear_history: false,
    allow_force_pushes: false,
    allow_deletions: false,
    block_creations: false,
    required_conversation_resolution: true,
    lock_branch: false,
    allow_fork_syncing: false,
  };
}

function verifyProtection(protection, appId) {
  assert(protection?.required_status_checks?.strict === true, "strict status checks are not enabled");
  assert(
    protection.required_status_checks.checks?.some(
      (check) => check.context === REQUIRED_CHECK && check.app_id === appId,
    ),
    `${REQUIRED_CHECK} is not required from GitHub Actions app ${appId}`,
  );
  assert(protection?.enforce_admins?.enabled === false, "owner-only admin bypass is not preserved");
  assert(
    protection?.required_pull_request_reviews?.required_approving_review_count === 1,
    "one approving review is not required",
  );
  assert(
    protection.required_pull_request_reviews.dismiss_stale_reviews === true,
    "stale approvals are not dismissed",
  );
  assert(
    protection.required_pull_request_reviews.require_last_push_approval === true,
    "the latest push does not require independent approval",
  );
  assert(
    protection?.required_conversation_resolution?.enabled === true,
    "conversation resolution is not required",
  );
  assert(protection?.allow_force_pushes?.enabled === false, "force pushes are allowed");
  assert(protection?.allow_deletions?.enabled === false, "branch deletion is allowed");
  assert(protection?.required_signatures?.enabled !== true, "signed commits were enabled unexpectedly");
}

async function main() {
  assert(repository.includes("/"), `invalid GITHUB_REPOSITORY value: ${repository}`);
  assert(branch === DEFAULT_BRANCH, `this task may protect only ${DEFAULT_BRANCH}, received ${branch}`);

  const branchState = await request("GET", `/branches/${encodeURIComponent(branch)}`);
  const headSha = branchState.commit.sha;
  const checkRuns = await request("GET", `/commits/${headSha}/check-runs?per_page=100`);
  const requiredCheck = checkRuns.check_runs.find((check) => check.name === REQUIRED_CHECK);

  assert(requiredCheck, `${REQUIRED_CHECK} was not found on ${headSha}`);
  assert(requiredCheck.status === "completed", `${REQUIRED_CHECK} is not complete on ${headSha}`);
  assert(requiredCheck.conclusion === "success", `${REQUIRED_CHECK} did not pass on ${headSha}`);
  assert(requiredCheck.app?.slug === "github-actions", `${REQUIRED_CHECK} was not produced by GitHub Actions`);
  assert(Number.isInteger(requiredCheck.app?.id), "GitHub Actions app ID was not available");

  const appId = requiredCheck.app.id;
  const payload = protectionPayload(appId);

  console.log(
    JSON.stringify(
      {
        repository,
        branch,
        headSha,
        currentlyProtected: branchState.protected,
        requiredCheck: {
          name: requiredCheck.name,
          app: requiredCheck.app.slug,
          appId,
          conclusion: requiredCheck.conclusion,
        },
        proposedProtection: payload,
        signedCommits: {
          enabled: false,
          reason: "Current connector-authored implementation commits are unsigned.",
        },
        ownerException: {
          enabled: true,
          mechanism: "enforce_admins=false",
          reason: "This personal repository has one administrator and cannot use organization-only user bypass lists.",
        },
      },
      null,
      2,
    ),
  );

  if (!apply) {
    console.log("Dry run only. Re-run with --apply and BRANCH_PROTECTION_TOKEN set.");
    return;
  }

  assert(
    token,
    "BRANCH_PROTECTION_TOKEN is required and must have Administration: write for DocDamage/chatbot",
  );

  await request("PUT", `/branches/${encodeURIComponent(branch)}/protection`, payload);
  const protection = await request("GET", `/branches/${encodeURIComponent(branch)}/protection`);
  verifyProtection(protection, appId);

  const finalBranchState = await request("GET", `/branches/${encodeURIComponent(branch)}`);
  assert(finalBranchState.protected === true, `${branch} is not reported as protected after update`);

  console.log(`Verified live branch protection for ${repository}:${branch} at ${headSha}.`);
}

try {
  await main();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
