import { Box, Button, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import { roleHome } from '../lib/roles';

export const ForbiddenPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <Box sx={{ py: 8, textAlign: 'center' }}>
      <Stack spacing={2} sx={{ alignItems: 'center' }}>
        <Typography variant="h4">Access denied</Typography>
        <Typography color="text.secondary">
          Your account does not have permission to view this page.
        </Typography>
        <Button variant="contained" onClick={() => navigate(user ? roleHome(user.role) : '/login')}>
          Go to dashboard
        </Button>
      </Stack>
    </Box>
  );
};
