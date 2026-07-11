import { getApiErrorMessage } from '../../services/api';

export default function FormError({ error }: { error: unknown }) {
  if (!error) return null;

  return (
    <p role="alert" className="rounded-xl border border-expense/20 bg-expense/10 p-3 text-sm text-expense">
      {getApiErrorMessage(error)}
    </p>
  );
}
