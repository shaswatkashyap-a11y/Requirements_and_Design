import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  CalendarDays,
  Layers,
  FileText,
  Compass,
  GitBranch,
  FlaskConical,
  Rocket,
  Wrench,
  ShieldCheck,
  Zap,
  Database,
  BarChart2,
  Cpu,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

const navItems = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/',
  },
  {
    label: 'Planning',
    icon: CalendarDays,
    children: [],
  },
  {
    label: 'Analysis & Design',
    icon: Layers,
    children: [
      { label: 'Requirement Studio', icon: FileText, path: '/requirement-studio' },
      { label: 'Design Studio', icon: Compass, path: '/design-studio' },
    ],
  },
  {
    label: 'Code Quality & Analysis',
    icon: GitBranch,
    children: [],
  },
  {
    label: 'Testing',
    icon: FlaskConical,
    children: [],
  },
  {
    label: 'Deployment',
    icon: Rocket,
    children: [],
  },
  {
    label: 'Maintenance',
    icon: Wrench,
    children: [],
  },
  {
    label: 'Audit & Compliance',
    icon: ShieldCheck,
    children: [],
  },
  {
    label: 'Accelerators',
    icon: Zap,
    children: [],
  },
  {
    label: 'RAG',
    icon: Database,
    children: [],
  },
  {
    label: 'AI Dashboard Studio',
    icon: BarChart2,
    children: [],
  },
  {
    label: 'MCP',
    icon: Cpu,
    children: [],
  },
]

export default function Sidebar() {
  const location = useLocation()

  const defaultOpen = navItems.reduce((acc, item) => {
    if (item.children?.some((c) => location.pathname === c.path)) {
      acc[item.label] = true
    }
    return acc
  }, {})

  const [openMenus, setOpenMenus] = useState({ 'Analysis & Design': true, ...defaultOpen })

  const toggle = (label) => {
    setOpenMenus((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  return (
    <aside className="w-52 h-full bg-[#1a2035] flex flex-col flex-shrink-0">
      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3">
        {navItems.map((item) => {
          const Icon = item.icon
          const hasChildren = item.children && item.children.length > 0
          const isOpen = openMenus[item.label]

          if (!item.children) {
            // Direct nav link (Dashboard)
            return (
              <div key={item.label} className="px-3 py-0.5">
                <NavLink
                  to={item.path}
                  end
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 text-xs rounded-full cursor-pointer transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white font-medium'
                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`
                  }
                >
                  <Icon size={14} className="flex-shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              </div>
            )
          }

          return (
            <div key={item.label}>
              <div className="px-3 py-0.5">
                <button
                  onClick={() => toggle(item.label)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs text-slate-300 hover:bg-white/10 hover:text-white rounded-full transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon size={14} className="flex-shrink-0" />
                    <span>{item.label}</span>
                  </div>
                  {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              </div>

              {isOpen && hasChildren && (
                <div className="mt-0.5 mb-1">
                  {item.children.map((child) => {
                    const ChildIcon = child.icon
                    return (
                      <div key={child.label} className="px-3 py-0.5">
                        <NavLink
                          to={child.path}
                          className={({ isActive }) =>
                            `flex items-center gap-2.5 pl-7 pr-3 py-2 text-xs rounded-full transition-all ${
                              isActive
                                ? 'bg-blue-600 text-white font-medium'
                                : 'text-slate-400 hover:text-white hover:bg-white/10'
                            }`
                          }
                        >
                          <ChildIcon size={13} className="flex-shrink-0" />
                          <span>{child.label}</span>
                        </NavLink>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}