const { getRequestLogs, addRequestLog } = require('../src/logger');

describe('Logger module', () => {
  test('addRequestLog prepends entries', () => {
    const before = getRequestLogs().length;
    addRequestLog({ id: 'test-1', url: '/test', method: 'GET', status: 200, timestamp: new Date().toISOString() });
    const logs = getRequestLogs();
    expect(logs.length).toBe(before + 1);
    expect(logs[0].id).toBe('test-1');
  });

  test('getRequestLogs returns array', () => {
    const logs = getRequestLogs();
    expect(Array.isArray(logs)).toBe(true);
  });
});
