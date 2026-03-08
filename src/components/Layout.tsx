import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  ShoppingCart,
  PlusCircle,
  Package,
  Users,
  LogOut,
  GraduationCap,
  HardDrive,
  Menu,
  X,
  ArrowLeftRight,
  ClipboardList,
  Layers,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { user, logout, switchRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isAdmin = user?.activeRole === 'admin';
  const isSupplier = user?.activeRole === 'supplier';
  const hasMultipleRoles = (user?.roles.length || 0) > 1;

  const navItems = [
    { to: '/dashboard', label: 'Painel', icon: LayoutDashboard, show: true },
    { to: '/orders', label: 'Pedidos', icon: ShoppingCart, show: true },
    { to: '/orders/new', label: 'Novo Pedido', icon: PlusCircle, show: isAdmin },
    { to: '/batches', label: 'Lotes', icon: Layers, show: isAdmin || isSupplier },
    { to: '/supplier-production', label: 'Lista de Pedidos', icon: ClipboardList, show: isSupplier && !isAdmin },
    { to: '/products', label: 'Produtos', icon: Package, show: isAdmin },
    { to: '/users', label: 'Usuários', icon: Users, show: isAdmin },
    { to: '/backups', label: 'Backups', icon: HardDrive, show: isAdmin },
  ].filter(i => i.show);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleSwitchRole = () => {
    if (!user) return;
    const newRole = user.activeRole === 'admin' ? 'supplier' : 'admin';
    switchRole(newRole);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex bg-muted">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform lg:translate-x-0 lg:static',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="p-5 flex items-center gap-3 border-b border-sidebar-border">
          <div className="w-9 h-9 rounded-xl bg-sidebar-primary flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h2 className="font-bold text-sm leading-tight">Visão Criativa</h2>
            <p className="text-[11px] text-sidebar-foreground/60">Uniformes</p>
          </div>
          <button className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                location.pathname === item.to
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <div className="px-3 py-2 mb-2">
            <p className="text-xs font-medium truncate">{user?.name}</p>
            <p className="text-[11px] text-sidebar-foreground/50">
              {user?.activeRole === 'admin' ? 'Administrador' : 'Fornecedor'}
              {hasMultipleRoles && ' (Master)'}
            </p>
          </div>
          {hasMultipleRoles && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSwitchRole}
              className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 mb-1"
            >
              <ArrowLeftRight className="w-4 h-4 mr-2" />
              Trocar para {user?.activeRole === 'admin' ? 'Fornecedor' : 'Admin'}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 bg-background border-b px-4 py-3 flex items-center gap-3 lg:px-6">
          <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-foreground truncate">
            {navItems.find(i => i.to === location.pathname)?.label || 'Visão Criativa'}
          </h1>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
