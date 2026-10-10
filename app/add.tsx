// app/add.tsx
// Add Transaction — thin wrapper around the shared TransactionForm.

import { useRouter } from 'expo-router';

import TransactionForm from '../src/components/TransactionForm';
import { useExpenses } from '../src/context/ExpenseContext';

export default function AddTransaction() {
  const router = useRouter();
  const { addTransaction } = useExpenses();

  return (
    <TransactionForm
      mode="add"
      onSubmit={async (values) => {
        await addTransaction(values);
        router.back();
      }}
    />
  );
}