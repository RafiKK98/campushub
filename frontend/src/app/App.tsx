import { Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { ForbiddenPage } from '../components/ForbiddenPage';
import { NotFoundPage } from '../components/NotFoundPage';
import { AnnouncementsPage } from '../features/announcements/AnnouncementsPage';
import { AssignmentDetailPage } from '../features/assignments/AssignmentDetailPage';
import { InstructorAssignmentsPage } from '../features/assignments/InstructorAssignmentsPage';
import { StudentAssignmentsPage } from '../features/assignments/StudentAssignmentsPage';
import { StudentGradesPage } from '../features/assignments/StudentGradesPage';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { AdminCoursesPage } from '../features/courses/AdminCoursesPage';
import { CourseDetailPage } from '../features/courses/CourseDetailPage';
import { InstructorCoursesPage } from '../features/courses/InstructorCoursesPage';
import { RosterPage } from '../features/courses/RosterPage';
import { StudentCataloguePage } from '../features/courses/StudentCataloguePage';
import { StudentCoursesPage } from '../features/courses/StudentCoursesPage';
import { AdminDashboardPage } from '../features/dashboard/AdminDashboardPage';
import { InstructorDashboardPage } from '../features/dashboard/InstructorDashboardPage';
import { StudentDashboardPage } from '../features/dashboard/StudentDashboardPage';
import { InstructorSubmissionsPage } from '../features/submissions/InstructorSubmissionsPage';
import { UsersPage } from '../features/users/UsersPage';
import { ProtectedRoute, RoleHomeRedirect, RoleRoute } from './guards';

export const App = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />

    <Route element={<ProtectedRoute />}>
      <Route element={<AppShell />}>
        <Route index element={<RoleHomeRedirect />} />

        <Route element={<RoleRoute roles={['ADMIN']} />}>
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/users" element={<UsersPage />} />
          <Route path="/admin/courses" element={<AdminCoursesPage />} />
        </Route>

        <Route element={<RoleRoute roles={['INSTRUCTOR']} />}>
          <Route path="/instructor" element={<InstructorDashboardPage />} />
          <Route path="/instructor/courses" element={<InstructorCoursesPage />} />
          <Route path="/instructor/assignments" element={<InstructorAssignmentsPage />} />
          <Route
            path="/instructor/assignments/:id/submissions"
            element={<InstructorSubmissionsPage />}
          />
        </Route>

        <Route element={<RoleRoute roles={['STUDENT']} />}>
          <Route path="/student" element={<StudentDashboardPage />} />
          <Route path="/catalogue" element={<StudentCataloguePage />} />
          <Route path="/student/courses" element={<StudentCoursesPage />} />
          <Route path="/student/assignments" element={<StudentAssignmentsPage />} />
          <Route path="/student/grades" element={<StudentGradesPage />} />
        </Route>

        <Route element={<RoleRoute roles={['ADMIN', 'INSTRUCTOR']} />}>
          <Route path="/courses/:id/students" element={<RosterPage />} />
        </Route>

        <Route path="/courses/:id" element={<CourseDetailPage />} />
        <Route path="/assignments/:id" element={<AssignmentDetailPage />} />
        <Route path="/announcements" element={<AnnouncementsPage />} />
        <Route path="/forbidden" element={<ForbiddenPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Route>
  </Routes>
);
