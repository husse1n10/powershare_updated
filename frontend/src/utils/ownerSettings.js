const business = ['phone2','business_name','company_name','company_address','company_street','company_city','capital_lbp','fiscal_number','registry_number'];
const billing = ['vat_rate','vat_enabled','usd_lbp_rate','invoice_prefix'];
export function ownerSettingsPayload(form, section) {
  const keys = section === 'billing' ? billing : section === 'business' ? business : section === 'invoice_labels' ? Object.keys(form).filter(k => k.startsWith('invoice_') || k === 'notes') : Object.keys(form);
  return Object.fromEntries(keys.filter(k => form[k] !== undefined && !(k === 'capital_lbp' && (form[k] == null || form[k] === ''))).map(k => [k, form[k]]));
}
