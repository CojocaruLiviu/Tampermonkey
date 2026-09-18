// ==UserScript==
// @name         PandaTur - Check status_check_mode > 72h + Telegram
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Verifică rezervările status_check_mode > 72h și oferă opțiunea de a le trimite pe Telegram
// @author       You
// @match        https://online.pandatur.md/book/excursion/report*
// @match        https://pandatur.md/book/excursion/report*
// @match        https://www.pandatur.md/book/excursion/report*
// @match        https://pandatur.md/book/bundle/index*
// @match        https://www.pandatur.md/book/bundle/index*
// @match        https://online.pandatur.md/book/bundle/index*
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
            // Caută celula cu data
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

            const dateStr = lines[0]; // 18.09.2026
            const timeStr = lines[1]; // 12:46:51

            const reservationDate = parseDateTime(dateStr, timeStr);
            if (isNaN(reservationDate.getTime())) return;

            const ageMs = now - reservationDate;

            if (ageMs > limitMs) {
                // Caută link-ul de edit
                const link = row.querySelector('a[href*="/book/bundle/edit/"]');
                if (link) {
                    // Eliminăm parametrii (?page=6 etc.)
                    const cleanUrl = link.href.split('?')[0];
                    oldLinks.push(cleanUrl);
                }
            }
        });

        if (oldLinks.length === 0) {
            alert('Nu există rezervări cu status_check_mode mai vechi de 72 de ore.');
            return;
        }

        const message = `Găsite ${oldLinks.length} rezervări mai vechi de 72 de ore:\n\n` +
                        oldLinks.join('\n') +
                        `\n\n────────────────────\nVrei să le trimiți în grupul Telegram?`;

        if (confirm(message)) {
            sendToTelegram(oldLinks);
        }
    }

function addButton() {
    if (document.getElementById('check-72h-btn')) return;

    // Căutăm secțiunea "Condiție"
    const conditionWrapper = Array.from(document.querySelectorAll('.report_form_checkbox_wrapper'))
        .find(el => el.querySelector('.report_form_checkbox_title')?.textContent.trim() === 'Condiție');

    if (!conditionWrapper) return;

    // Creăm butonul
    const btn = document.createElement('button');
    btn.id = 'check-72h-btn';
    btn.type = 'button';
    btn.textContent = 'Verifică > 72h';
    btn.style.cssText = `
        margin: 0 12px;
        padding: 8px 16px;
        background: #e67e22;
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        height: fit-content;
        align-self: center;
        white-space: nowrap;
    `;
    btn.onmouseover = () => btn.style.background = '#d35400';
    btn.onmouseout  = () => btn.style.background = '#e67e22';
    btn.onclick = checkOldReservations;

    // Inserăm butonul imediat după secțiunea "Condiție"
    conditionWrapper.after(btn);
}

    // Rulează când pagina e gata
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addButton);
    } else {
        addButton();
    }

    // Reîncearcă de câteva ori (pagina se încarcă dinamic)
    setTimeout(addButton, 1000);
    setTimeout(addButton, 2500);
    setTimeout(addButton, 4000);
})();
