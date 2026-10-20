// จัดรูปแบบตัวเลขเงิน ใช้ทั้งฝั่งเซิร์ฟเวอร์และหน้าเว็บ

export function formatMoney(n) {
  const value = Math.round(Number(n) || 0);
  const sign = value < 0 ? '-' : '';
  return `${sign}฿${Math.abs(value).toLocaleString('en-US')}`;
}

// แบบย่อสำหรับช่องบนกระดาน เช่น ฿50K, ฿1.2M
export function formatShort(n) {
  const value = Math.round(Number(n) || 0);
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}฿${trim(abs / 1_000_000)}M`;
  if (abs >= 1000) return `${sign}฿${trim(abs / 1000)}K`;
  return `${sign}฿${abs}`;
}

function trim(x) {
  return x.toFixed(1).replace(/\.0$/, '');
}
