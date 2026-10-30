import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { TopBar } from './TopBar';

const NavigationContext = createContext({ open: false, setOpen: (_open: boolean) => {}, available: false, setAvailable: (_available: boolean) => {} });
export const useShellNavigation = () => useContext(NavigationContext);

export function AppFrame({ children, constrained = false, tools }: { children: ReactNode; constrained?: boolean; tools?: ReactNode }) {
  const [open, setOpen] = useState(false), [available, setAvailable] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname, location.search]);
  return <NavigationContext.Provider value={{ open, setOpen, available, setAvailable }}>
    <div className="ph-app-frame flex h-full w-full flex-col overflow-y-auto overflow-x-hidden bg-[#F8F9FA]">
      <TopBar tools={tools} />
      <main className={constrained ? 'mx-auto min-h-0 w-full max-w-4xl flex-1 px-4 py-6 sm:px-6' : 'min-h-0 w-full flex-1'}>{children}</main>
    </div>
  </NavigationContext.Provider>;
}
