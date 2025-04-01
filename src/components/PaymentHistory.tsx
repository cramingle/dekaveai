import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { getPaymentHistory } from '@/lib/stripe';
import { LoadingSpinner } from '@/components/LoadingSpinner';

type Payment = {
  id: string;
  amount: number;
  status: string;
  date: string;
};

export function PaymentHistory() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    async function loadPayments() {
      if (!user?.stripeCustomerId) return;

      try {
        const history = await getPaymentHistory(user.stripeCustomerId);
        setPayments(history);
      } catch (err) {
        setError('Failed to load payment history');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }

    loadPayments();
  }, [user?.stripeCustomerId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner variant="small" color="#ffffff" message="Loading payment history..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg p-4">
        {error}
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-400">
        No payment history available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Payment History</h3>
      <div className="space-y-3">
        {payments.map((payment) => (
          <div
            key={payment.id}
            className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-white font-medium">
                  ${payment.amount.toFixed(2)} USD
                </p>
                <p className="text-sm text-zinc-400">
                  {new Date(payment.date).toLocaleDateString()}
                </p>
              </div>
              <span
                className={`px-2 py-1 text-xs font-medium rounded-full ${
                  payment.status === 'succeeded'
                    ? 'bg-green-500/10 text-green-500'
                    : payment.status === 'pending'
                    ? 'bg-yellow-500/10 text-yellow-500'
                    : 'bg-red-500/10 text-red-500'
                }`}
              >
                {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
              </span>
            </div>
            <div className="mt-2 text-xs font-mono text-zinc-500">
              ID: {payment.id}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 