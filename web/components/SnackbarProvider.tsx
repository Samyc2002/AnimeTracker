'use client';

import { SnackbarProvider as NotistackProvider } from 'notistack';

export default function SnackbarProvider({ children }: { children: React.ReactNode }) {
  return (
    <NotistackProvider
      maxSnack={3}
      autoHideDuration={3000}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      style={{
        backgroundColor: '#141925',
        border: '1px solid #253040',
        color: '#e5e7eb',
        borderRadius: '8px',
        fontSize: '14px',
      }}
    >
      {children}
    </NotistackProvider>
  );
}
