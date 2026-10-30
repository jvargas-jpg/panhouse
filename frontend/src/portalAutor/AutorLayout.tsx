import { Outlet } from 'react-router-dom';
import { AppFrame } from '../layout/AppFrame';

// The customer portal keeps its focused navigation and uses the same account bar and surfaces.
export function AutorLayout() {
  return <AppFrame><div className="mx-auto max-w-5xl px-4 py-8 sm:px-6"><Outlet /></div></AppFrame>;
}
