export type EstadoArea = 'Completo' | 'En curso' | 'Pendiente' | 'Bloqueado' | 'Aún no habilitado' | 'No aplica' | 'Esperando tercero' | 'No iniciado';
export type AreaFicha = 'proyecto' | 'edicion' | 'correccion' | 'diseno' | 'calidad' | 'digital' | 'lanzamiento' | 'impresion' | 'distribucion';
export interface CampoFicha {
    key: string;
    label: string;
    value: unknown;
    source: string;
    type?: string;
    editable?: boolean;
    group?: string;
    legacy?: boolean;
}
export interface AreaResumen {
    id: AreaFicha;
    name: string;
    state: EstadoArea;
    detail: string;
    workspace?: {
        label: string;
        href: string;
    };
    fields?: CampoFicha[];
}
export interface ActividadFicha {
    id: string;
    date: string;
    label: string;
    actor: string;
    area: string;
}
export interface EquipoFicha {
    id: string;
    name: string;
    role: string;
    scope: string;
    assignedAt: string | null;
    endedAt?: string | null;
}
export interface AccionFicha {
    label: string;
    description: string;
    href: string;
    primary?: boolean;
}
export interface ResumenFichaViva {
    project: {
        id: string;
        code: string;
        title: string;
        service: string;
        unit: string;
        macroState: string;
        updatedAt: string;
    };
    authors: {
        id: string;
        name: string;
        category: string;
    }[];
    overview: CampoFicha[];
    summary: {
        active: number | null;
        completed: number | null;
        pending: number | null;
        blocked: number | null;
        commercial: string;
        commercialMissing: string[];
        rrpp: string;
        rrppMissing: string[];
        launchEnabled: boolean;
        launch: string;
        launchPhase: string | null;
        launchDate: string | null;
    };
    team: EquipoFicha[];
    traceability: AreaResumen[];
    myActions: AccionFicha[];
    recentActivity: ActividadFicha[];
    secondaryErrors: string[];
    relatedProcesses: {
        name: string;
        state: string;
        detail: string;
        href?: string;
    }[];
}
export interface ExpedienteFicha {
    areas: AreaResumen[];
    teamHistory: EquipoFicha[];
    references: string[];
    secondaryErrors: string[];
}
export interface HistorialFicha {
    items: ActividadFicha[];
    nextCursor: string | null;
}
