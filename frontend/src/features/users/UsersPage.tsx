import { Add as AddIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { PageHeader } from '../../components/PageHeader';
import { PaginationBar } from '../../components/PaginationBar';
import { StatusChip } from '../../components/StatusChip';
import { useAuth } from '../../features/auth/auth-context';
import { ApiError } from '../../lib/api-client';
import { formatDate } from '../../lib/format';
import { queryKeys } from '../../lib/query-keys';
import type { Role, UserSummary } from '../../types/api';
import { UserFormDialog } from './UserFormDialog';
import { listUsers, updateUser, type UserListParams } from './users-api';

export const UsersPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const [status, setStatus] = useState<'' | 'true' | 'false'>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserSummary | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const params: UserListParams = {
    page,
    limit: 20,
    search: search || undefined,
    role: role || undefined,
    isActive: status === '' ? undefined : status === 'true',
  };

  const usersQuery = useQuery({
    queryKey: queryKeys.users(params),
    queryFn: () => listUsers(params),
  });

  const toggleMutation = useMutation({
    mutationFn: (target: UserSummary) => updateUser(target.id, { isActive: !target.isActive }),
    onSuccess: () => {
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error) => {
      setActionError(
        error instanceof ApiError ? error.message : 'Unable to update the user right now.',
      );
    },
  });

  const openCreate = () => {
    setEditingUser(null);
    setDialogOpen(true);
  };

  const openEdit = (target: UserSummary) => {
    setEditingUser(target);
    setDialogOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Create accounts, assign roles, and manage access."
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            Add user
          </Button>
        }
      />

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Box
              component="form"
              onSubmit={(event) => {
                event.preventDefault();
                setSearch(searchInput);
                setPage(1);
              }}
            >
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  label="Search name or email"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  size="small"
                  fullWidth
                />
                <TextField
                  select
                  label="Role"
                  value={role}
                  onChange={(event) => {
                    setRole(event.target.value as Role | '');
                    setPage(1);
                  }}
                  size="small"
                  sx={{ minWidth: 160 }}
                >
                  <MenuItem value="">All roles</MenuItem>
                  <MenuItem value="ADMIN">Administrator</MenuItem>
                  <MenuItem value="INSTRUCTOR">Instructor</MenuItem>
                  <MenuItem value="STUDENT">Student</MenuItem>
                </TextField>
                <TextField
                  select
                  label="Status"
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value as '' | 'true' | 'false');
                    setPage(1);
                  }}
                  size="small"
                  sx={{ minWidth: 150 }}
                >
                  <MenuItem value="">All statuses</MenuItem>
                  <MenuItem value="true">Active</MenuItem>
                  <MenuItem value="false">Inactive</MenuItem>
                </TextField>
                <Button type="submit" variant="outlined">
                  Search
                </Button>
              </Stack>
            </Box>

            {actionError ? <Alert severity="error">{actionError}</Alert> : null}

            {usersQuery.isLoading ? (
              <LoadingState label="Loading users..." />
            ) : usersQuery.isError || !usersQuery.data ? (
              <ErrorState
                message="Unable to load users."
                onRetry={() => void usersQuery.refetch()}
              />
            ) : usersQuery.data.users.length === 0 ? (
              <EmptyState
                title="No users found"
                description="Try adjusting the search or filters."
              />
            ) : (
              <>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {usersQuery.data.users.map((row) => {
                      const isSelf = row.id === user?.id;

                      return (
                        <TableRow key={row.id} hover>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {row.name}
                            </Typography>
                          </TableCell>
                          <TableCell>{row.email}</TableCell>
                          <TableCell>
                            <StatusChip status={row.role} />
                          </TableCell>
                          <TableCell>
                            <StatusChip
                              status={row.isActive ? 'ACTIVE' : 'INACTIVE'}
                              label={row.isActive ? 'Active' : 'Inactive'}
                            />
                          </TableCell>
                          <TableCell>{formatDate(row.createdAt)}</TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                              <Button size="small" onClick={() => openEdit(row)}>
                                Edit
                              </Button>
                              <Button
                                size="small"
                                color={row.isActive ? 'error' : 'success'}
                                disabled={isSelf || toggleMutation.isPending}
                                onClick={() => toggleMutation.mutate(row)}
                              >
                                {row.isActive ? 'Deactivate' : 'Activate'}
                              </Button>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                <PaginationBar meta={usersQuery.data.meta} onPageChange={setPage} />
              </>
            )}
          </Stack>
        </CardContent>
      </Card>

      <UserFormDialog
        open={dialogOpen}
        user={editingUser}
        currentUserId={user?.id ?? ''}
        onClose={() => setDialogOpen(false)}
      />
    </>
  );
};
