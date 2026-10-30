import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export type CustomSelectOption = {
  value: string | number
  label: string
  category?: string | null
  badge?: string | null
  description?: string | null
  icon?: ReactNode
}

type CustomSelectProps = {
  options: CustomSelectOption[]
  value: string | number
  onChange: (value: any) => void
  placeholder?: string
  searchable?: boolean
  searchPlaceholder?: string
  width?: string | number
  disabled?: boolean
  clearable?: boolean
  label?: string
  className?: string
  style?: CSSProperties
}

const DYNAMIC_CATEGORY_PALETTE = [
  {
    background: 'rgba(56, 189, 248, 0.16)',
    color: '#38bdf8',
    border: '1px solid rgba(56, 189, 248, 0.35)',
  },
  {
    background: 'rgba(168, 85, 247, 0.16)',
    color: '#c084fc',
    border: '1px solid rgba(168, 85, 247, 0.35)',
  },
  {
    background: 'rgba(236, 72, 153, 0.16)',
    color: '#f472b6',
    border: '1px solid rgba(236, 72, 153, 0.35)',
  },
  {
    background: 'rgba(34, 211, 238, 0.16)',
    color: '#22d3ee',
    border: '1px solid rgba(34, 211, 238, 0.35)',
  },
  {
    background: 'rgba(99, 102, 241, 0.16)',
    color: '#818cf8',
    border: '1px solid rgba(99, 102, 241, 0.35)',
  },
  {
    background: 'rgba(45, 212, 191, 0.16)',
    color: '#2dd4bf',
    border: '1px solid rgba(45, 212, 191, 0.35)',
  },
]

export function getCategoryBadgeStyle(category?: string | null) {
  if (!category) return null
  const cat = category.toUpperCase().trim()
  if (cat.includes('JEE')) {
    return {
      background: 'rgba(239, 68, 68, 0.16)',
      color: '#ff7676',
      border: '1px solid rgba(239, 68, 68, 0.35)',
    }
  }
  if (cat.includes('NEET')) {
    return {
      background: 'rgba(16, 185, 129, 0.16)',
      color: '#34d399',
      border: '1px solid rgba(16, 185, 129, 0.35)',
    }
  }
  if (cat.includes('FOUNDATION')) {
    return {
      background: 'rgba(245, 158, 11, 0.16)',
      color: '#fbbf24',
      border: '1px solid rgba(245, 158, 11, 0.35)',
    }
  }
  let hash = 0
  for (let i = 0; i < cat.length; i++) {
    hash = (hash * 31 + cat.charCodeAt(i)) >>> 0
  }
  return DYNAMIC_CATEGORY_PALETTE[hash % DYNAMIC_CATEGORY_PALETTE.length]
}

