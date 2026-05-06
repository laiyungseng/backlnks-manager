'use client';

import { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Link2, RefreshCw, CheckCircle2, AlertCircle, Copy } from 'lucide-react';
import { upsertClient, deleteClient, generateClientAccessLink, revokeClientSessions } from './actions';

export default function ClientManagerPage() {
    const [clients, setClients] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newName, setNewName] = useState('');
    const [error, setError] = useState(null);
    const [copiedId, setCopiedId] = useState(null);
    const [generatedLinks, setGeneratedLinks] = useState({});

    const fetchClients = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/clients');
            if (res.ok) {
                const data = await res.json();
                setClients(data || []);
            }
        } catch { /* ignore */ }
        setIsLoading(false);
    };

    useEffect(() => { fetchClients(); }, []);

    const handleAdd = async (e) => {
        e.preventDefault();
        setError(null);
        if (!newName.trim()) { setError('Client name is required.'); return; }
        const res = await upsertClient({ client_name: newName.trim() });
        if (!res.success) { setError(res.message); return; }
        setNewName('');
        fetchClients();
    };

    const handleDelete = async (id, name) => {
        if (!confirm(`Delete client "${name}"? This cannot be undone.`)) return;
        await deleteClient(id);
        fetchClients();
    };

    const handleGenerateLink = async (client) => {
        const res = await generateClientAccessLink(client.id);
        if (!res.success) { alert(res.message); return; }
        const slug = client.client_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const authUrl = `${window.location.origin}/client/auth?token=${res.token}&name=${encodeURIComponent(client.client_name)}`;
        setGeneratedLinks(prev => ({ ...prev, [client.id]: authUrl }));
    };

    const handleCopy = (id, text) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleRevoke = async (id) => {
        if (!confirm('Revoke all active sessions for this client?')) return;
        const res = await revokeClientSessions(id);
        if (!res.success) alert(res.message);
        else alert('Sessions revoked successfully.');
    };

    return (
        <div className="max-w-4xl mx-auto px-6 py-8">
            <div className="flex items-center gap-3 mb-8">
                <Users className="w-6 h-6 text-emerald-600" />
                <div>
                    <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Client Manager</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Create clients, generate access links, and manage sessions.</p>
                </div>
            </div>

            {/* Add client */}
            <div className="bg-white rounded-xl ring-1 ring-gray-200 p-6 mb-8">
                <h2 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-4">Add New Client</h2>
                <form onSubmit={handleAdd} className="flex gap-3">
                    <input
                        type="text"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        placeholder="Client name (e.g. Acme Corp)"
                        className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                    <button
                        type="submit"
                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-black uppercase tracking-widest transition-colors"
                    >
                        <Plus className="w-4 h-4" /> Add
                    </button>
                </form>
                {error && (
                    <div className="flex items-center gap-2 mt-3 text-sm text-red-600">
                        <AlertCircle className="w-4 h-4" /> {error}
                    </div>
                )}
            </div>

            {/* Clients table */}
            <div className="bg-white rounded-xl ring-1 ring-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="text-sm font-black text-slate-700 uppercase tracking-widest">Clients ({clients.length})</h2>
                    <button onClick={fetchClients} className="text-slate-400 hover:text-slate-700 transition-colors" title="Refresh">
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>

                {isLoading ? (
                    <div className="text-center py-12 text-sm text-gray-400">Loading...</div>
                ) : clients.length === 0 ? (
                    <div className="text-center py-12 text-sm text-gray-400">No clients yet.</div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Token Expires</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {clients.map(client => (
                                <tr key={client.id}>
                                    <td className="px-4 py-3 font-semibold text-gray-900">{client.client_name}</td>
                                    <td className="px-4 py-3 text-gray-500 text-xs">
                                        {client.invite_token_expires_at
                                            ? new Date(client.invite_token_expires_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                                            : '—'}
                                        {client.invite_used_at && (
                                            <span className="ml-2 px-1.5 py-0.5 text-[9px] font-bold bg-gray-100 text-gray-500 rounded">used</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-2 flex-wrap">
                                            <button
                                                onClick={() => handleGenerateLink(client)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors"
                                            >
                                                <Link2 className="w-3 h-3" /> Generate Link
                                            </button>
                                            {generatedLinks[client.id] && (
                                                <button
                                                    onClick={() => handleCopy(client.id, generatedLinks[client.id])}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg transition-colors"
                                                    title={generatedLinks[client.id]}
                                                >
                                                    {copiedId === client.id ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                                    {copiedId === client.id ? 'Copied!' : 'Copy Link'}
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleRevoke(client.id)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest bg-yellow-50 text-yellow-700 hover:bg-yellow-100 rounded-lg transition-colors"
                                            >
                                                <RefreshCw className="w-3 h-3" /> Revoke
                                            </button>
                                            <button
                                                onClick={() => handleDelete(client.id, client.client_name)}
                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
