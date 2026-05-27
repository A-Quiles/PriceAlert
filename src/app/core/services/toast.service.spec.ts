import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
    jasmine.clock().install();
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('starts with empty toasts', () => {
    expect(service.toasts()).toEqual([]);
  });

  describe('show()', () => {
    it('adds a toast to the list', () => {
      service.show('Hello', 'info');
      expect(service.toasts().length).toBe(1);
      expect(service.toasts()[0].message).toBe('Hello');
      expect(service.toasts()[0].type).toBe('info');
    });

    it('assigns a unique id to each toast', () => {
      service.show('A');
      service.show('B');
      const ids = service.toasts().map((t) => t.id);
      expect(ids[0]).not.toBe(ids[1]);
    });

    it('auto-dismisses after duration', fakeAsync(() => {
      service.show('Temp', 'info', 3000);
      expect(service.toasts().length).toBe(1);
      tick(3000);
      expect(service.toasts().length).toBe(0);
    }));

    it('stores duration on the toast', () => {
      service.show('Msg', 'success', 5000);
      expect(service.toasts()[0].duration).toBe(5000);
    });
  });

  describe('convenience methods', () => {
    it('success() adds a success toast', () => {
      service.success('Done');
      expect(service.toasts()[0].type).toBe('success');
    });

    it('error() adds an error toast', () => {
      service.error('Fail');
      expect(service.toasts()[0].type).toBe('error');
    });

    it('info() adds an info toast', () => {
      service.info('Note');
      expect(service.toasts()[0].type).toBe('info');
    });

    it('warning() adds a warning toast', () => {
      service.warning('Careful');
      expect(service.toasts()[0].type).toBe('warning');
    });
  });

  describe('dismiss()', () => {
    it('removes the toast with the given id', () => {
      service.show('Keep');
      service.show('Remove');
      const removeId = service.toasts()[1].id;
      service.dismiss(removeId);
      expect(service.toasts().length).toBe(1);
      expect(service.toasts()[0].message).toBe('Keep');
    });

    it('does nothing if id does not exist', () => {
      service.show('Msg');
      service.dismiss('non-existent-id');
      expect(service.toasts().length).toBe(1);
    });
  });

  describe('multiple toasts', () => {
    it('keeps multiple toasts simultaneously', () => {
      service.success('One');
      service.error('Two');
      service.warning('Three');
      expect(service.toasts().length).toBe(3);
    });
  });
});
