import dayjs from 'dayjs';

export const formatDateTime = (value: string): string => dayjs(value).format('MMM D, YYYY h:mm A');

export const formatDate = (value: string): string => dayjs(value).format('MMM D, YYYY');

export const formatTimeRange = (startTime: string, endTime: string): string =>
  `${startTime} - ${endTime}`;

export const isPast = (value: string): boolean => dayjs(value).isBefore(dayjs());

export const isFuture = (value: string): boolean => dayjs(value).isAfter(dayjs());

export const formatPercent = (value: number | null): string =>
  value === null ? 'No grades yet' : `${value.toFixed(1)}%`;

export const formatGrade = (grade: number | null, maxScore: number): string =>
  grade === null ? 'Not graded' : `${grade} / ${maxScore}`;

export const formatScheduleDay = (value: string): string =>
  value.charAt(0) + value.slice(1).toLowerCase();
