import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { addBusinessDays } from '@/lib/business-days';

interface BatchRecord {
  id: string;
  batch_number: string;
  imported_at: string;
  total_orders: number;
  status: string;
}

interface CalendarEvent {
  batchId: string;
  batchNumber: string;
  date: Date;
  type: 'import' | 'delivery';
  totalOrders: number;
  importDate: Date;
  deliveryDate: Date;
  status: string;
}

interface BatchCalendarProps {
  batches: BatchRecord[];
  onBatchClick: (batchId: string) => void;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

function getBusinessDaysRemaining(deliveryDate: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const delivery = new Date(deliveryDate);
  delivery.setHours(0, 0, 0, 0);
  
  const diffTime = delivery.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export function BatchCalendar({ batches, onBatchClick }: BatchCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const events = useMemo(() => {
    const eventList: CalendarEvent[] = [];
    
    batches.forEach(batch => {
      const importDate = new Date(batch.imported_at);
      const deliveryDate = addBusinessDays(importDate, 20);
      
      // Import event
      eventList.push({
        batchId: batch.id,
        batchNumber: batch.batch_number,
        date: importDate,
        type: 'import',
        totalOrders: batch.total_orders,
        importDate,
        deliveryDate,
        status: batch.status,
      });
      
      // Delivery event
      eventList.push({
        batchId: batch.id,
        batchNumber: batch.batch_number,
        date: deliveryDate,
        type: 'delivery',
        totalOrders: batch.total_orders,
        importDate,
        deliveryDate,
        status: batch.status,
      });
    });
    
    return eventList;
  }, [batches]);

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const daysInPrevMonth = getDaysInMonth(year, month - 1);

  const calendarDays: Array<{ date: Date; isCurrentMonth: boolean }> = [];

  // Previous month days
  for (let i = firstDay - 1; i >= 0; i--) {
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    calendarDays.push({
      date: new Date(prevYear, prevMonth, daysInPrevMonth - i),
      isCurrentMonth: false,
    });
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push({
      date: new Date(year, month, i),
      isCurrentMonth: true,
    });
  }

  // Next month days
  const remainingDays = 42 - calendarDays.length;
  for (let i = 1; i <= remainingDays; i++) {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    calendarDays.push({
      date: new Date(nextYear, nextMonth, i),
      isCurrentMonth: false,
    });
  }

  const getEventsForDay = (date: Date) => {
    return events.filter(event => isSameDay(event.date, date));
  };

  const getDeliveryStatusColor = (deliveryDate: Date) => {
    const daysRemaining = getBusinessDaysRemaining(deliveryDate);
    
    if (daysRemaining < 0) {
      return 'bg-red-100 text-red-700 border-red-200';
    } else if (daysRemaining <= 5) {
      return 'bg-amber-100 text-amber-700 border-amber-200';
    } else {
      return 'bg-green-100 text-green-700 border-green-200';
    }
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setPopoverOpen(true);
  };

  const handleViewBatch = () => {
    if (selectedEvent) {
      setPopoverOpen(false);
      onBatchClick(selectedEvent.batchId);
    }
  };

  const eventsThisMonth = events.filter(event => 
    event.date.getFullYear() === year && event.date.getMonth() === month
  );

  return (
    <div className="space-y-6">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-foreground">
          {MONTHS[month]} {year}
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={goToPreviousMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Hoje
          </Button>
          <Button variant="outline" size="sm" onClick={goToNextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="border rounded-lg overflow-hidden bg-card">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 border-b bg-muted/50">
          {WEEKDAYS.map(day => (
            <div key={day} className="p-2 text-center text-xs font-semibold text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, idx) => {
            const dayEvents = getEventsForDay(day.date);
            const visibleEvents = dayEvents.slice(0, 3);
            const hiddenCount = dayEvents.length - 3;
            const isToday = isSameDay(day.date, new Date());

            return (
              <div
                key={idx}
                className={`min-h-[100px] border-r border-b p-1 ${
                  !day.isCurrentMonth ? 'bg-muted/20' : 'bg-background'
                } ${isToday ? 'ring-2 ring-primary ring-inset' : ''}`}
              >
                <div
                  className={`text-xs font-medium mb-1 ${
                    day.isCurrentMonth ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {day.date.getDate()}
                </div>
                <div className="space-y-1">
                  {visibleEvents.map((event, eventIdx) => {
                    const color = event.type === 'import'
                      ? 'bg-blue-100 text-blue-700 border-blue-200'
                      : getDeliveryStatusColor(event.deliveryDate);
                    
                    return (
                      <Popover key={eventIdx} open={popoverOpen && selectedEvent === event} onOpenChange={(open) => {
                        if (!open && selectedEvent === event) {
                          setPopoverOpen(false);
                          setSelectedEvent(null);
                        }
                      }}>
                        <PopoverTrigger asChild>
                          <button
                            onClick={() => handleEventClick(event)}
                            className={`w-full text-left px-1 py-0.5 rounded text-[10px] border truncate hover:opacity-80 transition-opacity ${color}`}
                          >
                            {event.type === 'import' ? '📥' : '📦'} {event.batchNumber}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80" align="start">
                          <div className="space-y-3">
                            <div>
                              <h4 className="font-bold text-foreground">{event.batchNumber}</h4>
                              <p className="text-xs text-muted-foreground">
                                {event.type === 'import' ? 'Data de Importação' : 'Data de Entrega'}
                              </p>
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Importado em:</span>
                                <span className="font-medium">{event.importDate.toLocaleDateString('pt-BR')}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Entrega prevista:</span>
                                <span className="font-medium">{event.deliveryDate.toLocaleDateString('pt-BR')}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Pedidos:</span>
                                <span className="font-medium">{event.totalOrders}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Status:</span>
                                <span className="font-medium capitalize">{event.status}</span>
                              </div>
                            </div>
                            <Button size="sm" className="w-full" onClick={handleViewBatch}>
                              Ver Lote
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    );
                  })}
                  {hiddenCount > 0 && (
                    <div className="text-[10px] text-muted-foreground px-1">
                      +{hiddenCount} mais
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Empty State */}
      {eventsThisMonth.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          Nenhum lote neste mês.
        </p>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 justify-center text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-blue-100 border border-blue-200"></div>
          <span className="text-muted-foreground">Data de Importação</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-green-100 border border-green-200"></div>
          <span className="text-muted-foreground">Entrega no Prazo</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-amber-100 border border-amber-200"></div>
          <span className="text-muted-foreground">Entrega Próxima (≤ 5 dias)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-red-100 border border-red-200"></div>
          <span className="text-muted-foreground">Entrega Atrasada</span>
        </div>
      </div>
    </div>
  );
}
