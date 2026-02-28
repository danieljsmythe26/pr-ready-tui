import { useState, useCallback } from 'react';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { PR, Agent, AgentAction, RepoConfig } from '../types.js';
import { CODING_DIR } from '../types.js';

interface UseAgentResult {
  copied: boolean;
  error: string | null;
  spawn: (agent: Agent, repo: RepoConfig, pr: PR, action: AgentAction) => void;
}

export function useAgent(): UseAgentResult {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const spawn = useCallback((agent: Agent, repo: RepoConfig, pr: PR, action: AgentAction) => {
    const cmd = agent.command(repo, pr, action);

    // Use localPath override if set, otherwise resolve from CODING_DIR
    const baseDir = path.resolve(CODING_DIR);
    const repoPath = repo.localPath
      ? path.resolve(repo.localPath)
      : path.resolve(baseDir, repo.repo);

    // Path traversal guard on fallback path
    if (!repo.localPath && !repoPath.startsWith(baseDir + path.sep)) {
      setError(`Invalid repo path: ${repo.repo} escapes base directory`);
      return;
    }

    if (!existsSync(repoPath)) {
      setError(`Repo directory not found: ${repoPath}. Set localPath in REPOS config or PRT_REPOS_DIR env var.`);
      return;
    }

    setError(null);

    // Build full command: cd to repo dir, then run agent command
    const fullCmd = `cd ${repoPath} && ${cmd}`;

    // Copy to clipboard via pbcopy
    const clipCmd = process.platform === 'darwin' ? 'pbcopy' : 'xclip';
    const clipArgs = process.platform === 'darwin' ? [] : ['-selection', 'clipboard'];
    const child = execFile(clipCmd, clipArgs, { timeout: 5000 }, (err) => {
      if (err) {
        setError(`Clipboard failed: ${err.message}`);
        return;
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 4000);
    });
    child.stdin?.write(fullCmd);
    child.stdin?.end();
  }, []);

  return { copied, error, spawn };
}
