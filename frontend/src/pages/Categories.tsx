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

  function CategoryList({ items, title }: { items: Category[]; title: string }) {
    return (
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
        {items.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhuma categoria</p>
        ) : (
          <div className="space-y-2">
            {items.map((c) => (
              <div key={c.id} className="flex items-center gap-3 group">
                <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                <span className="flex-1 text-sm text-gray-700">{c.name}</span>
                <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(c)}
                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="Editar categoria"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(c)}
                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Excluir categoria"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Categorias</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {categories.length} categorias · {expenses.length} despesa(s) · {incomes.length} receita(s)
          </p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus size={16} />
          Nova Categoria
        </Button>
      </div>

      {isLoading ? (
        <div className="card text-center py-8 text-gray-400">Carregando...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CategoryList items={expenses} title="Despesas" />
          <CategoryList items={incomes} title="Receitas" />
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editing ? 'Editar Categoria' : 'Nova Categoria'} size="sm">
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
        onClose={() => {
          if (!deleteMutation.isPending) setDeleteTarget(null);
        }}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />
    </div>
  );
}
