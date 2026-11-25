import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, Link as RouterLink, useLocation } from 'react-router-dom';
import { z } from 'zod';
import { ApiError } from '../../lib/api-client';
import { isPathAllowedForRole, roleHome } from '../../lib/roles';
import { useAuth } from './auth-context';

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required.')
    .pipe(z.email('Enter a valid email address.')),
  password: z.string().min(1, 'Password is required.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export const LoginPage = () => {
  const { user, login } = useAuth();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const from = (location.state as { from?: string } | null)?.from;

  if (user) {
    const target = from && isPathAllowedForRole(from, user.role) ? from : roleHome(user.role);
    return <Navigate to={target} replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);

    try {
      await login(values);
    } catch (error) {
      setServerError(
        error instanceof ApiError ? error.message : 'Unable to sign in. Please try again.',
      );
    }
  });

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        p: 2,
        background:
          'radial-gradient(circle at 15% 10%, rgba(79, 70, 229, 0.18), transparent 32rem), linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)',
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 420, boxShadow: 6 }}>
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={1} sx={{ mb: 3 }}>
            <Typography variant="overline" color="primary" sx={{ letterSpacing: 2 }}>
              CampusHub
            </Typography>
            <Typography variant="h4">Sign in</Typography>
            <Typography variant="body2" color="text.secondary">
              Access your courses, assignments, and announcements.
            </Typography>
          </Stack>

          <Box component="form" onSubmit={onSubmit} noValidate>
            <Stack spacing={2}>
              {serverError ? <Alert severity="error">{serverError}</Alert> : null}

              <TextField
                label="Email"
                type="email"
                autoComplete="email"
                fullWidth
                error={Boolean(errors.email)}
                helperText={errors.email?.message}
                {...register('email')}
              />

              <TextField
                label="Password"
                type="password"
                autoComplete="current-password"
                fullWidth
                error={Boolean(errors.password)}
                helperText={errors.password?.message}
                {...register('password')}
              />

              <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
                {isSubmitting ? 'Signing in...' : 'Sign in'}
              </Button>
            </Stack>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
            New to CampusHub?{' '}
            <Link component={RouterLink} to="/register">
              Create an account
            </Link>
          </Typography>

          {/* <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            Demo accounts use @campushub.local email addresses and the password configured by your
            administrator.
          </Typography> */}
        </CardContent>
      </Card>
    </Box>
  );
};
