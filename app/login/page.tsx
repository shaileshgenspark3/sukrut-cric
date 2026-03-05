"use client";

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Shield, Users, Mail, Lock, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

function LoginContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialRole = searchParams.get('role') === 'admin' ? 'admin' : 'captain';

    const [role, setRole] = useState<'admin' | 'captain'>(initialRole);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (authError || !authData.user) {
            setError(authError?.message || 'Failed to login. Please check credentials.');
            setLoading(false);
            return;
        }

        // Verify role
        const { data: roleData, error: roleErr } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', authData.user.id);

        if (roleErr || !roleData || roleData.length === 0) {
            setError('You do not have any roles assigned.');
            await supabase.auth.signOut();
            setLoading(false);
            return;
        }

        const userRoles = roleData.map(r => r.role);
        const hasAdmin = userRoles.includes('admin') || userRoles.includes('core_admin');
        const hasCaptain = userRoles.includes('captain');

        if (role === 'admin' && !hasAdmin) {
            setError('You do not have Admin privileges.');
            await supabase.auth.signOut();
            setLoading(false);
            return;
        }

        if (role === 'captain' && !hasCaptain) {
            setError('You are not registered as a Captain.');
            await supabase.auth.signOut();
            setLoading(false);
            return;
        }

        // Navigate to dashboard
        router.push(`/${role}`);
    };

    const isConfigAdmin = role === 'admin';

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden mesh-gradient">
            {/* Ambient Background Elements */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] transition-colors duration-1000 ${isConfigAdmin ? 'bg-gold/10' : 'bg-primary/10'}`} />
                <div className={`absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] transition-colors duration-1000 ${isConfigAdmin ? 'bg-gold/5' : 'bg-primary/5'}`} />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="w-full max-w-md relative z-10"
            >
                <div className="flex justify-center mb-10">
                    <Link href="/" className="group flex items-center gap-3 bg-white/5 border border-white/5 hover:border-white/10 px-6 py-2.5 rounded-2xl text-slate-400 hover:text-white transition-all duration-300 backdrop-blur-md">
                        <div className="p-1.5 bg-white/5 rounded-lg group-hover:-translate-x-1 transition-transform">
                            <Mail className="w-4 h-4 opacity-70" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Return to Base</span>
                    </Link>
                </div>

                <div className="glass-card bg-slate-950/40 border border-white/10 rounded-[3rem] p-10 md:p-12 relative overflow-hidden shadow-2xl backdrop-blur-3xl">
                    {/* Role Indicator Border */}
                    <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-50 transition-colors duration-1000`} style={{ color: isConfigAdmin ? 'var(--gold)' : 'var(--electric)' }} />

                    <div className="flex flex-col items-center mb-12 text-center">
                        <motion.div
                            key={role}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className={`w-20 h-20 rounded-[2rem] flex items-center justify-center mb-6 transition-all duration-500 shadow-2xl ${isConfigAdmin ? 'bg-gold/10 text-gold border border-gold/20 shadow-gold/10' : 'bg-primary/10 text-primary border border-primary/20 shadow-primary/10'}`}
                        >
                            {isConfigAdmin ? <Shield className="w-10 h-10" /> : <Users className="w-10 h-10" />}
                        </motion.div>
                        <h2 className="font-display text-4xl font-black text-white tracking-tighter uppercase mb-2">
                            {isConfigAdmin ? 'Tactical Ops' : 'Commander'}
                            <span className={`block text-xs font-black tracking-[0.4em] uppercase mt-2 ${isConfigAdmin ? 'text-gold' : 'text-primary'}`}>
                                {isConfigAdmin ? 'Central Intelligence' : 'Field Operations'}
                            </span>
                        </h2>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-4">Credentials</label>
                            <div className="relative group/input">
                                <Mail className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within/input:text-white transition-colors" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={v => setEmail(v.target.value)}
                                    placeholder="your@command.email"
                                    required
                                    className={`w-full bg-slate-900/50 border border-white/5 focus:border-white/20 rounded-2xl py-5 pl-16 pr-6 text-white placeholder-slate-600 outline-none transition-all duration-300 font-sans font-medium hover:bg-slate-900/80`}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-4">Security Key</label>
                            <div className="relative group/input">
                                <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within/input:text-white transition-colors" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={v => setPassword(v.target.value)}
                                    placeholder="••••••••••••"
                                    required
                                    className={`w-full bg-slate-900/50 border border-white/5 focus:border-white/20 rounded-2xl py-5 pl-16 pr-6 text-white placeholder-slate-700 outline-none transition-all duration-300 font-sans font-medium hover:bg-slate-900/80`}
                                />
                            </div>
                        </div>

                        {error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="bg-destructive/10 border border-destructive/20 text-destructive text-[10px] font-black p-4 rounded-xl text-center uppercase tracking-widest leading-relaxed"
                            >
                                Security Alert: {error}
                            </motion.div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-6 rounded-2xl font-display font-black text-lg tracking-[0.2em] transition-all duration-500 flex items-center justify-center gap-4 relative overflow-hidden group/btn ${isConfigAdmin
                                ? 'bg-gold text-black hover:shadow-[0_20px_50px_rgba(255,215,0,0.2)]'
                                : 'bg-primary text-white hover:shadow-[0_20px_50px_rgba(59,130,246,0.2)]'
                                }`}
                        >
                            {loading ? (
                                <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                                <>
                                    <span>AUTHORIZE ENTRY</span>
                                    <Lock className="w-5 h-5 opacity-50 group-hover:scale-110 transition-transform" />
                                </>
                            )}
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500 pointer-events-none" />
                        </button>
                    </form>

                    <div className="mt-10 text-center pt-8 border-t border-white/5">
                        <button
                            type="button"
                            onClick={() => {
                                setRole(role === 'admin' ? 'captain' : 'admin');
                                setError('');
                            }}
                            className="text-slate-500 hover:text-white transition-all duration-300 text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-3 mx-auto"
                        >
                            <span className="w-8 h-px bg-white/5" />
                            Terminal Switch: {isConfigAdmin ? 'Commander' : 'Intel'}
                            <span className="w-8 h-px bg-white/5" />
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        }>
            <LoginContent />
        </Suspense>
    );
}
