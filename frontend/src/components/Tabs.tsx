import React, { useState } from 'react';
import clsx from 'classnames';

export interface TabItem {
  key: string;
  title: string;
  content: React.ReactNode;
}

interface TabsProps {
  items: TabItem[];
  selectedKey?: string;
  onChange?: (key: string) => void;
  className?: string;
}

/**
 * Simple tab component to switch between multiple panels. It uses
 * an internal state if no selectedKey/onChange is provided.
 */
const Tabs: React.FC<TabsProps> = ({ items, selectedKey, onChange, className }) => {
  const [internalKey, setInternalKey] = useState(items[0]?.key);
  const activeKey = selectedKey !== undefined ? selectedKey : internalKey;
  const handleSelect = (key: string) => {
    if (onChange) onChange(key);
    else setInternalKey(key);
  };
  return (
    <div className={className}>
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {items.map((item) => (
          <button
            key={item.key}
            className={clsx(
              'px-4 py-2 text-sm font-medium focus:outline-none',
              activeKey === item.key
                ? 'border-b-2 border-primary text-primary dark:border-primary-light dark:text-primary-light'
                : 'text-gray-600 hover:text-primary dark:text-gray-300 dark:hover:text-primary-light'
            )}
            onClick={() => handleSelect(item.key)}
          >
            {item.title}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {items.map((item) => (
          <div key={item.key} className={clsx(activeKey === item.key ? 'block' : 'hidden')}>
            {item.content}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Tabs;