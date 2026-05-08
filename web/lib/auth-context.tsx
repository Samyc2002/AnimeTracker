'use client';

import { createContext, useContext } from 'react';

interface AuthContextType {
  authed: boolean;
  loading: boolean;
  userId: string | null;
  userEmail: string | null;
}

export const AuthContext = createContext<AuthContextType>({ authed: false, loading: true, userId: null, userEmail: null });

export function useAuth() {
  return useContext(AuthContext);
}
