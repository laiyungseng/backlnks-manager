function SkeletonRow({ index }) {
    const widths = ['w-11/12', 'w-10/12', 'w-full', 'w-9/12'];

    return (
        <div className="grid grid-cols-[minmax(180px,1.5fr)_minmax(160px,1fr)_minmax(220px,2fr)_minmax(140px,1fr)] gap-3 border-b border-gray-100 px-4 py-3">
            <div className={`h-4 rounded bg-gray-200 ${widths[index % widths.length]}`} />
            <div className="h-4 w-24 rounded bg-gray-200" />
            <div className={`h-4 rounded bg-gray-200 ${widths[(index + 1) % widths.length]}`} />
            <div className="h-4 w-20 rounded bg-gray-200" />
        </div>
    );
}

export default function FormSkeleton() {
    return (
        <div className="max-w-none px-4 sm:px-6 lg:px-8 py-6 pb-12 animate-pulse">
            <div className="mb-4 h-14 rounded-lg border border-gray-200 bg-white px-4 py-3">
                <div className="h-3 w-36 rounded bg-gray-200" />
                <div className="mt-3 flex gap-2">
                    <div className="h-6 w-24 rounded bg-gray-200" />
                    <div className="h-6 w-28 rounded bg-gray-200" />
                    <div className="h-6 w-20 rounded bg-gray-200" />
                </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                <div className="grid grid-cols-[minmax(180px,1.5fr)_minmax(160px,1fr)_minmax(220px,2fr)_minmax(140px,1fr)] gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3">
                    <div className="h-3 w-28 rounded bg-gray-300" />
                    <div className="h-3 w-20 rounded bg-gray-300" />
                    <div className="h-3 w-24 rounded bg-gray-300" />
                    <div className="h-3 w-20 rounded bg-gray-300" />
                </div>
                {Array.from({ length: 10 }, (_, index) => (
                    <SkeletonRow key={index} index={index} />
                ))}
            </div>
        </div>
    );
}
