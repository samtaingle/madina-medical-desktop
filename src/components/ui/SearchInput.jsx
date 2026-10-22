import React, { forwardRef, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

const SearchInput = forwardRef(function SearchInput(
  {
    value,
    onChange,
    onClear,
    placeholder = 'Search by medicine name, generic, barcode, or rack...',
    hotkey = 'F1',
    className = '',
    ...props
  },
  forwardedRef
) {
  const internalRef = useRef(null);
  const inputRef = forwardedRef || internalRef;

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === hotkey) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hotkey, inputRef]);

  return (
    <div className={`relative flex items-center w-full ${className}`}>
      <div className="absolute left-3.5 pointer-events-none text-slate-400">
        <Search className="w-4 h-4" />
      </div>

      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full bg-slate-900 border border-slate-700 hover:border-slate-600 focus:border-blue-500 rounded-xl pl-10 pr-20 py-2.5 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition shadow-inner"
        {...props}
      />

      <div className="absolute right-3 flex items-center gap-1.5">
        {value && (
          <button
            type="button"
            onClick={onClear}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        {hotkey && (
          <kbd className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-slate-800 border border-slate-700 text-amber-400 select-none shadow-sm">
            {hotkey}
          </kbd>
        )}
      </div>
    </div>
  );
});

export default SearchInput;
