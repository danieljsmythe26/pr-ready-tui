import { useState, useCallback } from 'react';
import { execFile } from 'node:child_process';
import path from 'node:path';
import type { PR, Agent, AgentAction, RepoConfig } from '../types.js';

interface UseAgentResult {
  running: boolean;
  sessionName: string | null;
  spawn: (agent: Agent, repo: RepoConfig, pr: PR, action: AgentAction) => void;
}

export function useAgent(onComplete?: () => void): UseAgentResult {
  const [running, setRunning] = useState(false);
  const [sessionName, setSessionName] = useState<string | null>(null);

  const spawn = useCallback((agent: Agent, repo: RepoConfig, pr: PR, action: AgentAction) => {
    const name = `prt-${agent.id}-${pr.number}`;
    const cmd = agent.command(repo, pr, action);
    const baseDir = process.env.PRT_REPOS_DIR || process.cwd();
    const repoPath = path.join(baseDir, repo.repo);

    setRunning(true);
    setSessionName(name);

    // Spawn in a tmux session — use bash -lc so the full command string
    // is interpreted by a shell (handles spaces, quotes, pipes, etc.)
    execFile('tmux', [
      'new-session', '-d', '-s', name, '-c', repoPath, 'bash', '-lc', cmd,
    ], (err) => {
      if (err) {
        setRunning(false);
        setSessionName(null);
        return;
      }

      // Poll for tmux session to end
      const interval = setInterval(() => {
        execFile('tmux', ['has-session', '-t', name], (hasErr) => {
          if (hasErr) {
            // Session ended
            clearInterval(interval);
            setRunning(false);
            setSessionName(null);
            onComplete?.();
          }
        });
      }, 3000);
    });
  }, [onComplete]);

  return { running, sessionName, spawn };
}
