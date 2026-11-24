import { Box, Stack, Typography, type SxProps, type Theme } from '@mui/material';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  sx?: SxProps<Theme>;
}

export const EmptyState = ({ title, description, action, sx }: EmptyStateProps) => (
  <Box
    sx={{
      border: '1px dashed',
      borderColor: 'divider',
      borderRadius: 2,
      p: 4,
      textAlign: 'center',
      ...sx,
    }}
  >
    <Stack spacing={1} sx={{ alignItems: 'center' }}>
      <Typography variant="h6">{title}</Typography>
      {description ? (
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      ) : null}
      {action}
    </Stack>
  </Box>
);
