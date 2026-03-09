/**
 * Calculate delivery date by adding business days (excluding weekends and Brazilian holidays)
 */
export function addBusinessDays(startDate: Date, days: number): Date {
  const brazilianHolidays = [
    '01-01', // New Year's Day
    '04-21', // Tiradentes  
    '05-01', // Labor Day
    '09-07', // Independence Day
    '10-12', // Our Lady of Aparecida
    '11-02', // All Souls' Day
    '11-15', // Proclamation of the Republic
    '11-20', // Black Awareness Day
    '12-25'  // Christmas Day
  ];
  
  let count = 0;
  let current = new Date(startDate);
  
  while (count < days) {
    current.setDate(current.getDate() + 1);
    const dayOfWeek = current.getDay();
    const monthDay = `${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
    
    // Skip weekends (Saturday = 6, Sunday = 0) and holidays
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !brazilianHolidays.includes(monthDay)) {
      count++;
    }
  }
  
  return current;
}