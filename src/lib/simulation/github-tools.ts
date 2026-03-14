/**
 * GitHub REST API helpers for simulation agents.
 * Each function takes a GitHub installation token + owner/repo.
 */

const GH_API = 'https://api.github.com';
const GH_TIMEOUT = 30_000;

function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'OpenPod-Simulation',
  };
}

function sanitizePath(p: string): string {
  const normalized = p.replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalized.includes('..') || normalized.includes('\0')) {
    throw new Error('Invalid path: traversal or null bytes detected');
  }
  return normalized;
}

function sanitizeBranchName(name: string): string {
  if (/\.\.|\x00|[\x01-\x1f~^:?*\[\\]/.test(name)) {
    throw new Error('Invalid branch name');
  }
  return name;
}

function sanitizeGhError(status: number, body: string): string {
  const safe = body.slice(0, 200).replace(/token[^\s]*/gi, '[REDACTED]');
  return `GitHub API error ${status}: ${safe}`;
}

async function ghFetch(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GH_TIMEOUT);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export interface RepoEntry {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size: number;
}

/** List files/dirs at a given path in the repo */
export async function getRepoTree(
  token: string,
  owner: string,
  repo: string,
  path: string = '',
): Promise<{ entries: RepoEntry[] } | { error: string }> {
  const safePath = sanitizePath(path);
  const url = `${GH_API}/repos/${owner}/${repo}/contents/${safePath}`;
  const res = await ghFetch(url, { headers: ghHeaders(token) });
  if (!res.ok) {
    const body = await res.text();
    return { error: sanitizeGhError(res.status, body) };
  }
  const data = await res.json();
  if (!Array.isArray(data)) {
    return { entries: [{ name: data.name, path: data.path, type: 'file', size: data.size }] };
  }
  const entries: RepoEntry[] = data.map((item: { name: string; path: string; type: string; size: number }) => ({
    name: item.name,
    path: item.path,
    type: item.type === 'dir' ? 'dir' : 'file',
    size: item.size || 0,
  }));
  return { entries };
}

/** Read a file's content from the repo */
export async function readFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  ref?: string,
): Promise<{ content: string; sha: string } | { error: string }> {
  const safePath = sanitizePath(path);
  let url = `${GH_API}/repos/${owner}/${repo}/contents/${safePath}`;
  if (ref) url += `?ref=${encodeURIComponent(ref)}`;
  const res = await ghFetch(url, { headers: ghHeaders(token) });
  if (!res.ok) {
    const body = await res.text();
    return { error: sanitizeGhError(res.status, body) };
  }
  const data = await res.json();
  if (data.type !== 'file') {
    return { error: `Path is a ${data.type}, not a file` };
  }
  // Size guard — prevent OOM on large files
  if (data.size > 1_000_000) {
    return { error: `File too large (${data.size} bytes). Max 1MB for inline read.` };
  }
  if (!data.content || data.encoding !== 'base64') {
    return { error: `Cannot read file: encoding is '${data.encoding}', not base64` };
  }
  const content = Buffer.from(data.content, 'base64').toString('utf-8');
  return { content, sha: data.sha };
}

/** Create a new branch from a base branch */
export async function createBranch(
  token: string,
  owner: string,
  repo: string,
  branchName: string,
  base: string = 'main',
): Promise<{ ref: string } | { error: string }> {
  const safeBranch = sanitizeBranchName(branchName);
  const safeBase = sanitizeBranchName(base);

  const refRes = await ghFetch(`${GH_API}/repos/${owner}/${repo}/git/ref/heads/${safeBase}`, {
    headers: ghHeaders(token),
  });
  if (!refRes.ok) {
    const body = await refRes.text();
    return { error: sanitizeGhError(refRes.status, body) };
  }
  const refData = await refRes.json();
  const sha = refData.object.sha;

  const createRes = await ghFetch(`${GH_API}/repos/${owner}/${repo}/git/refs`, {
    method: 'POST',
    headers: { ...ghHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: `refs/heads/${safeBranch}`, sha }),
  });
  if (!createRes.ok) {
    const body = await createRes.text();
    if (createRes.status === 422 && body.includes('Reference already exists')) {
      return { ref: `refs/heads/${safeBranch}` };
    }
    return { error: sanitizeGhError(createRes.status, body) };
  }
  return { ref: `refs/heads/${safeBranch}` };
}

