import { redirect } from 'next/navigation';

export default function UserManagementRedirect() {
    redirect('/admin/user-management/vendor-manager');
}
