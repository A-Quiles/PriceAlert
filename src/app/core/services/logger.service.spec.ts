import { TestBed } from '@angular/core/testing';
import { LoggerService } from './logger.service';

const STORAGE_KEY = 'price_alert_logs';

describe('LoggerService', () => {
  let service: LoggerService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(LoggerService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getLogs', () => {
    it('returns empty array when no logs stored', () => {
      expect(service.getLogs()).toEqual([]);
    });

    it('returns stored logs', () => {
      service.info('Ctx', 'Test message');
      const logs = service.getLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].level).toBe('info');
      expect(logs[0].context).toBe('Ctx');
      expect(logs[0].message).toBe('Test message');
    });
  });

  describe('log methods', () => {
    it('debug() stores a debug entry', () => {
      service.debug('Ctx', 'debug msg');
      const logs = service.getLogs();
      expect(logs[0].level).toBe('debug');
    });

    it('info() stores an info entry', () => {
      service.info('Ctx', 'info msg');
      expect(service.getLogs()[0].level).toBe('info');
    });

    it('warn() stores a warn entry', () => {
      service.warn('Ctx', 'warn msg');
      expect(service.getLogs()[0].level).toBe('warn');
    });

    it('error() stores an error entry', () => {
      service.error('Ctx', 'error msg');
      expect(service.getLogs()[0].level).toBe('error');
    });

    it('stores data payload alongside message', () => {
      service.info('Ctx', 'msg', { key: 'value' });
      expect(service.getLogs()[0].data).toEqual({ key: 'value' });
    });

    it('stores timestamp in ISO format', () => {
      service.info('Ctx', 'msg');
      const ts = service.getLogs()[0].ts;
      expect(() => new Date(ts)).not.toThrow();
      expect(new Date(ts).toISOString()).toBe(ts);
    });
  });

  describe('supabaseError()', () => {
    it('stores an error entry with supabase error details', () => {
      const fakeError = {
        message: 'db fail',
        code: '42P01',
        details: 'relation not found',
        hint: '',
      };
      service.supabaseError('Ctx', 'testOp', fakeError as any);
      const logs = service.getLogs();
      expect(logs[0].level).toBe('error');
      expect(logs[0].message).toContain('testOp');
    });
  });

  describe('fetchError()', () => {
    it('stores network error when TypeError', () => {
      service.fetchError('Ctx', '/api/test', new TypeError('Failed to fetch'));
      const logs = service.getLogs();
      expect(logs[0].level).toBe('error');
    });

    it('stores generic error for non-TypeError', () => {
      service.fetchError('Ctx', '/api/test', new Error('HTTP 500'));
      const logs = service.getLogs();
      expect(logs[0].level).toBe('error');
    });
  });

  describe('clearLogs()', () => {
    it('removes all stored logs', () => {
      service.info('Ctx', 'msg1');
      service.info('Ctx', 'msg2');
      service.clearLogs();
      expect(service.getLogs()).toEqual([]);
    });

    it('removes the localStorage key', () => {
      service.info('Ctx', 'msg');
      service.clearLogs();
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  describe('MAX_ENTRIES cap', () => {
    it('does not exceed 500 stored entries', () => {
      for (let i = 0; i < 510; i++) {
        service.info('Ctx', `msg ${i}`);
      }
      expect(service.getLogs().length).toBeLessThanOrEqual(500);
    });

    it('keeps the most recent entries when over limit', () => {
      for (let i = 0; i < 510; i++) {
        service.info('Ctx', `msg ${i}`);
      }
      const logs = service.getLogs();
      expect(logs[logs.length - 1].message).toBe('msg 509');
    });
  });

  describe('downloadLogs()', () => {
    it('creates and clicks a download anchor', () => {
      service.info('Ctx', 'download test');
      const anchor = document.createElement('a');
      spyOn(document, 'createElement').and.returnValue(anchor);
      spyOn(anchor, 'click');
      spyOn(URL, 'createObjectURL').and.returnValue('blob:test');
      spyOn(URL, 'revokeObjectURL');

      service.downloadLogs();

      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(anchor.click).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
    });
  });
});
