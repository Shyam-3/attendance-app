import type { Session, User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { canReachSupabaseAuth, supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session (guard network/auth refresh failures)
    const initSession = async () => {
      try {
        const reachable = await canReachSupabaseAuth();
        if (!reachable) {
          setSession(null);
          setUser(null);
          return;
        }

        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          throw error;
        }
        setSession(session);
        setUser(session?.user ?? null);
      } catch (error) {
        console.error('[Auth] Failed to initialize session:', error);
        setSession(null);
        setUser(null);
        try {
          await supabase.auth.signOut({ scope: 'local' });
        } catch {
          // no-op: best effort cleanup
        }
      } finally {
        setLoading(false);
      }
    };

    initSession();

    let subscription: { unsubscribe: () => void } | null = null;

    const initAuthListener = async () => {
      const reachable = await canReachSupabaseAuth();
      if (!reachable) {
        return;
      }

      // Listen for auth changes
      const listener = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      });

      subscription = listener.data.subscription;
    };

    initAuthListener();

    return () => subscription?.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name,
          display_name: name,
        },
      },
    });
    
    // Check if user already exists (Supabase returns user but with identities: [])
    if (!error && data.user && data.user.identities && data.user.identities.length === 0) {
      return { error: { message: 'User already exists. Please login instead.' } };
    }
    
    // Update display_name in user metadata after signup
    if (!error && data.user) {
      await supabase.auth.updateUser({
        data: { display_name: name }
      });
    }
    
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut({ scope: 'local' });
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
