import { useEffect, useRef, useState } from 'react';

const QUICK = ['👍', '😂', '😮', '😭', '🎉', '🔥', '🙏', '💸'];

export function ChatPanel({ chat, onSend, compact = false }) {
  const [text, setText] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.length]);

  const submit = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
  };

  return (
    <div className={`chat${compact ? ' is-compact' : ''}`}>
      <ul className="chat-list" ref={listRef}>
        {chat.length === 0 && <li className="muted chat-empty">ยังไม่มีข้อความ ทักทายเพื่อน ๆ ได้เลย</li>}
        {chat.map((m) => (
          <li key={m.id} className={m.system ? 'chat-system' : 'chat-msg'}>
            {!m.system && (
              <b style={{ color: m.color }}>{m.name}: </b>
            )}
            <span className={/^\p{Extended_Pictographic}+$/u.test(m.text) ? 'chat-emoji' : ''}>{m.text}</span>
          </li>
        ))}
      </ul>
      <div className="chat-quick">
        {QUICK.map((e) => (
          <button key={e} type="button" onClick={() => onSend(e)} aria-label={`ส่ง ${e}`}>
            {e}
          </button>
        ))}
      </div>
      <form className="chat-form" onSubmit={submit}>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder="พิมพ์ข้อความ…" aria-label="ข้อความแชท" />
        <button type="submit" className="btn btn-sm btn-primary" disabled={!text.trim()}>
          ส่ง
        </button>
      </form>
    </div>
  );
}
