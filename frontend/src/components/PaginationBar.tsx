import { Pagination, Stack, Typography } from '@mui/material';
import type { PaginationMeta } from '../types/api';

interface PaginationBarProps {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
}

export const PaginationBar = ({ meta, onPageChange }: PaginationBarProps) => (
  <Stack
    direction="row"
    sx={{ mt: 2, flexWrap: 'wrap', gap: 1, justifyContent: 'space-between', alignItems: 'center' }}
  >
    <Typography variant="body2" color="text.secondary">
      {meta.total} result{meta.total === 1 ? '' : 's'}
    </Typography>
    {meta.totalPages > 1 ? (
      <Pagination
        count={meta.totalPages}
        page={meta.page}
        onChange={(_event, page) => onPageChange(page)}
        color="primary"
        size="small"
        showFirstButton
        showLastButton
      />
    ) : null}
  </Stack>
);
