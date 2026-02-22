import React from 'react';
import Skeleton from './Skeleton';

export interface Column<T> {
  key: keyof T | string;
  title: string;
  render?: (row: T) => React.ReactNode;
}

interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  emptyText?: string;
}

/**
 * Generic table component. Pass in an array of column definitions and data.
 * When loading, skeleton rows are shown.
 */
function Table<T extends { [key: string]: any }>({ data, columns, loading = false, emptyText = 'No data' }: TableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            {columns.map((col) => (
              <th
                key={String(col.key)}
                scope="col"
                className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300"
              >
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-2">
                <Skeleton count={3} height="1rem" />
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                {emptyText}
              </td>
            </tr>
          ) : (
            data.map((row, idx) => (
              <tr key={idx} className="bg-white dark:bg-gray-900">
                {columns.map((col) => (
                  <td key={String(col.key)} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200">
                    {col.render ? col.render(row) : (row[col.key as string] as any)?.toString()}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default Table;