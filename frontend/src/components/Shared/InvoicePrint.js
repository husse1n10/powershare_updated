import React, { useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { formatDateUtcPlus2 } from '../../utils/timezone';

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const DEFAULT_AR = {
  title: '\u0641\u0627\u062A\u0648\u0631\u0629',
  recipientPrefix: '\u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u0645\u0646',
  item: '\u0627\u0644\u0635\u0646\u0641',
  old: '\u0642\u062F\u064A\u0645',
  current: '\u062C\u062F\u064A\u062F',
  usage: '\u0627\u0633\u062A\u0647\u0644\u0627\u0643',
  price: '\u0627\u0644\u0633\u0639\u0631',
  total: '\u0627\u0644\u0645\u062C\u0645\u0648\u0639 \u0627\u0644\u0639\u0627\u0645',
  issueDate: '\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0625\u0635\u062F\u0627\u0631',
  period: '\u0648\u0630\u0644\u0643 \u0639\u0646 \u0634\u0647\u0631',
  area: '\u0627\u0644\u0645\u0646\u0637\u0642\u0629',
  address: '\u0627\u0644\u0639\u0646\u0648\u0627\u0646',
  phone: '\u0647\u0627\u062A\u0641',
  meter: '\u0631\u0642\u0645 \u0627\u0644\u0639\u062F\u0627\u062F',
  billValue: '\u0642\u064A\u0645\u0629 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629',
  previousBalance: '\u0627\u0644\u0631\u0635\u064A\u062F \u0627\u0644\u0633\u0627\u0628\u0642',
  amountDue: '\u0627\u0644\u0645\u0637\u0644\u0648\u0628',
  amountReceived: '\u0627\u0644\u0645\u0628\u0644\u063A \u0627\u0644\u0645\u0642\u0628\u0648\u0636',
  remainingBalance: '\u0627\u0644\u0645\u062A\u0628\u0642\u064A',
  electricityItemPrefix: '\u0645\u0648\u062A\u0648\u0631',
  maintenancePrefix: '\u0631\u0633\u0645 \u0627\u0634\u062A\u0631\u0627\u0643',
  ampereWord: '\u0627\u0645\u0628\u064A\u0631',
};

function fmtInt(n) {
  return Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function fmtDec(n, digits = 2) {
  return Number(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fmtSignedAmount(n) {
  const numeric = Number(n || 0);
  const absValue = fmtDec(Math.abs(numeric), 2);
  return numeric < 0 ? `-${absValue}` : absValue;
}

function fmtReading(v) {
  if (v === null || v === undefined || v === '') return '-';
  const n = Number(v);
  if (Number.isNaN(n)) return v;
  if (Number.isInteger(n)) return fmtInt(n);
  return fmtDec(n, 2);
}

function fmtAmpere(v) {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return Number.isInteger(n) ? String(n) : String(n).replace(/\.?0+$/, '');
}

function asNumberOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function buildPrintDocument(invoiceNumber, contentHtml) {
  return `
    <html>
      <head>
        <title>Invoice ${invoiceNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 13px; margin: 20px; color: #111; }
          .invoice-paper { border: 1px solid #111; padding: 14px; }
          table { width: 100%; border-collapse: collapse; }
          td, th { border: 1px solid #222; padding: 6px 8px; }
          .center { text-align: center; }
          .right { text-align: right; }
          .bold { font-weight: 700; }
          .totals td { font-weight: 700; }
          .meta td { border: none; padding: 3px 0; }
          .meta-label { font-weight: 700; white-space: nowrap; padding-left: 12px; }
          .ltr { direction: ltr; unicode-bidi: plaintext; }
        </style>
      </head>
      <body>${contentHtml}</body>
    </html>
  `;
}

function openPrintWindow(invoiceNumber, contentHtml, targetWindow = null) {
  const win = targetWindow || window.open('', '_blank');
  if (!win) throw new Error('Unable to open print window');

  win.document.open();
  win.document.write(buildPrintDocument(invoiceNumber, contentHtml));
  win.document.close();

  const triggerPrint = () => {
    if (win.closed) return;
    win.focus();
    win.print();
  };

  win.onload = () => {
    setTimeout(triggerPrint, 20);
  };
  setTimeout(triggerPrint, 180);
}

function renderInvoicePaperHtml(bill, owner) {
  const mountNode = document.createElement('div');
  mountNode.setAttribute('aria-hidden', 'true');
  mountNode.style.position = 'fixed';
  mountNode.style.left = '-10000px';
  mountNode.style.top = '0';
  mountNode.style.width = '0';
  mountNode.style.height = '0';
  mountNode.style.overflow = 'hidden';
  mountNode.style.pointerEvents = 'none';
  document.body.appendChild(mountNode);

  const root = createRoot(mountNode);
  try {
    flushSync(() => {
      root.render(<InvoicePrint bill={bill} owner={owner} />);
    });

    const paperNode = mountNode.querySelector('.invoice-paper');
    if (!(paperNode instanceof HTMLElement)) {
      throw new Error('Could not render invoice');
    }

    return paperNode.outerHTML;
  } finally {
    root.unmount();
    mountNode.remove();
  }
}

export async function printInvoiceDirect({ bill, owner, targetWindow = null }) {
  if (!bill || !owner) {
    throw new Error('Invoice data is missing');
  }

  const paperHtml = renderInvoicePaperHtml(bill, owner);
  openPrintWindow(bill.invoice_number, paperHtml, targetWindow);
}

export default function InvoicePrint({ bill, owner, onClose }) {
  const ref = useRef();

  const handlePrint = () => {
    if (!ref.current) return;
    openPrintWindow(bill.invoice_number, ref.current.outerHTML);
  };

  if (!bill || !owner) return null;

  const labels = {
    title: owner.invoice_title || DEFAULT_AR.title,
    recipientPrefix: owner.invoice_recipient_prefix || DEFAULT_AR.recipientPrefix,
    item: owner.invoice_item_label || DEFAULT_AR.item,
    old: owner.invoice_old_label || DEFAULT_AR.old,
    current: owner.invoice_new_label || DEFAULT_AR.current,
    usage: owner.invoice_usage_label || DEFAULT_AR.usage,
    price: owner.invoice_price_label || DEFAULT_AR.price,
    total: owner.invoice_total_label || DEFAULT_AR.total,
    issueDate: owner.invoice_issue_date_label || DEFAULT_AR.issueDate,
    period: owner.invoice_period_label || DEFAULT_AR.period,
    area: owner.invoice_area_label || DEFAULT_AR.area,
    address: owner.invoice_address_label || DEFAULT_AR.address,
    phone: owner.invoice_phone_label || DEFAULT_AR.phone,
    meter: owner.invoice_meter_label || DEFAULT_AR.meter,
    billValue: DEFAULT_AR.billValue,
    previousBalance: DEFAULT_AR.previousBalance,
    amountDue: DEFAULT_AR.amountDue,
    amountReceived: DEFAULT_AR.amountReceived,
    remainingBalance: DEFAULT_AR.remainingBalance,
  };

  const issueDate = formatDateUtcPlus2(bill.generated_at);
  const combinedItems = Array.isArray(bill.combined_items) ? bill.combined_items : [];
  const isCombinedBill = combinedItems.length > 0;
  const periodText = isCombinedBill
    ? Array.from(new Set(
      combinedItems
        .map((item) => `${MONTHS[Number(item?.month || 0)] || Number(item?.month || 0)} ${Number(item?.year || 0)}`)
        .filter((value) => value && value !== '0 0')
    )).join(', ')
    : `${MONTHS[bill.month] || bill.month} ${bill.year}`;

  const kwhUsed = Number(bill.kwh_used || 0);
  const isFixedAmountBill = Number(bill.is_fixed_amount || 0) === 1;
  const electricityTotal = Number(bill.base_amount_lbp || 0);
  const maintenance = Number(bill.maintenance_lbp || 0);
  const unitPrice = !isFixedAmountBill && kwhUsed > 0 ? electricityTotal / kwhUsed : 0;
  const fixedAmountUsd = Number(bill.fixed_amount_usd || 0);

  const totalHt = Number(bill.total_ht_lbp || 0);
  const billVatRate = asNumberOrNull(bill.vat_rate);
  const ownerVatRate = asNumberOrNull(owner.vat_rate);
  const vatRate = billVatRate ?? ownerVatRate ?? 11;
  const vatAmount = Number(bill.vat_amount_lbp || 0);
  const totalTtc = Number(bill.total_ttc_lbp || 0);
  const rate = Number(bill.usd_lbp_rate || owner.usd_lbp_rate || 0);
  const usdFromHt = rate > 0 ? totalHt / rate : 0;
  const usdFinal = Number(bill.total_usd || 0);
  const previousBalanceLbp = Number(bill.previous_balance_lbp || 0);
  const previousBalanceUsd = Number(bill.previous_balance_usd || 0);
  const amountDueLbp = Number.isFinite(Number(bill.amount_due_lbp)) ? Number(bill.amount_due_lbp) : totalTtc;
  const amountDueUsd = Number.isFinite(Number(bill.amount_due_usd)) ? Number(bill.amount_due_usd) : usdFinal;
  const amountReceivedLbp = Number(bill.amount_received_lbp || 0);
  const amountReceivedUsd = Number(bill.amount_received_usd || 0);
  const remainingBalanceLbp = Number(bill.remaining_balance_lbp || 0);
  const remainingBalanceUsd = Number(bill.remaining_balance_usd || 0);

  const companyName = owner.company_name || owner.business_name || 'Generator Company';
  const companyMiddleLine = owner.company_address || [owner.company_city, owner.company_street].filter(Boolean).join(' - ');
  const companyRegLine = [
    owner.registry_number ? `RC#${owner.registry_number}` : '',
    owner.capital_lbp ? `Capital ${fmtInt(owner.capital_lbp)} LBP` : '',
  ].filter(Boolean).join(' - ');
  const fnLine = owner.fiscal_number ? `FN#${owner.fiscal_number}` : '';

  const recipient = bill.subscriber_name || '-';
  const areaValue = bill.generator_location || '-';
  const addressValue = bill.subscriber_address || '-';
  const phoneValue = bill.subscriber_phone || owner.phone || owner.phone2 || '-';
  const metaGroupStyle = { display: 'flex', flexDirection: 'column', gap: 2 };
  const metaRowStyle = {
    display: 'inline-flex',
    alignItems: 'baseline',
    gap: 8,
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
  };

  const baseline = Number(bill.initial_kwh_consumed || 0);
  let prevReading = asNumberOrNull(bill.prev_reading);
  let currentReading = asNumberOrNull(bill.current_reading);

  if (prevReading === null && currentReading === null && kwhUsed > 0) {
    prevReading = baseline;
    currentReading = baseline + kwhUsed;
  } else if (prevReading !== null && currentReading === null && kwhUsed > 0) {
    currentReading = prevReading + kwhUsed;
  }

  const renderCombinedItemRows = (item, index) => {
    const itemKwhUsed = Number(item?.kwh_used || 0);
    const itemIsFixed = Number(item?.is_fixed_amount || 0) === 1;
    const itemElectricityTotal = Number(item?.base_amount_lbp || 0);
    const itemMaintenance = Number(item?.maintenance_lbp || 0);
    const itemUnitPrice = !itemIsFixed && itemKwhUsed > 0 ? itemElectricityTotal / itemKwhUsed : 0;
    const itemTotalHt = Number(item?.total_ht_lbp || 0);
    const itemVatRate = asNumberOrNull(item?.vat_rate) ?? vatRate ?? 11;
    const itemVatAmount = Number(item?.vat_amount_lbp || 0);
    const itemTotalTtc = Number(item?.total_ttc_lbp || 0);
    let itemPrevReading = asNumberOrNull(item?.prev_reading);
    let itemCurrentReading = asNumberOrNull(item?.current_reading);
    if (itemPrevReading !== null && itemCurrentReading === null && itemKwhUsed > 0) {
      itemCurrentReading = itemPrevReading + itemKwhUsed;
    }

    const periodLabel = `${MONTHS[Number(item?.month || 0)] || Number(item?.month || 0)} ${Number(item?.year || 0)}`;
    const key = item?.bill_id ? `combined-item-${item.bill_id}` : `combined-item-${index}`;

    return (
      <React.Fragment key={key}>
        <tr className="center" style={{ background: '#f2f2f2', fontWeight: 700 }}>
          <td colSpan={6} className="right"><bdi>{periodLabel}</bdi></td>
        </tr>

        <tr className="center">
          <td className="right">
            {itemIsFixed ? (
              <span>Fixed Subscription Amount</span>
            ) : (
              <>
                <span>{DEFAULT_AR.electricityItemPrefix} </span>
                <bdi>{item?.generator_name || bill.generator_name || ''}</bdi>
              </>
            )}
          </td>
          <td className="ltr">{fmtReading(itemPrevReading)}</td>
          <td className="ltr">{fmtReading(itemCurrentReading)}</td>
          <td className="ltr">{itemKwhUsed > 0 ? fmtReading(itemKwhUsed) : '-'}</td>
          <td className="ltr">{itemIsFixed ? '-' : (itemKwhUsed > 0 ? fmtInt(itemUnitPrice) : '-')}</td>
          <td className="ltr bold">{fmtInt(itemElectricityTotal)}</td>
        </tr>

        {itemMaintenance > 0 && (
          <tr className="center">
            <td className="right">
              <span>{DEFAULT_AR.maintenancePrefix} </span>
              <bdi>{fmtAmpere(item?.ampere || bill.ampere)}</bdi>
              <span> {DEFAULT_AR.ampereWord}</span>
            </td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
            <td className="ltr">{fmtInt(itemMaintenance)}</td>
            <td className="ltr bold">{fmtInt(itemMaintenance)}</td>
          </tr>
        )}

        <tr className="totals center">
          <td colSpan={5} className="right">TOTAL H.T</td>
          <td className="ltr">{fmtInt(itemTotalHt)}</td>
        </tr>

        {!itemIsFixed && itemVatRate > 0 && (
          <tr className="totals center">
            <td colSpan={5} className="right"><span dir="ltr">V.A.T {fmtReading(itemVatRate)}%</span></td>
            <td className="ltr">{fmtInt(itemVatAmount)}</td>
          </tr>
        )}

        <tr className="totals center" style={{ fontSize: '1.05em' }}>
          <td colSpan={5} className="right">TOTAL T.T.C</td>
          <td className="ltr">{fmtInt(itemTotalTtc)}</td>
        </tr>
      </React.Fragment>
    );
  };

  return (
    <div>
      <div className="no-print d-flex gap-2 mb-3">
        <button className="btn btn-primary" onClick={handlePrint}>Print Invoice</button>
        {onClose && <button className="btn btn-outline-secondary" onClick={onClose}>Close</button>}
      </div>

      <div ref={ref} className="invoice-paper" dir="rtl" style={{ border: '1px solid #111', padding: 14, fontFamily: 'Arial, sans-serif' }}>
        <div style={{ direction: 'ltr', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'start', gap: 8 }}>
          <div className="bold ltr" style={{ fontSize: 22 }}>{bill.invoice_number}</div>
          <div className="bold center" style={{ fontSize: 30 }}>{labels.title}</div>
          <div className="bold right" style={{ fontSize: 24 }}><bdi>{companyName}</bdi></div>
        </div>

        {companyMiddleLine && (
          <div className="right" style={{ fontSize: 18, marginTop: 2 }}><bdi>{companyMiddleLine}</bdi></div>
        )}

        <div style={{ direction: 'ltr', display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #111', paddingBottom: 6, marginTop: 2, fontSize: 18, fontWeight: 700 }}>
          <div>{fnLine}</div>
          <div>{companyRegLine}</div>
        </div>

        <div className="right" style={{ fontSize: 20, fontWeight: 700, marginTop: 10 }}>
          {labels.recipientPrefix} <bdi>{recipient}</bdi>
        </div>

        <table style={{ marginTop: 10 }}>
          <thead>
            <tr className="bold center" style={{ background: '#f2f2f2' }}>
              <th>{labels.item}</th>
              <th>{labels.old}</th>
              <th>{labels.current}</th>
              <th>{labels.usage}</th>
              <th>{labels.price}</th>
              <th>{labels.total}</th>
            </tr>
          </thead>
          <tbody>
            {isCombinedBill ? (
              combinedItems.map((item, index) => renderCombinedItemRows(item, index))
            ) : (
              <>
                <tr className="center">
                  <td className="right">
                    {isFixedAmountBill ? (
                      <span>Fixed Subscription Amount</span>
                    ) : (
                      <>
                        <span>{DEFAULT_AR.electricityItemPrefix} </span>
                        <bdi>{bill.generator_name || ''}</bdi>
                      </>
                    )}
                  </td>
                  <td className="ltr">{fmtReading(prevReading)}</td>
                  <td className="ltr">{fmtReading(currentReading)}</td>
                  <td className="ltr">{kwhUsed > 0 ? fmtReading(kwhUsed) : '-'}</td>
                  <td className="ltr">{isFixedAmountBill ? '-' : (kwhUsed > 0 ? fmtInt(unitPrice) : '-')}</td>
                  <td className="ltr bold">{fmtInt(electricityTotal)}</td>
                </tr>

                {maintenance > 0 && (
                  <tr className="center">
                    <td className="right">
                      <span>{DEFAULT_AR.maintenancePrefix} </span>
                      <bdi>{fmtAmpere(bill.ampere)}</bdi>
                      <span> {DEFAULT_AR.ampereWord}</span>
                    </td>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                    <td className="ltr">{fmtInt(maintenance)}</td>
                    <td className="ltr bold">{fmtInt(maintenance)}</td>
                  </tr>
                )}

                <tr className="totals center">
                  <td colSpan={5} className="right">TOTAL H.T</td>
                  <td className="ltr">{fmtInt(totalHt)}</td>
                </tr>

                {!isFixedAmountBill && vatRate > 0 && (
                  <tr className="totals center">
                    <td colSpan={5} className="right"><span dir="ltr">V.A.T {fmtReading(vatRate)}%</span></td>
                    <td className="ltr">{fmtInt(vatAmount)}</td>
                  </tr>
                )}

                <tr className="totals center" style={{ fontSize: '1.1em' }}>
                  <td colSpan={5} className="right">TOTAL T.T.C</td>
                  <td className="ltr">{fmtInt(totalTtc)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>

        <div
          style={{
            marginTop: 8,
            display: 'grid',
            gridTemplateColumns: 'auto auto',
            justifyContent: 'center',
            columnGap: 56,
            rowGap: 8,
            direction: 'ltr',
          }}
        >
          <div style={{ ...metaGroupStyle, alignItems: 'flex-end' }}>
            <div style={metaRowStyle}>
              <span className="ltr"><bdi>{issueDate}</bdi></span>
              <span className="meta-label"><bdi>{labels.issueDate}</bdi></span>
            </div>
            <div style={metaRowStyle}>
              <span><bdi>{areaValue}</bdi></span>
              <span className="meta-label"><bdi>{labels.area}</bdi></span>
            </div>
            <div style={metaRowStyle}>
              <span><bdi>{addressValue}</bdi></span>
              <span className="meta-label"><bdi>{labels.address}</bdi></span>
            </div>
          </div>

          <div style={{ ...metaGroupStyle, alignItems: 'flex-end' }}>
            <div style={metaRowStyle}>
              <span><bdi>{periodText}</bdi></span>
              <span className="meta-label"><bdi>{labels.period}</bdi></span>
            </div>
            <div style={metaRowStyle}>
              <span className="ltr"><bdi>{bill.meter_number || '-'}</bdi></span>
              <span className="meta-label"><bdi>{labels.meter}</bdi></span>
            </div>
            <div style={metaRowStyle}>
              <span className="ltr"><bdi>{phoneValue}</bdi></span>
              <span className="meta-label"><bdi>{labels.phone}</bdi></span>
            </div>
          </div>
        </div>

        <div className="center ltr" style={{ marginTop: 12, fontSize: 16, fontWeight: 700 }}>
          {isFixedAmountBill
            ? `Fixed amount: ${fmtDec(fixedAmountUsd, 2)} USD`
            : `${fmtDec(totalHt, 2)}/${fmtDec(rate, 2)} = ${fmtDec(usdFromHt, 2)} USD${vatAmount > 0 ? ` + VAT ${fmtInt(vatAmount)} LBP` : ''}`}
        </div>

        <div className="center ltr" style={{ marginTop: 4, fontWeight: 700, fontSize: 16 }}>
          Amount Due: {fmtDec(amountDueUsd, 2)} USD
        </div>

        <table style={{ marginTop: 12 }}>
          <tbody>
            <tr className="center">
              <td className="right">{labels.billValue}</td>
              <td className="ltr">{fmtSignedAmount(usdFinal)} USD</td>
              <td className="ltr">{fmtSignedAmount(totalTtc)} LBP</td>
            </tr>
            <tr className="center">
              <td className="right">{labels.previousBalance}</td>
              <td className="ltr">{fmtSignedAmount(previousBalanceUsd)} USD</td>
              <td className="ltr">{fmtSignedAmount(previousBalanceLbp)} LBP</td>
            </tr>
            <tr className="center">
              <td className="right">{labels.amountDue}</td>
              <td className="ltr">{fmtSignedAmount(amountDueUsd)} USD</td>
              <td className="ltr">{fmtSignedAmount(amountDueLbp)} LBP</td>
            </tr>
            <tr className="center">
              <td className="right">{labels.amountReceived}</td>
              <td className="ltr">{fmtSignedAmount(amountReceivedUsd)} USD</td>
              <td className="ltr">{fmtSignedAmount(amountReceivedLbp)} LBP</td>
            </tr>
            <tr className="center totals" style={{ fontSize: '1.05em' }}>
              <td className="right">{labels.remainingBalance}</td>
              <td className="ltr">{fmtSignedAmount(remainingBalanceUsd)} USD</td>
              <td className="ltr">{fmtSignedAmount(remainingBalanceLbp)} LBP</td>
            </tr>
          </tbody>
        </table>

        {owner.notes && (
          <div className="center" style={{ marginTop: 10, fontStyle: 'italic' }}>{owner.notes}</div>
        )}

        <div className="center" style={{ marginTop: 10, fontWeight: 700, color: bill.status === 'paid' ? '#065f46' : '#9a3412' }}>
          {bill.status === 'paid'
            ? `PAID - ${bill.paid_at ? formatDateUtcPlus2(bill.paid_at) : ''}`
            : 'UNPAID'}
        </div>
      </div>
    </div>
  );
}
