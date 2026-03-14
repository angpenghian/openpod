/**
 * GitHub REST API helpers for simulation agents.
 * Each function takes a GitHub installation token + owner/repo.
 */

const GH_API = 'https://api.github.com';

function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'OpenPod-Simulation',
  };
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
  const url = `${GH_API}/repos/${owner}/${repo}/contents/${path}`;
  const res = await fetch(url, { headers: ghHeaders(token) });
  if (!res.ok) {
    const body = await res.text();
    return { error: `GitHub API error ${res.status}: ${body.slice(0, 200)}` };
  }
  const data = await res.json();
  if (!Array.isArray(data)) {
    // Single file, not a directory
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
  let url = `${GH_API}/repos/${owner}/${repo}/contents/${path}`;
  if (ref) url += `?ref=${encodeURIComponent(ref)}`;
  const res = await fetch(url, { headers: ghHeaders(token) });
  if (!res.ok) {
    const body = await res.text();
    return { error: `GitHub API error ${res.status}: ${body.slice(0, 200)}` };
  }
  const data = await res.json();
  if (data.type !== 'file') {
    return { error: `Path is a ${data.type}, not a file` };
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
  // 1. Get base branch SHA
  const refRes = await fetch(`${GH_API}/repos/${owner}/${repo}/git/ref/heads/${base}`, {
    headers: ghHeaders(token),
  });
  if (!refRes.ok) {
    const body = await refRes.text();
    return { error: `Failed to get base branch '${base}': ${body.slice(0, 200)}` };
  }
  const refData = await refRes.json();
  const sha = refData.object.sha;

  // 2. Create new ref
  const createRes = await fetch(`${GH_API}/repos/${owner}/${repo}/git/refs`, {
    method: 'POST',
    headers: { ...ghHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha }),
  });
  if (!createRes.ok) {
    const body = await createRes.text();
    if (createRes.status === 422 && body.includes('Reference already exists')) {
      return { ref: `refs/heads/${branchName}` }; // Already exists, that's fine
    }
    return { error: `Failed to create branch: ${body.slice(0, 200)}` };
  }
  return { ref: `refs/heads/${branchName}` };
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
  // Check if file exists to get SHA for update
  const checkUrl = `${GH_API}/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`;
  const checkRes = await fetch(checkUrl, { headers: ghHeaders(token) });
  let existingSha: string | undefined;
  if (checkRes.ok) {
    const existing = await checkRes.json();
    existingSha = existing.sha;
  }

  const body: Record<string, string> = {
    message,
    content: Buffer.from(content, 'utf-8').toString('base64'),
    branch,
  };
  if (existingSha) {
    body.sha = existingSha;
  }

  const putRes = await fetch(`${GH_API}/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: { ...ghHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!putRes.ok) {
    const errBody = await putRes.text();
    return { error: `Failed to write file: ${errBody.slice(0, 200)}` };
  }
  const data = await putRes.json();
  return { commitSha: data.commit?.sha || 'unknown', path };
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
  const res = await fetch(`${GH_API}/repos/${owner}/${repo}/pulls`, {
    method: 'POST',
    headers: { ...ghHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, head, base, body: body || '' }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    return { error: `Failed to create PR: ${errBody.slice(0, 200)}` };
  }
  const data = await res.json();
  return { number: data.number, url: data.url, html_url: data.html_url };
}

/** List pull requests */
export async function listPullRequests(
  token: string,
  owner: string,
  repo: string,
  state: string = 'open',
): Promise<{ prs: Array<{ number: number; title: string; state: string; head: string; url: string }> } | { error: string }> {
  const res = await fetch(`${GH_API}/repos/${owner}/${repo}/pulls?state=${state}&per_page=20`, {
    headers: ghHeaders(token),
  });
  if (!res.ok) {
    const errBody = await res.text();
    return { error: `Failed to list PRs: ${errBody.slice(0, 200)}` };
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
