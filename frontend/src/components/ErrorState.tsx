import { Alert, AlertTitle, Button, Stack } from '@mui/material';

interface ErrorStateProps {
  message: string;
  title?: string;
  onRetry?: () => void;
}

export const ErrorState = ({
  message,
  title = 'Something went wrong',
  onRetry,
}: ErrorStateProps) => (
  <Alert
    severity="error"
    action={
      onRetry ? (
        <Button color="inherit" size="small" onClick={onRetry}>
          Retry
        </Button>
      ) : undefined
    }
  >
    <AlertTitle>{title}</AlertTitle>
    <Stack>{message}</Stack>
  </Alert>
);
