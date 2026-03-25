'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';

export function DataTable<TData>({
  data,
  columns,
  title = 'Vista principal',
  description = 'Explora y filtra la información disponible.',
  searchPlaceholder = 'Buscar',
  defaultPageSize = 50,
}: {
  data: TData[];
  columns: ColumnDef<TData>[];
  title?: string;
  description?: string;
  searchPlaceholder?: string;
  defaultPageSize?: number;
}) {
  const [query, setQuery] = useState('');
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [pageIndex, setPageIndex] = useState(0);
  const deferredQuery = useDeferredValue(query);

  const filteredData = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return data;
    }

    return data.filter((row) =>
      Object.values(row as Record<string, unknown>).some((value) =>
        String(value).toLowerCase().includes(normalizedQuery),
      ),
    );
  }, [data, deferredQuery]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      pagination: {
        pageIndex,
        pageSize,
      },
    },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === 'function'
          ? updater({
              pageIndex,
              pageSize,
            })
          : updater;

      setPageIndex(next.pageIndex);
      setPageSize(next.pageSize);
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const resultCount = filteredData.length;
  const pageCount = table.getPageCount();
  const currentRows = table.getRowModel().rows;
  const startRow = resultCount === 0 ? 0 : pageIndex * pageSize + 1;
  const endRow = resultCount === 0 ? 0 : Math.min((pageIndex + 1) * pageSize, resultCount);

  useEffect(() => {
    setPageIndex(0);
  }, [deferredQuery]);

  useEffect(() => {
    if (pageIndex > 0 && pageIndex >= pageCount) {
      setPageIndex(Math.max(pageCount - 1, 0));
    }
  }, [pageCount, pageIndex]);

  return (
    <section className="overflow-hidden rounded-[1.6rem] border border-[var(--stroke)] bg-[var(--panel-strong)] shadow-panel backdrop-blur-xl">
      <div className="flex flex-col gap-4 border-b border-black/5 p-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-night">{title}</h2>
          <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.16em] text-ink/40">
            {resultCount} {resultCount === 1 ? 'resultado' : 'resultados'}
          </p>
        </div>
        <div className="w-full sm:max-w-xs">
          <label className="sr-only" htmlFor="table-search">
            Buscar
          </label>
          <input
            id="table-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full rounded-xl border border-black/10 bg-white/90 px-4 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-sky focus:ring-4 focus:ring-sky/10"
            placeholder={`${searchPlaceholder}...`}
            type="search"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="sticky top-0 z-10 border-b border-black/5 bg-slate-50 text-left text-[10px] uppercase tracking-[0.14em] text-ink/40">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="px-5 py-3.5 font-medium">
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </th>
              ))}
            </tr>
          ))}
          </thead>
          <tbody>
            {currentRows.length > 0 ? (
              currentRows.map((row, index) => (
                <tr
                  key={row.id}
                  className={`border-t border-black/5 transition hover:bg-sky/5 ${
                    index % 2 === 0 ? 'bg-white/70' : 'bg-transparent'
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="align-top px-5 py-4 text-[13px] text-ink/80">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-5 py-14 text-center text-sm text-ink/55"
                >
                  No encontramos resultados para esa búsqueda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-black/5 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3 text-sm text-ink/60">
          <span>
            Mostrando {startRow}-{endRow} de {resultCount}
          </span>
          <label className="flex items-center gap-2">
            <span>Filas</span>
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPageIndex(0);
              }}
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-sky focus:ring-4 focus:ring-sky/10"
            >
              {[25, 50, 100, 200].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:text-ink disabled:cursor-not-allowed disabled:opacity-45"
          >
            Inicio
          </button>
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:text-ink disabled:cursor-not-allowed disabled:opacity-45"
          >
            Anterior
          </button>
          <span className="px-2 text-xs font-medium text-ink/60">
            Página {pageCount === 0 ? 0 : pageIndex + 1} de {pageCount}
          </span>
          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:text-ink disabled:cursor-not-allowed disabled:opacity-45"
          >
            Siguiente
          </button>
          <button
            type="button"
            onClick={() => table.setPageIndex(Math.max(pageCount - 1, 0))}
            disabled={!table.getCanNextPage()}
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:text-ink disabled:cursor-not-allowed disabled:opacity-45"
          >
            Final
          </button>
        </div>
      </div>
    </section>
  );
}