export default function CustomSelect({
  options,
  value,
  onChange,
  placeholder = '-- Select an option --',
  searchable = true,
  searchPlaceholder = 'Type to filter...',
  width = '100%',
  disabled = false,
  clearable = false,
  label,
  className = '',
  style,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number; openUpward: boolean } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const selectedOption = options.find((opt) => String(opt.value) === String(value))

  const updateMenuPosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const openUpward = spaceBelow < 260 && spaceAbove > spaceBelow
    setMenuPos({
      top: openUpward ? rect.top - 6 : rect.bottom + 6,
      left: rect.left,
      width: Math.max(rect.width, 220),
      openUpward,
    })
  }, [])

  // Close when clicking outside and reposition on scroll/resize
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        (!menuRef.current || !menuRef.current.contains(target))
      ) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }

    if (isOpen) {
      updateMenuPosition()
      document.addEventListener('mousedown', handleOutsideClick)
      document.addEventListener('keydown', handleKeyDown)
      window.addEventListener('scroll', updateMenuPosition, true)
      window.addEventListener('resize', updateMenuPosition)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', updateMenuPosition, true)
      window.removeEventListener('resize', updateMenuPosition)
    }
  }, [isOpen, updateMenuPosition])

  // Focus search input when opening
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50)
    }
    if (!isOpen) {
      setSearch('')
    }
  }, [isOpen, searchable])

  const filteredOptions = options.filter((opt) => {
    if (!search.trim()) return true
    const term = search.toLowerCase()
    return (
      opt.label.toLowerCase().includes(term) ||
      (opt.category && opt.category.toLowerCase().includes(term)) ||
      (opt.badge && opt.badge.toLowerCase().includes(term)) ||
      (opt.description && opt.description.toLowerCase().includes(term))
    )
  })

  return (
    <div
      ref={containerRef}
      className={`custom-select-container ${className}`}
      style={{
        position: 'relative',
        width: typeof width === 'number' ? `${width}px` : width,
        userSelect: 'none',
        ...style,
      }}
    >
      {label && (
        <label
          style={{
            display: 'block',
            marginBottom: '6px',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            fontWeight: 500,
          }}
        >
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <div
        ref={triggerRef}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => {
          if (disabled) return
          if (!isOpen) updateMenuPosition()
          setIsOpen((prev) => !prev)
        }}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            if (!isOpen) updateMenuPosition()
            setIsOpen((prev) => !prev)
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(18, 20, 26, 0.85)',
          border: isOpen
            ? '1px solid rgba(255, 94, 94, 0.55)'
            : '1px solid rgba(255, 255, 255, 0.14)',
          boxShadow: isOpen
            ? '0 0 0 3px rgba(255, 94, 94, 0.15), 0 4px 14px rgba(0, 0, 0, 0.3)'
            : '0 2px 6px rgba(0, 0, 0, 0.2)',
          borderRadius: '12px',
          padding: '10px 14px',
          color: selectedOption ? '#ffffff' : 'var(--text-secondary)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
          minHeight: '44px',
          boxSizing: 'border-box',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
          {selectedOption ? (
            <>
              {selectedOption.icon && <span style={{ flexShrink: 0 }}>{selectedOption.icon}</span>}
              <span
                style={{
                  fontWeight: 500,
                  fontSize: '0.9rem',
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {selectedOption.label}
              </span>
              {selectedOption.category && (
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    letterSpacing: '0.5px',
                    padding: '2px 7px',
                    borderRadius: '6px',
                    flexShrink: 0,
                    ...getCategoryBadgeStyle(selectedOption.category),
                  }}
                >
                  {selectedOption.category.toUpperCase()}
                </span>
              )}
              {selectedOption.badge && (
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    background: 'rgba(255, 255, 255, 0.1)',
                    color: 'var(--text-secondary)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    flexShrink: 0,
                  }}
                >
                  {selectedOption.badge}
                </span>
              )}
            </>
          ) : (
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{placeholder}</span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {clearable && selectedOption && (
            <span
              role="button"
              aria-label="Clear selection"
              onClick={(e) => {
                e.stopPropagation()
                onChange('')
              }}
              style={{
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '1rem',
                lineHeight: 1,
                padding: '2px 4px',
                borderRadius: '4px',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#ff7676')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)')}
            >
              ✕
            </span>
          )}

          {/* Smooth Rotating Chevron */}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              color: isOpen ? '#ff7676' : 'var(--text-secondary)',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), color 0.18s ease',
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {/* Floating Dropdown Menu rendered via Portal to escape any .glass-card backdrop-filter stacking context */}
      {isOpen &&
        menuPos &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            style={{
              position: 'fixed',
              top: menuPos.openUpward ? undefined : `${menuPos.top}px`,
              bottom: menuPos.openUpward ? `${window.innerHeight - menuPos.top}px` : undefined,
              left: `${menuPos.left}px`,
              width: `${menuPos.width}px`,
              background: '#141722',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              borderRadius: '14px',
              boxShadow: '0 22px 54px rgba(0, 0, 0, 0.88), 0 0 0 1px rgba(255, 94, 94, 0.18)',
              zIndex: 100000,
              maxHeight: '320px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              animation: 'fadeInSlideUp 0.16s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }}
          >
            {/* Integrated Search Input */}
            {searchable && options.length > 4 && (
              <div
                style={{
                  padding: '10px 12px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  background: '#0f121b',
                }}
              >
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{
                      position: 'absolute',
                      left: '10px',
                      color: 'var(--text-secondary)',
                      pointerEvents: 'none',
                    }}
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder={searchPlaceholder}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 10px 7px 32px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: '#ffffff',
                      fontSize: '0.85rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Options List */}
            <div
              style={{
                overflowY: 'auto',
                maxHeight: '260px',
                padding: '6px',
              }}
            >
              {filteredOptions.length === 0 ? (
                <div
                  style={{
                    padding: '24px 16px',
                    textAlign: 'center',
                    color: 'var(--text-secondary)',
                    fontSize: '0.85rem',
                  }}
                >
                  No matching options found.
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = String(opt.value) === String(value)
                  return (
                    <div
                      key={String(opt.value)}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onChange(opt.value)
                        setIsOpen(false)
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(255, 94, 94, 0.15)' : 'transparent',
                        color: isSelected ? '#ff7676' : '#f1f5f9',
                        border: isSelected
                          ? '1px solid rgba(255, 94, 94, 0.3)'
                          : '1px solid transparent',
                        transition: 'all 0.14s ease',
                        marginBottom: '2px',
                        gap: '10px',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          ;(e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.07)'
                          ;(e.currentTarget as HTMLElement).style.color = '#ffffff'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                          ;(e.currentTarget as HTMLElement).style.color = '#f1f5f9'
                        }
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                        {opt.icon && <span style={{ flexShrink: 0 }}>{opt.icon}</span>}
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: isSelected ? 600 : 500,
                              fontSize: '0.88rem',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {opt.label}
                          </div>
                          {opt.description && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              {opt.description}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        {opt.category && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              letterSpacing: '0.5px',
                              padding: '2px 7px',
                              borderRadius: '6px',
                              ...getCategoryBadgeStyle(opt.category),
                            }}
                          >
                            {opt.category.toUpperCase()}
                          </span>
                        )}
                        {opt.badge && (
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              background: 'rgba(255, 255, 255, 0.08)',
                              color: 'var(--text-secondary)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                            }}
                          >
                            {opt.badge}
                          </span>
                        )}
                        {isSelected && (
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#ff5e5e"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

