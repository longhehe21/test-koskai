import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Landing page — user truy cập không qua QR sẽ thấy input nhập mã tra cứu.
 * User có QR → vào thẳng /t/:code bỏ qua trang này.
 */
export function HomePage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (trimmed.length < 5) return;
    navigate(`/t/${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="page">
      <div className="brand">
        <div className="brand-icon">K</div>
        <h1 className="brand-title">KioskAI</h1>
        <p className="brand-subtitle">Tra cứu trạng thái hồ sơ hành chính</p>
      </div>

      <form className="search-card" onSubmit={handleSubmit}>
        <label className="search-label" htmlFor="code">Nhập mã hồ sơ</label>
        <input
          id="code"
          type="text"
          className="search-input"
          placeholder="VD: KA-20260424-63F447"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          autoComplete="off"
          autoCapitalize="characters"
        />
        <button type="submit" className="search-btn" disabled={code.trim().length < 5}>
          Tra cứu
        </button>
      </form>

      <p className="hint">
        Mã hồ sơ nằm trên phiếu biên nhận hoặc mã QR bạn nhận được khi nộp hồ sơ tại kiosk.
      </p>
    </div>
  );
}
