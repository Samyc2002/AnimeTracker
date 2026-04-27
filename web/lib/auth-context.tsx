'use client';

import { createContext, useContext } from 'react';

interface AuthContextType {
  authed: boolean;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType>({ authed: false, loading: true });

export function useAuth() {
  return useContext(AuthContext);
}
