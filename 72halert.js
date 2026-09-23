// ==UserScript==
// @name         PandaTur - Check status_check_mode > 72h + Telegram
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Verifică rezervările status_check_mode > 72h (doar utilizatori din listă) și oferă opțiunea de a le trimite pe Telegram
// @author       You
// @match        https://online.pandatur.md/book/excursion/report*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const BOT_TOKEN = '8788383248:AAHF99BBMXWGo7XXkpcmFglMrHkxANJYZGU';
    const CHAT_ID  = '-5056055026';

    // Lista de utilizatori permisă: nume → username Telegram
    const ALLOWED_USERS = {
        'GRAUR AURELIA': '@aurelua',
        'STIRBU TRAIAN': '@strain'
    };

    function parseDateTime(dateStr, timeStr) {
        const [day, month, year] = dateStr.trim().split('.').map(Number);
        const [hours, minutes, seconds] = timeStr.trim().split(':').map(Number);
        return new Date(year, month - 1, day, hours, minutes, seconds || 0);
    }

    // Extrage numele agentului din rând
// Extrage numele agentului din rând – versiune robustă
function extractAgentName(row) {
    const tds = row.querySelectorAll('td');

    for (const td of tds) {
        // Normalizăm tot textul: înlocuim newline + spații multiple cu un singur spațiu
        const text = td.innerText
            .replace(/\s+/g, ' ')
            .trim()
            .toUpperCase();          // comparăm case-insensitive

        for (const name of Object.keys(ALLOWED_USERS)) {
            if (text.includes(name.toUpperCase())) {
                return name;         // returnăm cheia originală din ALLOWED_USERS
            }
        }
    }
    return null;
}
    
    async function sendToTelegram(lines) {
        const text = `⚠️ Rezervări mai vechi de 72 ore cu clarificarea stării cererii\n` +
                     `⚠️ Бронирования старше 72 часов с уточнением статуса запроса (${lines.length}):\n\n` +
                     lines.join('\n');

        const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: CHAT_ID,
                    text: text,
                    disable_web_page_preview: true
                })
            });
            const data = await response.json();
            if (data.ok) {
                alert('✅ Trimis cu succes în grup!');
            } else {
                alert('❌ Eroare la trimitere:\n' + (data.description || 'Unknown error'));
            }
        } catch (err) {
            alert('❌ Eroare de rețea:\n' + err.message);
        }
    }

function checkOldReservations() {
    const rows = document.querySelectorAll('tr.status_check_mode');
    const now = new Date();
    const limitMs = 72 * 60 * 60 * 1000;
    const oldLines = [];

    rows.forEach((row, index) => {
        // 1. Caută agentul
        const agentName = extractAgentName(row);

        // DEBUG – vezi în Console (F12) ce se întâmplă
        console.log(`Rând ${index + 1}:`, {
            agentName,
            allowed: agentName ? ALLOWED_USERS[agentName] : null,
            rowText: row.innerText.substring(0, 150)
        });

        if (!agentName || !ALLOWED_USERS[agentName]) {
            return;
        }
        const username = ALLOWED_USERS[agentName];

        // 2. Extrage data (prima celulă care conține dd.mm.yyyy)
        const tds = row.querySelectorAll('td');
        let dateTd = null;
        for (const td of tds) {
            if (/\d{2}\.\d{2}\.\d{4}/.test(td.textContent)) {
                dateTd = td;
                break;
            }
        }
        if (!dateTd) {
            console.log(`Rând ${index + 1}: nu am găsit data`);
            return;
        }

        const lines = dateTd.innerText.trim().split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) {
            console.log(`Rând ${index + 1}: format dată invalid`, lines);
            return;
        }

        const dateStr = lines[0];
        const timeStr = lines[1];
        const reservationDate = parseDateTime(dateStr, timeStr);

        if (isNaN(reservationDate.getTime())) {
            console.log(`Rând ${index + 1}: dată invalidă`, dateStr, timeStr);
            return;
        }

        const ageMs = now - reservationDate;
        const ageHours = (ageMs / 3600000).toFixed(1);

        console.log(`Rând ${index + 1}: ${agentName} → ${ageHours} ore`);

        if (ageMs <= limitMs) return;

        // 3. Link
        const link = row.querySelector('a[href*="/book/bundle/edit/"]');
        if (!link) return;

        oldLines.push(`${link.href} ${username}`);
    });

    if (oldLines.length === 0) {
        alert('Nu există rezervări mai vechi de 72 de ore pentru utilizatorii din listă.\n\nDeschide Console (F12) pentru detalii.');
        return;
    }

    const message = `Găsite ${oldLines.length} rezervări mai vechi de 72 de ore:\n\n` +
                    oldLines.join('\n') +
                    `\n\n────────────────────\nVrei să le trimiți în grupul Telegram?`;

    if (confirm(message)) {
        sendToTelegram(oldLines);
    }
}
    

    function addButton() {
        if (document.getElementById('check-72h-btn')) return;

        const dateInputs = document.querySelector('#from_order') || document.querySelector('input[name="filter[from_order]"]');
        if (!dateInputs) return;

        const formGroup = dateInputs.closest('.form-group') || dateInputs.parentElement;

        const btn = document.createElement('button');
        btn.id = 'check-72h-btn';
        btn.type = 'button';
        btn.textContent = 'Exc Verifică > 72h';
        btn.style.cssText = `
            margin-top: 8px;
            padding: 6px 12px;
            background: #e67e22;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 13px;
            font-weight: bold;
            cursor: pointer;
            width: 100%;
        `;
        btn.onmouseover = () => btn.style.background = '#d35400';
        btn.onmouseout  = () => btn.style.background = '#e67e22';
        btn.onclick = checkOldReservations;

        formGroup.appendChild(btn);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addButton);
    } else {
        addButton();
    }

    setTimeout(addButton, 1500);
    setTimeout(addButton, 3000);
})();
