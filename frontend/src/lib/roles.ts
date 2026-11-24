import type { Role } from '../types/api';

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
