import { Button, Descriptions, Modal } from 'antd';
import dayjs from 'dayjs';
import { formatMoney } from '../utils/format.js';

export default function ReceiptModal({ open, onClose, fine, settings }) {
  if (!fine) return null;
  const symbol = settings?.currencySymbol || '₹';

  function print() {
    window.print();
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="Payment receipt"
      footer={[
        <Button key="p" type="primary" onClick={print}>
          Print / PDF
        </Button>,
      ]}
      width={640}
    >
      <div className="print-receipt border border-slate-200 p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="m-0 text-xl font-semibold text-navy">{settings?.libraryName || 'QuestLearn'}</h2>
            <p className="m-0 text-slate-500">Official fine receipt</p>
          </div>
          <div className="rounded border-2 border-teal-700 px-3 py-1 text-xs font-bold uppercase text-teal-700">
            Cashier stamp
          </div>
        </div>
        <Descriptions bordered size="small" column={1}>
          <Descriptions.Item label="Transaction ID">{fine.transactionId || '—'}</Descriptions.Item>
          <Descriptions.Item label="Member">{fine.userId?.name} ({fine.userId?.readerId})</Descriptions.Item>
          <Descriptions.Item label="Amount">{formatMoney(fine.amount, symbol)}</Descriptions.Item>
          <Descriptions.Item label="Method">{fine.paymentMethod || '—'}</Descriptions.Item>
          <Descriptions.Item label="Date">{fine.paymentDate ? dayjs(fine.paymentDate).format('DD MMM YYYY HH:mm') : '—'}</Descriptions.Item>
          <Descriptions.Item label="Status">{fine.status}</Descriptions.Item>
        </Descriptions>
      </div>
    </Modal>
  );
}
