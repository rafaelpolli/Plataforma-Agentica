import type { ContractStatus, RequestStatus } from '../../types/dcm';

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  PENDING: 'bg-blue-50 text-blue-700 border-blue-200',
  APPROVED: 'bg-green-50 text-green-700 border-green-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  OPEN: 'bg-yellow-50 text-yellow-700 border-yellow-200',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  OPEN: 'Open',
};

interface Props {
  status: ContractStatus | RequestStatus;
}

export function StatusBadge({ status }: Props) {
  const style = STATUS_STYLES[status] || 'bg-gray-50 text-gray-700 border-gray-200';
  const label = STATUS_LABELS[status] || status;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${style}`}>
      {label}
    </span>
  );
}
