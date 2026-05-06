import { redirect } from 'next/navigation';

export default function CatalogRedirect() {
    redirect('/admin/catalog/categories');
}
