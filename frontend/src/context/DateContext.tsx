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

export function DateProvider({
  children,
  initialMonth = now.getMonth() + 1,
  initialYear = now.getFullYear(),
}: {
  children: ReactNode;
  initialMonth?: number;
  initialYear?: number;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);

  return (
    <DateContext.Provider value={{ month, year, setMonth, setYear }}>
      {children}
    </DateContext.Provider>
  );
}

export function useDate() {
  return useContext(DateContext);
}
