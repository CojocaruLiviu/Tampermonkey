// ==UserScript==
// @name         PandaTur - Check status_check_mode > 72h + Telegram
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Verifică rezervările status_check_mode > 72h și oferă opțiunea de a le trimite pe Telegram
// @author       You
// @match        https://online.pandatur.md/book/excursion/report*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const BOT_TOKEN = '8788383248:AAHF99BBMXWGo7XXkpcmFglMrHkxANJYZGU';
    const CHAT_ID  = '-5056055026';

    function parseDateTime(dateStr, timeStr) {
        const [day, month, year] = dateStr.trim().split('.').map(Number);
        const [hours, minutes, seconds] = timeStr.trim().split(':').map(Number);
        return new Date(year, month - 1, day, hours, minutes, seconds || 0);
    }

    async function sendToTelegram(links) {
        const text = `⚠️ Rezervări mai vechi de 72 ore cu clarificarea stării cererii\n` +
                 `⚠️ Бронирования старше 72 часов с уточнением статуса запроса (${links.length}):\n\n` +
                 links.join('\n');

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
        const limitMs = 72 * 60 * 60 * 1000; // 72 ore
        const oldLinks = [];

        rows.forEach(row => {
            const tds = row.querySelectorAll('td');
            let dateTd = null;

            for (const td of tds) {
                if (/\d{2}\.\d{2}\.\d{4}/.test(td.textContent)) {
                    dateTd = td;
                    break;
                }
            }

            if (!dateTd) return;

            const lines = dateTd.innerText.trim().split('\n').map(l => l.trim()).filter(Boolean);
            if (lines.length < 2) return;

            const dateStr = lines[0];
            const timeStr = lines[1];

            const reservationDate = parseDateTime(dateStr, timeStr);
            if (isNaN(reservationDate.getTime())) return;

            const ageMs = now - reservationDate;

            if (ageMs > limitMs) {
                const link = row.querySelector('a[href*="/book/bundle/edit/"]');
                if (link) {
                    oldLinks.push(link.href);
                }
            }
        });

        if (oldLinks.length === 0) {
            alert('Nu există rezervări mai vechi de 72 de ore.');
            return;
        }

        const message = `Găsite ${oldLinks.length} rezervări mai vechi de 72 de ore:\n\n` +
                        oldLinks.join('\n') +
                        `\n\n────────────────────\nVrei să le trimiți în grupul Telegram?`;

        const confirmSend = confirm(message);

        if (confirmSend) {
            sendToTelegram(oldLinks);
        }
    }

    function addButton() {
        if (document.getElementById('check-72h-btn')) return;

        // Caută secțiunea "Intervalul cererilor"
        const dateInputs = document.querySelector('#from_order') || document.querySelector('input[name="filter[from_order]"]');
        if (!dateInputs) return;

        const formGroup = dateInputs.closest('.form-group') || dateInputs.parentElement;

        const btn = document.createElement('button');
        btn.id = 'check-72h-btn';
        btn.type = 'button'; // important - să nu trimită formularul
        btn.textContent = 'Verifică > 72h';
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

        // Adaugă butonul sub câmpurile de dată
        formGroup.appendChild(btn);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addButton);
    } else {
        addButton();
    }

    // Reîncearcă după un scurt delay (formularul se poate încărca mai târziu)
    setTimeout(addButton, 1500);
    setTimeout(addButton, 3000);
})();
