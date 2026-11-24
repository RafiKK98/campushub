import { Logout as LogoutIcon, Menu as MenuIcon } from '@mui/icons-material';
import {
  AppBar,
  Box,
  Container,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import { roleHome, roleLabel } from '../lib/roles';
import type { Role } from '../types/api';

interface NavItem {
  label: string;
  to: string;
}

const NAV_ITEMS: Record<Role, NavItem[]> = {
  ADMIN: [
    { label: 'Dashboard', to: '/admin' },
    { label: 'Users', to: '/admin/users' },
    { label: 'Courses', to: '/admin/courses' },
    { label: 'Announcements', to: '/announcements' },
  ],
  INSTRUCTOR: [
    { label: 'Dashboard', to: '/instructor' },
    { label: 'My Courses', to: '/instructor/courses' },
    { label: 'Assignments', to: '/instructor/assignments' },
    { label: 'Announcements', to: '/announcements' },
  ],
  STUDENT: [
    { label: 'Dashboard', to: '/student' },
    { label: 'Catalogue', to: '/catalogue' },
    { label: 'My Courses', to: '/student/courses' },
    { label: 'Assignments', to: '/student/assignments' },
    { label: 'Grades', to: '/student/grades' },
    { label: 'Announcements', to: '/announcements' },
  ],
};

const resolveActiveTab = (items: NavItem[], pathname: string): string | false => {
  const exact = items.find((item) => item.to === pathname);

  if (exact) {
    return exact.to;
  }

  const prefix = items.find((item) => pathname.startsWith(`${item.to}/`));

  return prefix ? prefix.to : false;
};

export const AppShell = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [signingOut, setSigningOut] = useState(false);

  if (!user) {
    return null;
  }

  const items = NAV_ITEMS[user.role];
  const activeTab = resolveActiveTab(items, location.pathname);

  const handleLogout = async () => {
    setSigningOut(true);

    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="sticky" color="primary" enableColorOnDark>
        <Toolbar sx={{ gap: 2 }}>
          <Typography
            variant="h6"
            sx={{ cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}
            onClick={() => navigate(roleHome(user.role))}
          >
            CampusHub
          </Typography>

          <Tabs
            value={activeTab}
            onChange={(_event, value: string) => navigate(value)}
            textColor="inherit"
            indicatorColor="secondary"
            sx={{ display: { xs: 'none', md: 'block' }, flexGrow: 1 }}
          >
            {items.map((item) => (
              <Tab key={item.to} label={item.label} value={item.to} />
            ))}
          </Tabs>

          <Box sx={{ flexGrow: { xs: 1, md: 0 } }} />

          <IconButton
            color="inherit"
            sx={{ display: { xs: 'inline-flex', md: 'none' } }}
            onClick={(event) => setMenuAnchor(event.currentTarget)}
            aria-label="Open navigation"
          >
            <MenuIcon />
          </IconButton>

          <Stack
            direction="row"
            spacing={1}
            sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center' }}
          >
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {user.name}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                {roleLabel(user.role)}
              </Typography>
            </Box>
            <Tooltip title="Sign out">
              <span>
                <IconButton
                  color="inherit"
                  onClick={() => void handleLogout()}
                  disabled={signingOut}
                  aria-label="Sign out"
                >
                  <LogoutIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Toolbar>
      </AppBar>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        {items.map((item) => (
          <MenuItem
            key={item.to}
            selected={activeTab === item.to}
            onClick={() => {
              setMenuAnchor(null);
              navigate(item.to);
            }}
          >
            {item.label}
          </MenuItem>
        ))}
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            void handleLogout();
          }}
        >
          Sign out
        </MenuItem>
      </Menu>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Outlet />
      </Container>
    </Box>
  );
};
