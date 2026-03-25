'use client';

import { useQuery } from '@tanstack/react-query';
import { DataTable } from '../../components/data-table';
import { PageShell } from '../../components/page-shell';
import { QueryState } from '../../components/query-state';
import { syncLogColumns } from '../../lib/table-columns';
import { fetchApi } from '../../lib/api';

type ApiSyncLog = {
  action: string;
  level: string;
  message: string;
  createdAt: string;
};

export default function SyncLogsPage() {
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ['sync-logs-page'],
    queryFn: async () => {
      const logs = await fetchApi<ApiSyncLog[]>('/sync-logs');

      return logs.map((log) => ({
        type: log.action,
        level: log.level,
        message: log.message,
        date: new Date(log.createdAt).toLocaleString('es-CL'),
      }));
    },
  });

  return (
    <PageShell
      title="Logs de sincronización"
      description="Sigue la actividad técnica de importaciones, stock, precios y webhooks en una vista más simple de revisar."
      actionLabel="Ver actividad"
    >
      {isLoading ? (
        <QueryState
          title="Cargando logs"
          description="Estamos consultando los eventos recientes de sincronización."
        />
      ) : isError ? (
        <QueryState
          title="No pudimos cargar logs"
          description="La API no devolvió los registros esperados."
        />
      ) : (
        <DataTable
          data={data}
          columns={syncLogColumns}
          title="Actividad reciente"
          description="Eventos, alertas y reintentos que impactan tu operación"
          searchPlaceholder="Buscar proceso o mensaje"
        />
      )}
    </PageShell>
  );
}
