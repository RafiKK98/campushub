import type { Role } from '../types/api';

const ROLE_PATH_PREFIXES: Record<Role, readonly string[]> = {
  ADMIN: ['/admin'],
  INSTRUCTOR: ['/instructor'],
  STUDENT: ['/student', '/catalogue'],
};

const SHARED_PATHS = new Set(['/', '/announcements', '/forbidden']);

const matchesPrefix = (pathname: string, prefix: string): boolean =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

export const isPathAllowedForRole = (path: string, role: Role): boolean => {
  if (!path.startsWith('/')) {
    return false;
  }

  const pathname = path.split(/[?#]/, 1)[0];

  if (!pathname) {
    return false;
  }

  if (SHARED_PATHS.has(pathname)) {
    return true;
  }

  if (matchesPrefix(pathname, '/assignments')) {
    return true;
  }

  if (matchesPrefix(pathname, '/courses')) {
    const segments = pathname.split('/').filter(Boolean);
    const isRosterRoute = segments.length >= 3 && segments[2] === 'students';

    return !isRosterRoute || role === 'ADMIN' || role === 'INSTRUCTOR';
  }

  return ROLE_PATH_PREFIXES[role].some((prefix) => matchesPrefix(pathname, prefix));
};

export const roleHome = (role: Role): string => {
  switch (role) {
    case 'ADMIN':
      return '/admin';
    case 'INSTRUCTOR':
      return '/instructor';
    case 'STUDENT':
      return '/student';
  }
};

export const roleLabel = (role: Role): string => {
  switch (role) {
    case 'ADMIN':
      return 'Administrator';
    case 'INSTRUCTOR':
      return 'Instructor';
    case 'STUDENT':
      return 'Student';
  }
};
