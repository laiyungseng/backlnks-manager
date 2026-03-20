export default function UnauthorizedPage() {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 text-red-500 mb-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Secure Link Invalid or Expired</h1>
                <p className="text-gray-500 max-w-sm mx-auto">
                    The vendor token provided is either missing or unauthorized. Please ensure you copied the exact link provided by your Admin.
                </p>
            </div>
        </div>
    );
}
