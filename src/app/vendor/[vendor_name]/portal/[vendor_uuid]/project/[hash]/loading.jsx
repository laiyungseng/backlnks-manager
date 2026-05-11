import FormSkeleton from './FormSkeleton';

export default function LoadingProjectPage() {
    return (
        <div className="flex flex-col h-full animate-in slide-in-from-right duration-300">
            <div className="shrink-0 flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shadow-sm sticky top-0 z-20 animate-pulse">
                <div className="h-4 w-16 rounded bg-gray-200" />
                <div className="h-4 flex-1 min-w-0 max-w-sm rounded bg-gray-200" />
                <div className="h-8 w-36 shrink-0 rounded border border-red-100 bg-red-50" />
            </div>
            <div className="flex-1">
                <FormSkeleton />
            </div>
        </div>
    );
}
