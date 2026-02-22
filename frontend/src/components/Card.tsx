import React from 'react';
import clsx from 'classnames';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Container for grouping content with border and shadow.
 */
const Card: React.FC<CardProps> = ({ children, className }) => {
  return (
    <div className={clsx('rounded-md bg-white dark:bg-gray-800 shadow-sm p-4', className)}>
      {children}
    </div>
  );
};

export default Card;