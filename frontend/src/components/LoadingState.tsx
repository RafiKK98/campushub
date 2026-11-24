import { Box, CircularProgress, Stack, Typography } from '@mui/material';

interface LoadingStateProps {
  label?: string;
  fullScreen?: boolean;
}

export const LoadingState = ({ label = 'Loading...', fullScreen = false }: LoadingStateProps) => (
  <Box
    sx={{
      minHeight: fullScreen ? '60vh' : 160,
      display: 'grid',
      placeItems: 'center',
    }}
  >
    <Stack spacing={2} sx={{ alignItems: 'center' }}>
      <CircularProgress />
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Stack>
  </Box>
);
