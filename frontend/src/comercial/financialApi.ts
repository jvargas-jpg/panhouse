import { apiFetch } from '../lib/api';
import type { FinancialDetail, FinancialList } from '../../../shared/pagos';
export type { FinancialDetail, FinancialProject, FinancialList, PaymentHistory } from '../../../shared/pagos';
export const paymentKeys = { all: ['payments'] as const, list: (filters: string) => ['payments','projects',filters] as const,
  detail: (id: string, page = 1) => ['payments','project',id,page] as const };
export const fetchFinancialProjects = (filters = '') => apiFetch<FinancialList>('/pagos/proyectos?' + filters);
export const fetchFinancialDetail = (id: string, page = 1) => apiFetch<FinancialDetail>(`/pagos/proyectos/${id}?historyPage=${page}`);
export const paymentAction = (path: string, body: unknown, method = 'POST') => apiFetch('/pagos' + path, { method, body: JSON.stringify(body) });
