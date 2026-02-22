import React from 'react';
import clsx from 'classnames';

interface SkeletonProps {
  count?: number;
  width?: string;
  height?: string;
  className?: string;
}

/**
 * Skeleton loader for placeholder content. Useful during network
 * requests to indicate loading state.
 */
const Skeleton: React.FC<SkeletonProps> = ({ count = 1, width = '100%', height = '1rem', className }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className={clsx(
            'animate-pulse bg-gray-200 dark:bg-gray-700 rounded',
            className
          )}
          style={{ width, height, marginBottom: '0.5rem' }}
        />
      ))}
    </>
  );
};

export default Skeleton;