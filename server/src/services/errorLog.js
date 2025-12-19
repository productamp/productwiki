// In-memory error log storage
const errorLogs = [];
const MAX_LOGS = 100;

export function logError(message) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${message}`;
  errorLogs.unshift(entry);

  // Keep only the most recent logs
  if (errorLogs.length > MAX_LOGS) {
    errorLogs.pop();
  }

  console.error(entry);
}

export function getErrorLogs() {
  return [...errorLogs];
}

export function clearErrorLogs() {
  errorLogs.length = 0;
}
