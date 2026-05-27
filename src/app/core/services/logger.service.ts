import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  ts: string; // ISO timestamp
  level: LogLevel;
  context: string;
  message: string;
  data?: unknown;
}

const LEVEL_STYLES: Record<LogLevel, string> = {
  debug: 'color:#9E9E9E;font-weight:normal',
  info: 'color:#2196F3;font-weight:bold',
  warn: 'color:#FF9800;font-weight:bold',
  error: 'color:#F44336;font-weight:bold',
};

const STORAGE_KEY = 'price_alert_logs';
const MAX_ENTRIES = 500;

@Injectable({
  providedIn: 'root',
})
export class LoggerService {
  private readonly isDev = !environment.production;

  // ── Persistencia en localStorage ─────────────────────────────────────────

  private persist(entry: LogEntry): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const entries: LogEntry[] = raw ? (JSON.parse(raw) as LogEntry[]) : [];
      entries.push(entry);
      if (entries.length > MAX_ENTRIES) {
        entries.splice(0, entries.length - MAX_ENTRIES);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // Storage lleno o no disponible — ignorar silenciosamente
    }
  }

  /** Descarga todos los logs guardados como fichero .log */
  downloadLogs(): void {
    const raw = localStorage.getItem(STORAGE_KEY) ?? '[]';
    const entries: LogEntry[] = JSON.parse(raw) as LogEntry[];
    const lines = entries.map((e) => {
      const dataStr = e.data !== undefined ? ' ' + JSON.stringify(e.data) : '';
      return `[${e.ts}] [${e.level.toUpperCase().padEnd(5)}] [${e.context}] ${e.message}${dataStr}`;
    });
    const blob = new Blob([lines.join('\n')], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `price-alert-${new Date().toISOString().substring(0, 19).replace(/:/g, '-')}.log`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Borra todos los logs almacenados */
  clearLogs(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  /** Devuelve los logs en memoria como array */
  getLogs(): LogEntry[] {
    const raw = localStorage.getItem(STORAGE_KEY) ?? '[]';
    return JSON.parse(raw) as LogEntry[];
  }

  // ── Métodos de log ────────────────────────────────────────────────────────

  private log(
    level: LogLevel,
    context: string,
    message: string,
    ...data: unknown[]
  ): void {
    if (level === 'debug' && !this.isDev) return;

    const ts = new Date().toISOString();
    const prefix = `[${ts.substring(11, 23)}] [${level.toUpperCase().padEnd(5)}] [${context}]`;
    const method = level === 'debug' ? 'log' : level;

    if (data.length > 0) {
      console[method](`%c${prefix} ${message}`, LEVEL_STYLES[level], ...data);
    } else {
      console[method](`%c${prefix} ${message}`, LEVEL_STYLES[level]);
    }

    this.persist({
      ts,
      level,
      context,
      message,
      data: data.length === 1 ? data[0] : data.length > 1 ? data : undefined,
    });
  }

  debug(context: string, message: string, ...data: unknown[]): void {
    this.log('debug', context, message, ...data);
  }

  info(context: string, message: string, ...data: unknown[]): void {
    this.log('info', context, message, ...data);
  }

  warn(context: string, message: string, ...data: unknown[]): void {
    this.log('warn', context, message, ...data);
  }

  error(context: string, message: string, ...data: unknown[]): void {
    this.log('error', context, message, ...data);
  }

  /** Logs a Supabase error with full details */
  supabaseError(context: string, operation: string, error: unknown): void {
    const err = error as {
      message?: string;
      code?: string;
      details?: string;
      hint?: string;
    };
    this.log(
      'error',
      context,
      `Supabase "${operation}" failed → ${err?.message ?? 'unknown error'}`,
      { code: err?.code, details: err?.details, hint: err?.hint },
    );
  }

  /** Logs a fetch error distinguishing network vs HTTP errors */
  fetchError(context: string, url: string, error: unknown): void {
    if (error instanceof TypeError) {
      this.log(
        'error',
        context,
        `Error de red → ${url} | Causa: ${error.message} | ¿Está corriendo "vercel dev"?`,
      );
    } else {
      this.log('error', context, `Fetch error → ${url}`, error);
    }
  }
}
