let schedulerConfig = {
  initialDelayMs: 30 * 1000,
  intervalMs: 24 * 60 * 60 * 1000
};

let runHandler = null;
let delayedTimer = null;
let intervalTimer = null;
let isRunning = false;
let lastRunAt = null;
let lastError = null;
let nextRunAt = null;

async function executeRun() {
  if (isRunning || typeof runHandler !== 'function') return false;
  isRunning = true;
  try {
    await runHandler();
    lastRunAt = new Date().toISOString();
    lastError = null;
  } catch (error) {
    lastError = error?.message || String(error);
  } finally {
    isRunning = false;
  }
  return true;
}

function scheduleNext() {
  nextRunAt = new Date(Date.now() + schedulerConfig.intervalMs).toISOString();
}

function init(handler, options = {}) {
  runHandler = handler;
  schedulerConfig = {
    ...schedulerConfig,
    ...options
  };

  if (delayedTimer) clearTimeout(delayedTimer);
  if (intervalTimer) clearInterval(intervalTimer);

  nextRunAt = new Date(Date.now() + schedulerConfig.initialDelayMs).toISOString();
  delayedTimer = setTimeout(async () => {
    await executeRun();
    scheduleNext();
    intervalTimer = setInterval(async () => {
      await executeRun();
      scheduleNext();
    }, schedulerConfig.intervalMs);
  }, schedulerConfig.initialDelayMs);
}

async function triggerNow() {
  const ran = await executeRun();
  if (ran && intervalTimer) scheduleNext();
  return ran;
}

function getStatus() {
  return {
    is_running: isRunning,
    last_run_at: lastRunAt,
    last_error: lastError,
    next_run_at: nextRunAt,
    interval_ms: schedulerConfig.intervalMs
  };
}

module.exports = {
  init,
  triggerNow,
  getStatus
};
