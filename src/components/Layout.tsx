import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LayoutDashboard,
  ShoppingCart,
  PlusCircle,
  Package,
  Users,
  HardDrive,
  Menu,
  X,
  ArrowLeftRight,
  LogOut,
  Settings,
  Bell,
  Search,
  GraduationCap,
  School,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { user, logout, switchRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isAdmin = user?.activeRole === 'admin';
  const hasMultipleRoles = (user?.roles.length || 0) > 1;

  const navItems = [
    { to: '/dashboard', label: 'Painel', icon: LayoutDashboard, show: true },
    { to: '/orders', label: 'Pedidos', icon: ShoppingCart, show: true },
    { to: '/orders/new', label: 'Novo Pedido', icon: PlusCircle, show: isAdmin },
    { to: '/products', label: 'Modelos', icon: Package, show: isAdmin },
    { to: '/schools', label: 'Escolas', icon: School, show: isAdmin },
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

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <div className="min-h-screen flex flex-col bg-muted">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 bg-card border-b shadow-sm">
        <div className="flex items-center h-14 px-4 lg:px-6 gap-3">
          {/* Mobile menu toggle */}
          <button className="lg:hidden" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-2 mr-4">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm hidden sm:inline text-foreground">Visão Criativa</span>
          </Link>

          {/* Search */}
          <div className="flex-1 max-w-md hidden md:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar..." className="pl-9 h-9 bg-muted border-none" />
            </div>
          </div>

          <div className="flex-1" />

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground">
            <Bell className="w-4 h-4" />
          </Button>

          {/* User Avatar Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-3 py-2">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {user?.activeRole === 'admin' ? 'Administrador' : 'Fornecedor'}
                </p>
              </div>
              <DropdownMenuSeparator />
              {hasMultipleRoles && (
                <DropdownMenuItem onClick={handleSwitchRole}>
                  <ArrowLeftRight className="w-4 h-4 mr-2" />
                  Trocar para {user?.activeRole === 'admin' ? 'Fornecedor' : 'Admin'}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <Settings className="w-4 h-4 mr-2" />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar */}
        <aside
          className={cn(
            'fixed inset-y-14 left-0 z-40 w-60 bg-sidebar text-sidebar-foreground flex flex-col transition-transform lg:translate-x-0 lg:static lg:inset-auto',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
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
        </aside>

        {/* Main content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto min-w-0">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
