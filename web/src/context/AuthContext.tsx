import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:9000';

interface User {
  id: string;
  email: string;
  role: string;
  apiKey: string | null;
  isPaid: boolean;
  emailVerified: boolean;
}

interface Domain {
  subdomain: string;
  createdAt: string;
  isOnline: boolean;
}

interface AuthContextType {
  user: User | null;
  domains: Domain[];
  loading: boolean;
  isAuthenticated: boolean;
  fetchUser: () => Promise<void>;
  fetchDomains: () => Promise<void>;
  updateUser: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Cache timestamps to avoid refetching too frequently
let lastUserFetch = 0;
let lastDomainsFetch = 0;
const CACHE_DURATION = 30000; // 30 seconds

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);

  const getToken = () => localStorage.getItem('token');

  const fetchUser = async (force = false) => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    // Skip if recently fetched
    const now = Date.now();
    if (!force && user && now - lastUserFetch < CACHE_DURATION) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Session expired');

      const data = await response.json();
      setUser(data);
      lastUserFetch = now;
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchDomains = async (force = false) => {
    const token = getToken();
    if (!token) return;

    // Skip if recently fetched
    const now = Date.now();
    if (!force && domains.length > 0 && now - lastDomainsFetch < CACHE_DURATION) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/domains`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch domains');

      const data = await response.json();
      setDomains(data);
      lastDomainsFetch = now;
    } catch (error) {
      console.error('Failed to fetch domains:', error);
    }
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setDomains([]);
    lastUserFetch = 0;
    lastDomainsFetch = 0;
  };

  useEffect(() => {
    fetchUser();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        domains,
        loading,
        isAuthenticated: !!user,
        fetchUser: () => fetchUser(true),
        fetchDomains: () => fetchDomains(true),
        updateUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
