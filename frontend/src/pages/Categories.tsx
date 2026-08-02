import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { categoriesApi } from '../services/api';
import type { Category, CategoryType } from '../types';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import ColorPicker from '../components/ui/ColorPicker';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import FormError from '../components/ui/FormError';

interface FormState {
  name: string;
  type: CategoryType;
  color: string;
  icon: string;
}

const emptyForm: FormState = {
  name: '',
  type: 'EXPENSE',
  color: '#EF4444',
  icon: '',
};

export default function Categories() {
  const qc = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.getAll,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['categories'] });

  const createMutation = useMutation({
    mutationFn: categoriesApi.create,
    onSuccess: () => { invalidate(); closeModal(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Category> }) =>
      categoriesApi.update(id, data),
    onSuccess: () => { invalidate(); closeModal(); },
  });

  const deleteMutation = useMutation({
    mutationFn: categoriesApi.delete,
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
    },
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  }

  function openEdit(c: Category) {
    setEditing(c);
    setForm({ name: c.name, type: c.type, color: c.color, icon: c.icon ?? '' });
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditing(null);
    setForm(emptyForm);
    createMutation.reset();
    updateMutation.reset();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { name: form.name, type: form.type, color: form.color, icon: form.icon || undefined };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const expenses = categories.filter((c) => c.type === 'EXPENSE');
  const incomes = categories.filter((c) => c.type === 'INCOME');

  function CategoryRow(c: Category) {
    return (
      <div key={c.id} className="group flex items-center gap-3.5 rounded-2xl px-4 py-3 transition-colors hover:bg-[#FAF9F4]">
        <span
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px]"
          style={{ backgroundColor: c.color }}
        >
          <span className="h-3 w-3 rounded-[4px] bg-white/60" />
        </span>
        <div className="flex-1">
          <div className="text-sm font-semibold text-ink">{c.name}</div>
          <div className="text-xs text-faint">{c.type === 'INCOME' ? 'Receita' : 'Despesa'}</div>
        </div>
        <div className="flex gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
          <button
            onClick={() => openEdit(c)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-faint transition-colors hover:bg-white hover:text-forest"
            title="Editar categoria"
            aria-label={`Editar ${c.name}`}
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => setDeleteTarget(c)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-faint transition-colors hover:bg-white hover:text-expense"
            title="Excluir categoria"
            aria-label={`Excluir ${c.name}`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-[24px] font-bold tracking-tight text-ink">Categorias</h1>
          <p className="mt-1 text-sm text-muted">Organize suas receitas e despesas</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus size={16} />
          Nova categoria
        </Button>
      </div>

      {isLoading ? (
        <div className="card py-8 text-center text-faint">Carregando...</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="card p-2">
            <h3 className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-faint">Despesas</h3>
            {expenses.length === 0 ? (
              <p className="px-3 pb-2 text-sm text-faint">Nenhuma categoria</p>
            ) : (
              <div>{expenses.map(CategoryRow)}</div>
            )}
          </div>
          <div className="card p-2">
            <h3 className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-faint">Receitas</h3>
            {incomes.length === 0 ? (
              <p className="px-3 pb-2 text-sm text-faint">Nenhuma categoria</p>
            ) : (
              <div>{incomes.map(CategoryRow)}</div>
            )}
          </div>
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editing ? 'Editar categoria' : 'Nova categoria'} size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nome"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex: Alimentação, Salário..."
            required
          />
          <Select
            label="Tipo"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as CategoryType })}
          >
            <option value="EXPENSE">Despesa</option>
            <option value="INCOME">Receita</option>
          </Select>
          <ColorPicker
            label="Cor"
            value={form.color}
            onChange={(color) => setForm({ ...form, color })}
          />
          <FormError error={createMutation.error ?? updateMutation.error} />
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={closeModal}>Cancelar</Button>
            <Button type="submit" className="flex-1" loading={createMutation.isPending || updateMutation.isPending}>
              {editing ? 'Salvar' : 'Adicionar'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Excluir categoria"
        description={`Excluir "${deleteTarget?.name ?? ''}"? Transações que usam esta categoria podem impedir a exclusão.`}
        confirmLabel="Excluir"
        loading={deleteMutation.isPending}
        error={deleteMutation.error}
        onClose={() => {
          if (!deleteMutation.isPending) {
            setDeleteTarget(null);
            deleteMutation.reset();
          }
        }}
        onConfirm={() => {
          deleteMutation.mutate(deleteTarget!.id);
        }}
      />
    </div>
  );
}
