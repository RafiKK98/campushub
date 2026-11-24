import { describe, expect, it } from 'vitest';
import {
  formatGrade,
  formatPercent,
  formatScheduleDay,
  formatTimeRange,
  isFuture,
  isPast,
} from './format';

describe('format helpers', () => {
  it('formats grades and percentages', () => {
    expect(formatGrade(85, 100)).toBe('85 / 100');
    expect(formatGrade(null, 100)).toBe('Not graded');
    expect(formatPercent(92.34)).toBe('92.3%');
    expect(formatPercent(null)).toBe('No grades yet');
  });

  it('formats schedule day and time ranges', () => {
    expect(formatScheduleDay('MONDAY')).toBe('Monday');
    expect(formatTimeRange('09:00', '10:30')).toBe('09:00 - 10:30');
  });

  it('detects past and future timestamps', () => {
    expect(isPast('2000-01-01T00:00:00.000Z')).toBe(true);
    expect(isFuture('2099-01-01T00:00:00.000Z')).toBe(true);
  });
});
