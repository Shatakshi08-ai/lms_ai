import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Descriptions, Input, Space, Table, Tag, Typography, Upload, message } from 'antd';
import { Link } from 'react-router-dom';
import Barcode from 'react-barcode';
import api from '../services/api.js';

const DECODE_ERROR = 'Unable to read this barcode. Please upload a clearer image.';

async function decodeWithDetector(file) {
  if (typeof window === 'undefined' || !('BarcodeDetector' in window)) return '';
  const detector = new window.BarcodeDetector({
    formats: ['code_128', 'code_39', 'codabar', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code', 'itf'],
  });
  const bmp = await createImageBitmap(file);
  const codes = await detector.detect(bmp);
  return codes[0]?.rawValue || '';
}

async function decodeWithHtml5(file) {
  const { Html5Qrcode } = await import('html5-qrcode');
  const id = `ql-file-scan-${Date.now()}`;
  const holder = document.createElement('div');
  holder.id = id;
  holder.style.display = 'none';
  document.body.appendChild(holder);
  const scanner = new Html5Qrcode(id, { verbose: false });
  try {
    const value = await scanner.scanFile(file, true);
    return String(value || '').trim();
  } finally {
    await scanner.clear().catch(() => {});
    holder.remove();
  }
}

export default function BarcodeTools({ onFound, onNotFound, onEdit }) {
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState('');
  const [result, setResult] = useState(null);
  const [missingCode, setMissingCode] = useState('');
  const [printOpen, setPrintOpen] = useState(false);
  const camRef = useRef(null);
  const html5Ref = useRef(null);

  useEffect(
    () => () => {
      html5Ref.current?.stop().catch(() => {});
      html5Ref.current?.clear().catch(() => {});
    },
    [],
  );

  async function lookup(code, source) {
    const value = String(code || '').trim();
    if (!value) {
      message.error(DECODE_ERROR);
      return;
    }
    setBusy(true);
    setMissingCode('');
    try {
      const { data } = await api.get(`/books/lookup/${encodeURIComponent(value)}`, { params: { source } });
      setResult(data);
      onFound?.(data);
      message.success(`Found ${data.book?.title || value}`);
    } catch (e) {
      setResult(null);
      setMissingCode(value);
      onNotFound?.(value);
      message.warning(e.response?.data?.message || 'Book not found for this barcode.');
    } finally {
      setBusy(false);
    }
  }

  async function startCamera() {
    setScanning(true);
    setTimeout(async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        const scanner = new Html5Qrcode('ql-barcode-camera', { verbose: false });
        html5Ref.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 8, qrbox: { width: 280, height: 120 } },
          (text) => {
            scanner.stop().catch(() => {});
            setScanning(false);
            lookup(text, 'scan');
          },
        );
      } catch {
        setScanning(false);
        message.error('Camera scanning is not available in this browser. Upload a barcode image instead.');
      }
    }, 50);
  }

  async function stopCamera() {
    await html5Ref.current?.stop().catch(() => {});
    await html5Ref.current?.clear().catch(() => {});
    html5Ref.current = null;
    setScanning(false);
  }

  async function onUpload(file) {
    setBusy(true);
    try {
      let value = '';
      try {
        value = await decodeWithDetector(file);
      } catch {
        value = '';
      }
      if (!value) {
        try {
          value = await decodeWithHtml5(file);
        } catch {
          value = '';
        }
      }
      if (!value) message.error(DECODE_ERROR);
      else await lookup(value, 'upload');
    } catch {
      message.error(DECODE_ERROR);
    } finally {
      setBusy(false);
    }
    return false;
  }

  const book = result?.book;
  const printValue = book?.barcode || book?.catalogId;

  return (
    <div className="space-y-4">
      <Space wrap>
        {!scanning ? (
          <Button type="primary" onClick={startCamera} loading={busy}>
            Scan barcode
          </Button>
        ) : (
          <Button onClick={stopCamera}>Stop camera</Button>
        )}
        <Upload accept="image/*" showUploadList={false} beforeUpload={onUpload}>
          <Button loading={busy}>Upload barcode</Button>
        </Upload>
        <Input.Search
          className="w-64"
          placeholder="Type barcode / ISBN / Book ID"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          onSearch={(v) => lookup(v, 'scan')}
          enterButton="Lookup"
          loading={busy}
        />
      </Space>
      {scanning && <div id="ql-barcode-camera" ref={camRef} className="max-w-md overflow-hidden rounded-md" />}

      {missingCode && (
        <Alert
          type="warning"
          showIcon
          message="Book Not Found"
          description={`No book matched “${missingCode}”. You can add it as a new title.`}
          action={
            <Button
              type="primary"
              onClick={() => {
                onNotFound?.(missingCode);
                message.info('Add Book form prefilled with the scanned code.');
              }}
            >
              Add New Book
            </Button>
          }
        />
      )}

      {book && (
        <Card
          title={
            <div className="flex flex-wrap items-center gap-3">
              {book.coverImage ? (
                <img src={book.coverImage} alt="" className="h-14 w-10 rounded object-cover" />
              ) : null}
              <span>{book.title}</span>
              <Tag color="green">Book Found</Tag>
            </div>
          }
          extra={
            <Space wrap>
              {onEdit && (
                <Button type="primary" onClick={() => onEdit(book, result)}>
                  Update book
                </Button>
              )}
              <Link to={`/catalog/${book._id}`}>
                <Button>Open details</Button>
              </Link>
              {printValue ? <Button onClick={() => setPrintOpen(true)}>View / Print barcode</Button> : null}
            </Space>
          }
        >
          <Descriptions size="small" bordered column={{ xs: 1, md: 2 }}>
            <Descriptions.Item label="Book ID">{book.catalogId || '—'}</Descriptions.Item>
            <Descriptions.Item label="Barcode">{book.barcode || result?.copy?.barcode || '—'}</Descriptions.Item>
            <Descriptions.Item label="Author">{(book.authors || []).join(', ') || '—'}</Descriptions.Item>
            <Descriptions.Item label="Category">{book.category || '—'}</Descriptions.Item>
            <Descriptions.Item label="ISBN">{book.isbn || '—'}</Descriptions.Item>
            <Descriptions.Item label="Availability">
              <Tag color={(book.availableCopies || 0) > 0 ? 'green' : 'gold'}>{book.status || '—'}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Copies">
              {book.availableCopies || 0} available / {book.totalCopies || 0}
            </Descriptions.Item>
            <Descriptions.Item label="Current status">{book.status || '—'}</Descriptions.Item>
          </Descriptions>
          {result.copy && (
            <Alert
              className="mt-3"
              type="info"
              showIcon
              message={`Physical copy ${result.copy.barcode} · ${result.copy.status}`}
            />
          )}
          <Typography.Title level={5} className="mt-4">
            Borrow / return
          </Typography.Title>
          <Table
            size="small"
            rowKey="_id"
            pagination={false}
            dataSource={result.loans || []}
            locale={{ emptyText: 'No active loans for this title.' }}
            columns={[
              { title: 'Reader', render: (_, r) => r.userId?.name || '—' },
              { title: 'Copy', render: (_, r) => r.copyId?.barcode || '—' },
              { title: 'Status', dataIndex: 'status' },
            ]}
          />
        </Card>
      )}
      {printOpen && printValue && (
        <div className="print-barcode rounded-md bg-white p-4">
          <p className="mb-2 font-medium">{book.title}</p>
          <p className="text-sm">{book.catalogId}</p>
          <Barcode value={printValue} />
          <Button className="mt-2" onClick={() => window.print()}>
            Print
          </Button>
        </div>
      )}
    </div>
  );
}
