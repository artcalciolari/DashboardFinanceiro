import { getApiErrorMessage } from '../../services/api';

export default function FormError({ error }: { error: unknown }) {
  if (!error) return null;

  return (
    <p role="alert" className="rounded-control border border-expense/25 bg-expense/5 px-3.5 py-3 text-[13px] font-medium text-expense">
      {getApiErrorMessage(error)}
    </p>
  );
}
