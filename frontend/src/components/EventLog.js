// src/components/EventLog.js
import React from 'react';

function EventLog({ events }) {
  const getEventClass = (event) => {
    if (event.type === 'global') return 'event-global';
    if (event.type === 'death') return 'event-death';
    if (event.isMe) return 'event-me';
    return 'event-other';
  };

  const getEventIcon = (event) => {
    if (event.type === 'global') return '🌍';
    if (event.type === 'death') return '💀';
    if (event.type === 'event') return '🎲';
    if (event.type === 'action') return '⚡';
    return '📌';
  };

  return (
    <div className="event-log">
      <h3>📜 บันทึกเหตุการณ์</h3>
      
      <div className="event-list">
        {events.length === 0 ? (
          <div className="no-events">ยังไม่มีเหตุการณ์</div>
        ) : (
          events.map((event, index) => (
            <div key={index} className={`event-item ${getEventClass(event)}`}>
              <span className="event-icon">{getEventIcon(event)}</span>
              <div className="event-content">
                {event.player && (
                  <span className="event-player">{event.player}: </span>
                )}
                <span className="event-message">{event.message}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default EventLog;
