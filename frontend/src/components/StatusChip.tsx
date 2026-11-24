import { Chip, type ChipProps } from '@mui/material';

const STATUS_COLORS: Record<string, ChipProps['color']> = {
  OPEN: 'success',
  DRAFT: 'default',
  CLOSED: 'warning',
  ARCHIVED: 'default',
  ENROLLED: 'success',
  DROPPED: 'default',
  ADMIN: 'secondary',
  INSTRUCTOR: 'primary',
  STUDENT: 'info',
  ACTIVE: 'success',
  INACTIVE: 'default',
  GRADED: 'success',
  PENDING: 'warning',
  LATE: 'warning',
};

const humanize = (value: string): string => {
  const normalized = value.toLowerCase().replaceAll('_', ' ');
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

interface StatusChipProps {
  status: string;
  label?: string;
}

export const StatusChip = ({ status, label }: StatusChipProps) => (
  <Chip
    size="small"
    label={label ?? humanize(status)}
    color={STATUS_COLORS[status] ?? 'default'}
    variant={STATUS_COLORS[status] ? 'filled' : 'outlined'}
  />
);
