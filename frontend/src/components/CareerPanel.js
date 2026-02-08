// src/components/CareerPanel.js
import React, { useState } from 'react';

function CareerPanel({ 
  careers, 
  currentCareer, 
  currentLevel, 
  playerStats, 
  onChooseCareer,
  onPromote 
}) {
  const [selectedPath, setSelectedPath] = useState(currentCareer || 'FOOD');

  const getCareerPath = () => {
    return careers[selectedPath];
  };

  const getCurrentLevelInfo = () => {
    const path = getCareerPath();
    if (!path) return null;
    return path.levels.find(l => l.id === currentLevel) || path.levels[0];
  };

  const getNextLevelInfo = () => {
    const path = getCareerPath();
    if (!path) return null;
    return path.levels.find(l => l.id === (currentLevel || 0) + 1);
  };

  const checkRequirements = (requirements) => {
    if (!requirements) return { met: true, missing: [] };
    if (!playerStats) return { met: false, missing: ['กรุณารอข้อมูลผู้เล่น'] };
    
    const missing = [];
    
    if (requirements.knowledge && (playerStats.knowledge || 0) < requirements.knowledge) {
      missing.push(`ความรู้ ${requirements.knowledge} (มี ${playerStats.knowledge || 0})`);
    }
    if (requirements.money && (playerStats.money || 0) < requirements.money) {
      missing.push(`เงิน ${requirements.money} (มี ${playerStats.money || 0})`);
    }
    if (requirements.health && (playerStats.health || 0) < requirements.health) {
      missing.push(`สุขภาพ ${requirements.health} (มี ${playerStats.health || 0})`);
    }
    if (requirements.happiness && (playerStats.happiness || 0) < requirements.happiness) {
      missing.push(`ความสุข ${requirements.happiness} (มี ${playerStats.happiness || 0})`);
    }
    if (requirements.workDays && (playerStats.workDays || 0) < requirements.workDays) {
      missing.push(`วันทำงาน ${requirements.workDays} (มี ${playerStats.workDays || 0})`);
    }
    if (requirements.network && (playerStats.network || 0) < requirements.network) {
      missing.push(`เครือข่าย ${requirements.network} คน (มี ${playerStats.network || 0})`);
    }
    
    return { met: missing.length === 0, missing };
  };

  const currentLevelInfo = getCurrentLevelInfo();
  const nextLevelInfo = getNextLevelInfo();
  const canPromote = nextLevelInfo && checkRequirements(nextLevelInfo.requirements).met;

  return (
    <div className="career-panel">
      <h3>💼 อาชีพและสายงาน</h3>

      {/* Career Path Selection */}
      <div className="career-paths">
        {Object.keys(careers).map(pathKey => {
          const path = careers[pathKey];
          return (
            <button
              key={pathKey}
              className={`career-path-btn ${selectedPath === pathKey ? 'active' : ''} ${currentCareer === pathKey ? 'current' : ''}`}
              onClick={() => setSelectedPath(pathKey)}
            >
              {path.name}
              {currentCareer === pathKey && <span className="badge">กำลังทำ</span>}
            </button>
          );
        })}
      </div>

      {/* Current Level */}
      {currentCareer && currentLevelInfo && (
        <div className="current-position">
          <h4>ตำแหน่งปัจจุบัน</h4>
          <div className="position-card current">
            <div className="position-header">
              <strong>Level {currentLevelInfo.id}</strong>
              <span className="title">{currentLevelInfo.title}</span>
            </div>
            <div className="position-details">
              <div className="salary">💰 {currentLevelInfo.salary} บาท/เทิร์น</div>
              {currentLevelInfo.benefits && Object.keys(currentLevelInfo.benefits).length > 0 && (
                <div className="benefits">
                  <strong>สิทธิพิเศษ:</strong>
                  <ul>
                    {currentLevelInfo.benefits.tipBonus && <li>💵 ทิป +{currentLevelInfo.benefits.tipBonus}</li>}
                    {currentLevelInfo.benefits.salesBonus && <li>📊 โบนัสยอดขาย {currentLevelInfo.benefits.salesBonus * 100}%</li>}
                    {currentLevelInfo.benefits.passive && <li>⭐ รายได้แบบ Passive</li>}
                    {currentLevelInfo.benefits.freeWorkout && <li>🏋️ ออกกำลังกายฟรี</li>}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Career Ladder */}
      <div className="career-ladder">
        <h4>เส้นทางความก้าวหน้า - {getCareerPath()?.name}</h4>
        
        <div className="levels-list">
          {getCareerPath()?.levels.map((level, index) => {
            const isCurrentLevel = currentCareer === selectedPath && level.id === currentLevel;
            const isPastLevel = currentCareer === selectedPath && level.id < (currentLevel || 1);
            const isNextLevel = currentCareer === selectedPath && level.id === (currentLevel || 0) + 1;
            const reqCheck = checkRequirements(level.requirements);

            return (
              <div 
                key={level.id}
                className={`level-card ${isCurrentLevel ? 'current' : ''} ${isPastLevel ? 'completed' : ''} ${isNextLevel ? 'next' : ''}`}
              >
                <div className="level-number">
                  {isPastLevel && '✓'}
                  {isCurrentLevel && '●'}
                  {!isPastLevel && !isCurrentLevel && level.id}
                </div>
                
                <div className="level-content">
                  <div className="level-header">
                    <strong>{level.title}</strong>
                    <span className="salary">💰 {level.salary}฿</span>
                  </div>
                  
                  {level.requirements && Object.keys(level.requirements).length > 0 && (
                    <div className="requirements">
                      <strong>เงื่อนไข:</strong>
                      <ul>
                        {level.requirements.knowledge && (
                          <li className={playerStats.knowledge >= level.requirements.knowledge ? 'met' : ''}>
                            🧠 ความรู้ {level.requirements.knowledge}
                          </li>
                        )}
                        {level.requirements.money && (
                          <li className={playerStats.money >= level.requirements.money ? 'met' : ''}>
                            💰 เงิน {level.requirements.money}
                          </li>
                        )}
                        {level.requirements.health && (
                          <li className={playerStats.health >= level.requirements.health ? 'met' : ''}>
                            ❤️ สุขภาพ {level.requirements.health}
                          </li>
                        )}
                        {level.requirements.workDays && (
                          <li className={(playerStats.workDays || 0) >= level.requirements.workDays ? 'met' : ''}>
                            📅 ทำงาน {level.requirements.workDays} วัน
                          </li>
                        )}
                        {level.requirements.network && (
                          <li className={(playerStats.network || 0) >= level.requirements.network ? 'met' : ''}>
                            👥 เครือข่าย {level.requirements.network} คน
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  {isNextLevel && (
                    <div className="promotion-status">
                      {reqCheck.met ? (
                        <span className="can-promote">✅ พร้อมเลื่อนตำแหน่ง!</span>
                      ) : (
                        <div className="missing-requirements">
                          <span className="cannot-promote">❌ ยังไม่พร้อม</span>
                          <div className="missing-list">
                            ขาด: {reqCheck.missing.join(', ')}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="career-actions">
        {!currentCareer && (
          <button 
            className="btn-choose-career"
            onClick={() => onChooseCareer(selectedPath)}
          >
            เลือกสายงาน {getCareerPath()?.name}
          </button>
        )}
        
        {currentCareer && currentCareer === selectedPath && nextLevelInfo && (
          <button 
            className="btn-promote"
            onClick={onPromote}
            disabled={!canPromote}
          >
            {canPromote ? '🎉 เลื่อนตำแหน่ง' : '🔒 ยังไม่พร้อมเลื่อนตำแหน่ง'}
          </button>
        )}
        
        {currentCareer && currentCareer !== selectedPath && (
          <div className="career-change-note">
            💡 คุณกำลังทำงานใน {careers[currentCareer]?.name} อยู่
          </div>
        )}
      </div>
    </div>
  );
}

export default CareerPanel;