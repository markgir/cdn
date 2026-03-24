/**
 * GitHub Update routes for the Admin Backoffice.
 *
 * Provides safe update-from-GitHub functionality:
 *   GET  /api/update/status  – current git status (branch, commit, modified files)
 *   GET  /api/update/check   – check for available updates from remote
 *   POST /api/update/pull    – safely pull updates (stash → pull → stash pop)
 *
 * Credits: Developed by iddigital.pt
 */

const express = require('express');
const { execFile } = require('child_process');
const path = require('path');
const logger = require('../logger');

const router = express.Router();

const ROOT_DIR = path.resolve(__dirname, '..', '..', '..');

/**
 * Execute a git command safely using execFile (no shell injection).
 * Returns { stdout, stderr } or throws on error.
 */
function git(args) {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd: ROOT_DIR, timeout: 30000 }, (err, stdout, stderr) => {
      if (err) {
        const msg = (stderr || err.message || '').trim();
        const error = new Error(msg || 'Git command failed');
        error.exitCode = err.code;
        return reject(error);
      }
      resolve({ stdout: (stdout || '').trim(), stderr: (stderr || '').trim() });
    });
  });
}

// ── Status ────────────────────────────────────────────────────────────────────
router.get('/status', async (req, res) => {
  try {
    const [branchRes, commitRes, statusRes] = await Promise.all([
      git(['rev-parse', '--abbrev-ref', 'HEAD']),
      git(['log', '-1', '--format=%H|%h|%s|%ai|%an']),
      git(['status', '--porcelain']),
    ]);

    const [hash, shortHash, subject, date, author] = commitRes.stdout.split('|');
    const modifiedFiles = statusRes.stdout
      ? statusRes.stdout.split('\n').map(line => line.trim()).filter(Boolean)
      : [];

    res.json({
      branch: branchRes.stdout,
      commit: { hash, shortHash, subject, date, author },
      modifiedFiles,
      hasLocalChanges: modifiedFiles.length > 0,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get git status: ' + err.message });
  }
});

// ── Check for updates ─────────────────────────────────────────────────────────
router.get('/check', async (req, res) => {
  try {
    // Fetch latest from origin
    await git(['fetch', 'origin']);

    const branchRes = await git(['rev-parse', '--abbrev-ref', 'HEAD']);
    const branch = branchRes.stdout;

    // Get local and remote HEADs
    const [localRes, remoteRes] = await Promise.all([
      git(['rev-parse', 'HEAD']),
      git(['rev-parse', 'origin/' + branch]).catch(() => ({ stdout: '' })),
    ]);

    if (!remoteRes.stdout) {
      return res.json({
        branch,
        upToDate: true,
        message: 'No remote tracking branch found.',
        localCommit: localRes.stdout.substring(0, 7),
      });
    }

    const local = localRes.stdout;
    const remote = remoteRes.stdout;

    if (local === remote) {
      return res.json({
        branch,
        upToDate: true,
        message: 'Already up to date.',
        localCommit: local.substring(0, 7),
        remoteCommit: remote.substring(0, 7),
      });
    }

    // Count commits behind
    const behindRes = await git(['rev-list', '--count', local + '..' + remote]);
    const behind = parseInt(behindRes.stdout, 10) || 0;

    // Get list of new commits
    let newCommits = [];
    if (behind > 0) {
      const logRes = await git([
        'log', '--oneline', '--format=%h|%s|%ai|%an',
        local + '..' + remote,
      ]);
      newCommits = logRes.stdout.split('\n').filter(Boolean).map(line => {
        const [hash, subject, date, author] = line.split('|');
        return { hash, subject, date, author };
      });
    }

    res.json({
      branch,
      upToDate: behind === 0,
      behind,
      localCommit: local.substring(0, 7),
      remoteCommit: remote.substring(0, 7),
      newCommits,
      message: behind > 0 ? `${behind} update(s) available.` : 'Up to date.',
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check for updates: ' + err.message });
  }
});

// ── Pull updates safely ───────────────────────────────────────────────────────
router.post('/pull', async (req, res) => {
  const steps = [];
  let stashed = false;

  try {
    // Step 1: Check for local changes
    const statusRes = await git(['status', '--porcelain']);
    const hasChanges = statusRes.stdout.length > 0;
    steps.push({ step: 'check_local_changes', success: true, hasChanges });

    // Step 2: Stash local changes if any
    if (hasChanges) {
      const stashMsg = 'cdn-admin-auto-stash-' + Date.now();
      await git(['stash', 'push', '-m', stashMsg]);
      stashed = true;
      steps.push({ step: 'stash_changes', success: true, message: 'Local changes stashed.' });
      logger.logger.info('Update: stashed local changes before pull');
    }

    // Step 3: Pull from origin
    const branchRes = await git(['rev-parse', '--abbrev-ref', 'HEAD']);
    const branch = branchRes.stdout;
    const pullRes = await git(['pull', 'origin', branch]);
    steps.push({ step: 'pull', success: true, output: pullRes.stdout });
    logger.logger.info('Update: pulled from origin/' + branch);

    // Step 4: Restore stashed changes
    if (stashed) {
      try {
        await git(['stash', 'pop']);
        steps.push({ step: 'restore_changes', success: true, message: 'Local changes restored.' });
        logger.logger.info('Update: restored stashed changes');
      } catch (popErr) {
        steps.push({
          step: 'restore_changes',
          success: false,
          message: 'Conflict restoring changes. Stash preserved. Run "git stash pop" manually.',
          error: popErr.message,
        });
        logger.logger.warn('Update: conflict restoring stash - ' + popErr.message);
      }
    }

    // Step 5: Get new commit info
    const commitRes = await git(['log', '-1', '--format=%h|%s|%ai']);
    const [hash, subject, date] = commitRes.stdout.split('|');

    res.json({
      success: true,
      message: 'Update completed successfully.',
      currentCommit: { hash, subject, date },
      steps,
    });
  } catch (err) {
    // If pull failed and we stashed, try to restore
    if (stashed) {
      try {
        await git(['stash', 'pop']);
        steps.push({ step: 'restore_after_error', success: true, message: 'Changes restored after error.' });
      } catch (restoreErr) {
        steps.push({ step: 'restore_after_error', success: false, error: restoreErr.message });
      }
    }
    logger.logger.error('Update failed: ' + err.message);
    res.status(500).json({
      success: false,
      error: 'Update failed: ' + err.message,
      steps,
    });
  }
});

module.exports = { updateRouter: router };
