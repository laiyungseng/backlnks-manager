import { redirect } from 'next/navigation';

export default function VendorBasePage() {
    // LAYER 2 DEFENSE: Anti-Snooping Route Trap
    // The base /vendor route must not expose projects or subdirectories.
    // Instantly redirects unauthorized access.
    redirect('/unauthorized');
}
