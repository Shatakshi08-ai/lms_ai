import Barcode from 'react-barcode';
import { Modal } from 'antd';

export default function BarcodeModal({ open, onClose, value, title }) {
  return (
    <Modal open={open} onCancel={onClose} footer={null} title={title || value}>
      {value && (
        <div className="flex justify-center py-4">
          <Barcode value={value} />
        </div>
      )}
    </Modal>
  );
}
