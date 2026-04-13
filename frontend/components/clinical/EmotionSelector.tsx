'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { EMOTION_CATEGORIES } from '@/lib/data/emotions';

interface EmotionSelectorProps {
  selected: string[];
  onChange: (emotions: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function EmotionSelector({
  selected,
  onChange,
  disabled = false,
  placeholder = 'Seleccionar emociones...',
}: EmotionSelectorProps) {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cierra el dropdown al hacer click fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function toggle(emotion: string) {
    if (selected.includes(emotion)) {
      onChange(selected.filter((e) => e !== emotion));
    } else {
      onChange([...selected, emotion]);
    }
  }

  function remove(emotion: string) {
    onChange(selected.filter((e) => e !== emotion));
  }

  const triggerLabel =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? selected[0]
        : `${selected.length} emociones seleccionadas`;

  return (
    <div ref={containerRef} className="relative w-full">
      {/* ── Trigger button ── */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-none border-0 border-b border-[#D4A592] bg-[#FAF7F5] px-3 py-2 text-sm text-[#2C2220] transition-colors hover:border-[#C4704A] focus:outline-none focus:ring-0 focus:border-b-2 focus:border-[#C4704A] disabled:cursor-not-allowed disabled:opacity-50"
        style={{ fontFamily: 'Lato, sans-serif', fontWeight: 400 }}
      >
        <span className={selected.length === 0 ? 'text-[#A9967E]' : 'text-[#2C2220]'}>
          {triggerLabel}
        </span>
        <ChevronDown
          size={16}
          className={`ml-2 shrink-0 text-[#A9967E] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* ── Dropdown panel ── */}
      {open && (
        <div
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-[#EDE5E0] bg-terra-50"
          style={{ boxShadow: '0 4px 16px rgba(54,32,23,0.12)' }}
        >
          <div className="flex" style={{ maxHeight: 300 }}>
            {/* ── Columna izquierda: categorías ── */}
            <div className="flex w-40 shrink-0 flex-col border-r border-[#EDE5E0] overflow-y-auto">
              {EMOTION_CATEGORIES.map((cat, idx) => {
                const selectedInCat = cat.subEmotions.filter((e) => selected.includes(e)).length;
                return (
                  <button
                    key={cat.label}
                    type="button"
                    onClick={() => setActiveCategory(idx)}
                    className={`flex items-center justify-between px-3 py-2.5 text-left text-sm transition-colors ${
                      activeCategory === idx ? 'bg-[#FAF7F5]' : 'hover:bg-[#FBF7F5]'
                    }`}
                    style={{
                      fontFamily: 'Lato, sans-serif',
                      fontWeight: 700,
                      color: cat.color,
                      borderLeft: activeCategory === idx ? `3px solid ${cat.color}` : '3px solid transparent',
                    }}
                  >
                    <span>{cat.label}</span>
                    {selectedInCat > 0 && (
                      <span
                        className="ml-1 rounded-full px-1.5 py-0.5 text-xs text-white"
                        style={{ backgroundColor: cat.color, fontSize: 10 }}
                      >
                        {selectedInCat}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* ── Columna derecha: sub-emociones ── */}
            <div className="flex-1 overflow-y-auto p-2">
              {EMOTION_CATEGORIES[activeCategory].subEmotions.map((emotion) => {
                const checked = selected.includes(emotion);
                return (
                  <label
                    key={emotion}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-[#2C2220] transition-colors hover:bg-[#FAF7F5]"
                    style={{ fontFamily: 'Lato, sans-serif', fontWeight: 400 }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(emotion)}
                      className="h-4 w-4 rounded border-[#C4A98A] accent-[#C4704A]"
                    />
                    {emotion}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Chips de emociones seleccionadas ── */}
      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((emotion) => (
            <span
              key={emotion}
              className="flex items-center gap-1 rounded-full bg-[#FAF7F5] px-2.5 py-0.5 text-xs text-[#2C2220]"
              style={{ fontFamily: 'Lato, sans-serif', fontWeight: 400 }}
            >
              {emotion}
              <button
                type="button"
                onClick={() => remove(emotion)}
                disabled={disabled}
                className="ml-0.5 rounded-full p-0.5 text-[#A9967E] transition-colors hover:text-[#C4704A] disabled:cursor-not-allowed"
                aria-label={`Quitar ${emotion}`}
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
