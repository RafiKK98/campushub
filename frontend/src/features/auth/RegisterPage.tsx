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
import { Link as RouterLink, Navigate } from 'react-router-dom';
import { z } from 'zod';
import { ApiError } from '../../lib/api-client';
import { roleHome } from '../../lib/roles';
import { useAuth } from './auth-context';

const registerSchema = z
  .object({
    name: z.string().trim().min(1, 'Full name is required.').max(200, 'Full name is too long.'),
    email: z
      .string()
      .trim()
      .min(1, 'Email is required.')
      .pipe(z.email('Enter a valid email address.')),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters.')
      .max(128, 'Password is too long.'),
    confirmPassword: z.string().min(1, 'Please confirm your password.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export const RegisterPage = () => {
  const { user, register: registerAccount } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  if (user) {
    return <Navigate to={roleHome(user.role)} replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);

    try {
      await registerAccount({
        name: values.name,
        email: values.email,
        password: values.password,
      });
    } catch (error) {
      setServerError(
        error instanceof ApiError
          ? error.message
          : 'Unable to create your account. Please try again.',
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
      <Card sx={{ width: '100%', maxWidth: 460, boxShadow: 6 }}>
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={1} sx={{ mb: 3 }}>
            <Typography variant="overline" color="primary" sx={{ letterSpacing: 2 }}>
              CampusHub
            </Typography>
            <Typography variant="h4">Create your student account</Typography>
            <Typography variant="body2" color="text.secondary">
              Register to browse courses, submit assignments, and track your grades.
            </Typography>
          </Stack>

          <Box component="form" onSubmit={onSubmit} noValidate>
            <Stack spacing={2}>
              {serverError ? <Alert severity="error">{serverError}</Alert> : null}

              <TextField
                label="Full name"
                autoComplete="name"
                fullWidth
                error={Boolean(errors.name)}
                helperText={errors.name?.message}
                {...register('name')}
              />

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
                autoComplete="new-password"
                fullWidth
                error={Boolean(errors.password)}
                helperText={errors.password?.message}
                {...register('password')}
              />

              <TextField
                label="Confirm password"
                type="password"
                autoComplete="new-password"
                fullWidth
                error={Boolean(errors.confirmPassword)}
                helperText={errors.confirmPassword?.message}
                {...register('confirmPassword')}
              />

              <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
                {isSubmitting ? 'Creating account...' : 'Create account'}
              </Button>
            </Stack>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
            Already have an account?{' '}
            <Link component={RouterLink} to="/login">
              Sign in
            </Link>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};
