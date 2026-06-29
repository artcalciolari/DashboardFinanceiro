import { createContext, useContext, useState, ReactNode } from 'react';

interface DateContextType {
  month: number;
  year: number;
  setMonth: (m: number) => void;
  setYear: (y: number) => void;
}

const now = new Date();

const DateContext = createContext<DateContextType>({
  month: now.getMonth() + 1,
  year: now.getFullYear(),
  setMonth: () => {},
  setYear: () => {},
});

export function DateProvider({ children }: { children: ReactNode }) {
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  return (
    <DateContext.Provider value={{ month, year, setMonth, setYear }}>
      {children}
    </DateContext.Provider>
  );
}

export function useDate() {
  return useContext(DateContext);
}
