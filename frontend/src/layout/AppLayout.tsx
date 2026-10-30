import { Outlet } from 'react-router-dom';
import { AppFrame } from './AppFrame';
export function AppLayout() { return <AppFrame constrained><Outlet /></AppFrame>; }
