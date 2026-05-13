'use client';

import { forwardRef } from 'react';
import { SnackbarProvider as NotistackProvider, type CustomContentProps } from 'notistack';

const snackStyle: React.CSSProperties = {
  backgroundColor: '#141925',
  border: '1px solid #253040',
  color: '#e5e7eb',
  borderRadius: '8px',
  fontSize: '14px',
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '12px 16px',
};

const iconStyle: React.CSSProperties = { fontWeight: 700, fontSize: '14px' };

const SuccessSnack = forwardRef<HTMLDivElement, CustomContentProps>(({ id, message }, ref) => (
  <div ref={ref} id={String(id)} style={snackStyle}>
    <span style={{ ...iconStyle, color: '#34d399' }}>&#10003;</span>
    <span>{message}</span>
  </div>
));
SuccessSnack.displayName = 'SuccessSnack';

const ErrorSnack = forwardRef<HTMLDivElement, CustomContentProps>(({ id, message }, ref) => (
  <div ref={ref} id={String(id)} style={snackStyle}>
    <span style={{ ...iconStyle, color: '#f87171' }}>&#10007;</span>
    <span>{message}</span>
  </div>
));
ErrorSnack.displayName = 'ErrorSnack';

const InfoSnack = forwardRef<HTMLDivElement, CustomContentProps>(({ id, message }, ref) => (
  <div ref={ref} id={String(id)} style={snackStyle}>
    <span style={{ ...iconStyle, color: '#60a5fa' }}>i</span>
    <span>{message}</span>
  </div>
));
InfoSnack.displayName = 'InfoSnack';

export default function SnackbarProvider({ children }: { children: React.ReactNode }) {
  return (
    <NotistackProvider
      maxSnack={3}
      autoHideDuration={3000}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      Components={{ success: SuccessSnack, error: ErrorSnack, info: InfoSnack }}
    >
      {children}
    </NotistackProvider>
  );
}
