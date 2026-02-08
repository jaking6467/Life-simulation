// src/components/ActionPanel.js
import React from 'react';

function ActionPanel({ onSelectAction, selectedAction, disabled, stats }) {
  const actions = [
    {
      id: 'work',
      name: '💼 ทำงาน',
      description: '+เงิน, -พลังงาน, +ความเครียด',
      cost: 0
    },
    {
      id: 'study',
      name: '📚 เรียน',
      description: '+ความรู้, -พลังงาน, -เงิน 30',
      cost: 30
    },
    {
      id: 'travel',
      name: '✈️ เที่ยว',
      description: '+ความสุข, -ความเครียด, -เงิน 200',
      cost: 200
    },
    {
      id: 'exercise',
      name: '🏃 ออกกำลังกาย',
      description: '+สุขภาพ, +ความสุข, -พลังงาน',
      cost: 0
    },
    {
      id: 'sleep',
      name: '😴 นอนหลับ',
      description: '+พลังงาน เต็ม, -ความเครียด',
      cost: 0
    },
    {
      id: 'invest',
      name: '📈 ลงทุน',
      description: 'เสี่ยง! อาจได้/เสีย, -เงิน 500',
      cost: 500
    },
    {
      id: 'hackOpponent',
      name: '🔪 แฮกคู่แข่ง',
      description: 'ลดเงินคู่แข่ง, -เงิน 300',
      cost: 300,
      special: true
    },
    {
      id: 'spreadRumor',
      name: '📢 ปล่อยข่าวลือ',
      description: 'ลดความสุขคู่แข่ง, -เงิน 200',
      cost: 200,
      special: true
    }
  ];

  const canAfford = (action) => {
    if (!stats) return true;
    return stats.money >= action.cost;
  };

  return (
    <div className="action-panel">
      <h3>⚡ เลือกกิจกรรม</h3>
      
      <div className="actions-grid">
        {actions.map(action => (
          <button
            key={action.id}
            className={`action-btn ${selectedAction === action.id ? 'selected' : ''} ${action.special ? 'special' : ''} ${!canAfford(action) ? 'cant-afford' : ''}`}
            onClick={() => onSelectAction(action.id)}
            disabled={disabled || !canAfford(action)}
          >
            <div className="action-name">{action.name}</div>
            <div className="action-desc">{action.description}</div>
            {!canAfford(action) && <div className="cant-afford-label">เงินไม่พอ</div>}
          </button>
        ))}
      </div>

      {selectedAction && (
        <div className="action-selected">
          ✅ เลือกแล้ว: <strong>{actions.find(a => a.id === selectedAction)?.name}</strong>
        </div>
      )}
    </div>
  );
}

export default ActionPanel;