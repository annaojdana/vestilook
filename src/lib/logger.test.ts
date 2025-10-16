import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createLogger } from './logger.ts';

describe('createLogger', () => {
  const destination = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('respects log level thresholds', () => {
    const logger = createLogger({ destination, level: 'warn', name: 'test' });

    logger.debug('debug message', { foo: 'bar' });
    logger.info('info message');
    logger.warn('warn message', { foo: 'bar' });

    expect(destination.debug).not.toHaveBeenCalled();
    expect(destination.info).not.toHaveBeenCalled();

    expect(destination.warn).toHaveBeenCalledWith('[test] warn message', { foo: 'bar' });
  });

  it('merges child context without mutating parent', () => {
    const parent = createLogger({ destination, context: { requestId: 'req-1' } });
    const child = parent.child({ userId: 'user-123' });

    child.error('failed', { reason: 'timeout' });

    expect(destination.error).toHaveBeenCalledWith('failed', {
      requestId: 'req-1',
      userId: 'user-123',
      reason: 'timeout',
    });

    parent.info('parent log');
    expect(destination.info).toHaveBeenCalledWith('parent log', { requestId: 'req-1' });
  });

  it('generates request scoped logger with request id', () => {
    const logger = createLogger({ destination }).withRequest();

    logger.info('scoped');

    const [, context] = destination.info.mock.lastCall ?? [];
    expect(context?.requestId).toMatch(/[0-9a-f-]{36}/);
  });
});
