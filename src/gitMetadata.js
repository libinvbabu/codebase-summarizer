import { execSync } from 'child_process';
import path from 'path';

export class GitMetadata {
  static extract(projectRoot) {
    try {
      const gitRoot = path.resolve(projectRoot);

      const sha = execSync('git rev-parse HEAD', { cwd: gitRoot }).toString().trim();
      const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: gitRoot }).toString().trim();
      const remote = execSync('git config --get remote.origin.url', { cwd: gitRoot }).toString().trim();

      return {
        sha,
        branch,
        remote
      };
    } catch (err) {
      return {
        sha: null,
        branch: null,
        remote: null
      };
    }
  }
}
