export interface ReunionExtraccion {
  id: string; proyectoId: string; numero: number;
  fechaHora: string | null; duracionMinutos: number | null; realizada: boolean;
  createdAt: string; updatedAt: string;
}
