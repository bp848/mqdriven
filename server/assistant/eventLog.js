const fs = require('fs');
const path = require('path');

const LOG_DIR = process.env.ASSISTANT_LOG_DIR
  ? path.resolve(process.env.ASSISTANT_LOG_DIR)
  : path.resolve(__dirname, '..', '..', 'data', 'assistant-events');

function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function appendEvent(row) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const file = path.join(LOG_DIR, `${dayKey()}.jsonl`);
  fs.appendFileSync(file, `${JSON.stringify(row)}\n`, 'utf-8');
}

function readEventsForToday() {
  try {
    const file = path.join(LOG_DIR, `${dayKey()}.jsonl`);
    if (!fs.existsSync(file)) return [];
    const lines = fs.readFileSync(file, 'utf-8').split('\n').filter(Boolean);
    return lines.map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

module.exports = {
  appendEvent,
  readEventsForToday,
};