/** Create or update a file on a branch */
export async function writeFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  branch: string,
  message: string,
): Promise<{ commitSha: string; path: string } | { error: string }> {
  const safePath = sanitizePath(path);
  const safeBranch = sanitizeBranchName(branch);

  const checkUrl = `${GH_API}/repos/${owner}/${repo}/contents/${safePath}?ref=${encodeURIComponent(safeBranch)}`;
  const checkRes = await ghFetch(checkUrl, { headers: ghHeaders(token) });
  let existingSha: string | undefined;
  if (checkRes.ok) {
    const existing = await checkRes.json();
    existingSha = existing.sha;
  } else {
    await checkRes.text(); // consume body to free connection
  }

  const putBody: Record<string, string> = {
    message,
    content: Buffer.from(content, 'utf-8').toString('base64'),
    branch: safeBranch,
  };
  if (existingSha) {
    putBody.sha = existingSha;
  }

  const putRes = await ghFetch(`${GH_API}/repos/${owner}/${repo}/contents/${safePath}`, {
    method: 'PUT',
    headers: { ...ghHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(putBody),
  });
  if (!putRes.ok) {
    const errBody = await putRes.text();
    return { error: sanitizeGhError(putRes.status, errBody) };
  }
  const data = await putRes.json();
  return { commitSha: data.commit?.sha || 'unknown', path: safePath };
}

/** Create a pull request */
export async function createPullRequest(
  token: string,
  owner: string,
  repo: string,
  title: string,
  head: string,
  base: string = 'main',
  body?: string,
): Promise<{ number: number; url: string; html_url: string } | { error: string }> {
  const res = await ghFetch(`${GH_API}/repos/${owner}/${repo}/pulls`, {
    method: 'POST',
    headers: { ...ghHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, head, base, body: body || '' }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    return { error: sanitizeGhError(res.status, errBody) };
  }
  const data = await res.json();
  return { number: data.number, url: data.url, html_url: data.html_url };
}

/** Merge a pull request */
export async function mergePullRequest(
  token: string,
  owner: string,
  repo: string,
  pullNumber: number,
  mergeMethod: 'merge' | 'squash' | 'rebase' = 'squash',
): Promise<{ sha: string; merged: boolean } | { error: string }> {
  const res = await ghFetch(`${GH_API}/repos/${owner}/${repo}/pulls/${pullNumber}/merge`, {
    method: 'PUT',
    headers: { ...ghHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ merge_method: mergeMethod }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    return { error: sanitizeGhError(res.status, errBody) };
  }
  const data = await res.json();
  return { sha: data.sha || 'unknown', merged: data.merged ?? true };
}

/** List pull requests */
export async function listPullRequests(
  token: string,
  owner: string,
  repo: string,
  state: string = 'open',
): Promise<{ prs: Array<{ number: number; title: string; state: string; head: string; url: string }> } | { error: string }> {
  const validStates = ['open', 'closed', 'all'];
  const safeState = validStates.includes(state) ? state : 'open';
  const res = await ghFetch(`${GH_API}/repos/${owner}/${repo}/pulls?state=${safeState}&per_page=20`, {
    headers: ghHeaders(token),
  });
  if (!res.ok) {
    const errBody = await res.text();
    return { error: sanitizeGhError(res.status, errBody) };
  }
  const data = await res.json();
  const prs = data.map((pr: { number: number; title: string; state: string; head: { ref: string }; html_url: string }) => ({
    number: pr.number,
    title: pr.title,
    state: pr.state,
    head: pr.head.ref,
    url: pr.html_url,
  }));
  return { prs };
}
