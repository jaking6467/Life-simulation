// src/pages/LoginPage.js
import React, { useState } from 'react';

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username.trim()) {
      onLogin(username);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">

        {/* 🔥 โลโก้เกม */}
        <img 
          src="https://img2.pic.in.th/Gemini_Generated_Image_vzrrxpvzrrxpvzrr.png"
          alt="Game Logo"
          className="game-logo"
        />

        <h1>🎮 Life Simulation</h1>
        <p className="subtitle">แข่งขันจัดการชีวิต กับเพื่อน 4 คน!</p>

        {/* 🔥 ฟอร์มใส่ชื่อ */}
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="ใส่ชื่อของคุณ"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={20}
            autoFocus
          />
          <button type="submit" disabled={!username.trim()}>
            เข้าเล่น
          </button>
        </form>

        {/* 🔥 วิธีเล่น (ใช้ไอคอนรูปภาพแทนอีโมจิ) */}
        <div className="game-info">
          <h3>📖 วิธีเล่น</h3>
          <ul>
            <li>
              <img 
                src="https://cdn-icons-png.flaticon.com/512/3135/3135706.png"
                alt="money"
                className="info-icon"
              />
              <span>จัดการเงิน ความสุข พลังงาน ความรู้ สุขภาพ</span>
            </li>

            <li>
              <img 
                src="https://cdn-icons-png.flaticon.com/512/992/992700.png"
                alt="time"
                className="info-icon"
              />
              <span>แต่ละวันมี 30 วินาที ในการเลือกกิจกรรม</span>
            </li>

            <li>
              <img 
                src="https://cdn-icons-png.flaticon.com/512/1055/1055646.png"
                alt="random"
                className="info-icon"
              />
              <span>ระวังเหตุการณ์สุ่ม!</span>
            </li>

            <li>
              <img 
                src="https://cdn-icons-png.flaticon.com/512/2583/2583344.png"
                alt="trophy"
                className="info-icon"
              />
              <span>คะแนนสูงสุดชนะ!</span>
            </li>
          </ul>
        </div>

      </div>
    </div>
  );
}

export default LoginPage;
