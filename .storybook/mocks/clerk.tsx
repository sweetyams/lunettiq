import React from 'react';

export const useUser = () => ({
  user: {
    firstName: 'Marie',
    lastName: 'Dupont',
    publicMetadata: { role: 'manager', locationIds: ['loc_plateau'] },
  },
  isLoaded: true,
  isSignedIn: true,
});

export const useAuth = () => ({ isLoaded: true, isSignedIn: true, userId: 'user_mock' });
export const useClerk = () => ({});
export const UserButton = () => React.createElement('div', { style: { width: 28, height: 28, borderRadius: '50%', background: '#ccc' } });
export const ClerkProvider = ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children);
export const SignedIn = ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children);
export const SignedOut = ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children);
