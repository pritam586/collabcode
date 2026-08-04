import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const RUN_TIMEOUT_MS = 5_000;
const MAX_OUTPUT_LENGTH = 16_000;
const MAX_RUN_CODE_LENGTH = 25_000;
const runners = {
  java: {
    filename: 'Main.java',
    image: process.env.JAVA_RUNNER_IMAGE || 'eclipse-temurin:21-jdk-alpine',
    command: 'cp /code/Main.java /tmp/Main.java && javac -d /tmp /tmp/Main.java && java -cp /tmp Main',
  },
  cpp: {
    filename: 'main.cpp',
    image: process.env.CPP_RUNNER_IMAGE || 'gcc:14.2.0',
    command: 'g++ -std=c++17 -O2 /code/main.cpp -o /tmp/program && /tmp/program',
  },
};

export class CodeRunnerError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function runCompiledCode(language, code) {
  if (process.env.CODE_RUNNER_ENABLED === 'false') {
    throw new CodeRunnerError('The code runner is disabled on this server.', 503);
  }
  if (!runners[language]) throw new CodeRunnerError('Only Java and C++ are supported by this runner.');
  if (typeof code !== 'string' || code.length === 0 || code.length > MAX_RUN_CODE_LENGTH) {
    throw new CodeRunnerError(`Code must be between 1 and ${MAX_RUN_CODE_LENGTH} characters.`);
  }

  const runner = runners[language];
  const workingDirectory = await mkdtemp(join(tmpdir(), 'collabcode-run-'));
  try {
    await writeFile(join(workingDirectory, runner.filename), code, { encoding: 'utf8', mode: 0o600 });
    return await runInDocker(workingDirectory, runner);
  } finally {
    await rm(workingDirectory, { recursive: true, force: true });
  }
}

function runInDocker(workingDirectory, runner) {
  const containerName = `collabcode-run-${randomBytes(8).toString('hex')}`;
  const args = [
    'run', '--rm', '--name', containerName,
    '--network', 'none',
    '--read-only',
    '--pids-limit', '64',
    '--memory', '256m',
    '--cpus', '1',
    '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges',
    '--tmpfs', '/tmp:rw,nosuid,size=64m',
    '--mount', `type=bind,source=${workingDirectory},target=/code,readonly`,
    runner.image,
    'sh', '-c', runner.command,
  ];

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const dockerProcess = spawn(process.env.DOCKER_BIN || 'docker', args, { windowsHide: true });
    const cleanupContainer = () => spawn(process.env.DOCKER_BIN || 'docker', ['rm', '-f', containerName], { windowsHide: true });
    const timeout = setTimeout(() => {
      timedOut = true;
      dockerProcess.kill();
      cleanupContainer();
    }, RUN_TIMEOUT_MS);

    dockerProcess.stdout.on('data', (chunk) => { stdout = appendOutput(stdout, chunk); });
    dockerProcess.stderr.on('data', (chunk) => { stderr = appendOutput(stderr, chunk); });
    dockerProcess.on('error', () => {
      clearTimeout(timeout);
      reject(new CodeRunnerError('Docker Desktop is unavailable. Start Docker Desktop and try again.', 503));
    });
    dockerProcess.on('close', (exitCode) => {
      clearTimeout(timeout);
      if (timedOut) {
        reject(new CodeRunnerError('Execution stopped after 5 seconds.', 408));
        return;
      }
      resolve({ stdout, stderr, exitCode });
    });
  });
}

function appendOutput(current, chunk) {
  return `${current}${chunk}`.slice(0, MAX_OUTPUT_LENGTH);
}
