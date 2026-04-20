'use client';

import { useState, useEffect, useTransition } from 'react';
import { getCategories, addCategory, deleteCategory } from './actions';
import { Tag, Plus, Trash2, AlertCircle } from 'lucide-react';

export default function CategoriesPage() {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [error, setError] = useState('');
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        getCategories().then(res => {
            if (res.success) setCategories(res.categories);
            setLoading(false);
        });
    }, []);

    const handleAdd = () => {
        setError('');
        startTransition(async () => {
            const res = await addCategory(newName, newDesc);
            if (!res.success) { setError(res.message); return; }
            setCategories(prev => [...prev, res.category].sort((a, b) => a.name.localeCompare(b.name)));
            setNewName('');
            setNewDesc('');
        });
    };

    const handleDelete = (id) => {
        startTransition(async () => {
            const res = await deleteCategory(id);
            if (!res.success) { setError(res.message); return; }
            setCategories(prev => prev.filter(c => c.id !== id));
        });
    };

    return (
        <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-6">
                <Tag className="w-6 h-6 text-indigo-600" />
                <div>
                    <h1 className="text-2xl font-black text-slate-900">Category Manager</h1>
                    <p className="text-sm text-slate-500">Manage backlink placement categories available in kickoff forms.</p>
                </div>
            </div>

            {/* Add Form */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6 shadow-sm">
                <h2 className="text-sm font-bold text-slate-700 mb-3">Add New Category</h2>
                {error && (
                    <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 text-sm mb-3">
                        <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                    </div>
                )}
                <div className="flex gap-3">
                    <input
                        type="text"
                        placeholder="Category name (e.g. PBN-sideblog)"
                        value={newName}
                        onChange={e => { setNewName(e.target.value); setError(''); }}
                        onKeyDown={e => e.key === 'Enter' && newName.trim() && handleAdd()}
                        className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <input
                        type="text"
                        placeholder="Description (optional)"
                        value={newDesc}
                        onChange={e => setNewDesc(e.target.value)}
                        className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <button
                        onClick={handleAdd}
                        disabled={!newName.trim() || isPending}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Plus className="w-4 h-4" /> Add
                    </button>
                </div>
            </div>

            {/* Categories List */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {categories.length} {categories.length === 1 ? 'Category' : 'Categories'}
                    </span>
                </div>
                {loading ? (
                    <div className="px-5 py-8 text-center text-slate-400 text-sm">Loading…</div>
                ) : categories.length === 0 ? (
                    <div className="px-5 py-8 text-center text-slate-400 text-sm">No categories yet. Add one above.</div>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {categories.map(cat => (
                            <li key={cat.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors group">
                                <div>
                                    <span className="text-sm font-semibold text-slate-800">{cat.name}</span>
                                    {cat.description && (
                                        <span className="ml-3 text-xs text-slate-400">{cat.description}</span>
                                    )}
                                </div>
                                <button
                                    onClick={() => {
                                        setError('');
                                        handleDelete(cat.id);
                                    }}
                                    disabled={isPending}
                                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 p-1.5 rounded-md hover:bg-red-50 transition-all disabled:opacity-30"
                                    title="Delete category"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
