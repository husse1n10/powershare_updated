export function auditActorLabel(row, systemLabel = 'System') {
  return String(row.user_name || row.full_name || row.username || row.user_id || systemLabel);
}
