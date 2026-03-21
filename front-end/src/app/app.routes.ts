import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { MainLayoutComponent } from './layouts/main-layout/main-layout.component';
import { DashboardComponent } from './features/dashboard/dashboard/dashboard.component';
import { ManageEmployeeComponent } from './features/manage-employee/manage-employee/manage-employee.component';
import { ManageTaskComponent } from './features/manage-task/manage-task/manage-task.component';
import { ManageChatComponent } from './features/manage-chat/manage-chat/manage-chat.component';
import { ManageGroupComponent } from './features/manage-group/manage-group.component';
import { ManageBulkMessageComponent } from './features/manage-bulk-message/manage-bulk-message.component';
import { EmployeeDashboardComponent } from './features/employee-dashboard/employee-dashboard.component';
import { TaskRemindersComponent } from './features/task-reminders/task-reminders.component';
import { ProfileComponent } from './features/profile/profile.component';
import { ContactUsComponent } from './features/contact-us/contact-us.component';
import { AuthGuard } from './core/auth.guard';
export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  { path: 'login', component: LoginComponent },
  { path: 'contact-us', component: ContactUsComponent },

  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    children: [
      { path: 'dashboard', component: DashboardComponent, data: { role: 'admin', breadcrumb: 'Dashboard' } },
      { path: 'manage-employee', component: ManageEmployeeComponent, data: { role: 'admin', breadcrumb: 'Manage Employee' } },
      { path: 'manage-task', component: ManageTaskComponent, canActivate: [AuthGuard], data: { breadcrumb: 'Manage Task' } },
      { path: 'task-reminders', component: TaskRemindersComponent, canActivate: [AuthGuard], data: { breadcrumb: 'Task Reminders' } },
      { path: 'manage-chat', component: ManageChatComponent, canActivate: [AuthGuard], data: { role: 'admin', breadcrumb: 'Manage Chat' } },
      {
        path: 'manage-group',
        component: ManageGroupComponent,
        data: { role: 'admin', breadcrumb: 'Manage Group' }
      },
      {
        path: 'manage-bulk-message',
        component: ManageBulkMessageComponent,
        data: { role: 'admin', breadcrumb: 'Bulk Messaging' }
      },
        {
        path: 'employee-dashboard',
        component: EmployeeDashboardComponent,
        data: { role: 'employee', breadcrumb: 'Employee Dashboard' }
      },
      {
        path: 'profile',
        component: ProfileComponent,
        canActivate: [AuthGuard],
        data: { breadcrumb: 'My Profile' }
      }
    ]
  }
];

