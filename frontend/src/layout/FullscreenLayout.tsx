import { Outlet } from 'react-router-dom';
import { AppFrame } from './AppFrame';
export function FullscreenLayout() { return <AppFrame><Outlet /></AppFrame>; }
