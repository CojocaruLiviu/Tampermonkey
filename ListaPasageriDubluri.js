// ==UserScript==
// @name         PandaTour - Verificare locuri FAST
// @namespace    http://tampermonkey.net/
// @version      4.2
// @description  Verificare locuri + dubluri nume (RO + RU) – ordine inversă + Mr/Mrs/Chd
// @match        https://pandatur.md/*
// @match        https://www.pandatur.md/*
// @match        https://online.pandatur.md/*
// @run-at       document-start
// @grant        none
// ==/UserScript==
(function () {
    'use strict';
    let lastResult = '';
    let timer = null;

    // ============================================
    // PROGRAMARE ANALIZĂ
    // ============================================
    function scheduleAnalyze() {
        clearTimeout(timer);
        timer = setTimeout(() => {
            if (window.requestIdleCallback) {
                requestIdleCallback(analyze);
            } else {
                analyze();
            }
        }, 200);
    }

    // ============================================
    // CREARE PANOU
    // ============================================
    function createPanel() {
        let panel = document.getElementById('seat-checker-panel');
        if (panel) {
            return panel;
        }

        // Caută header-ul atât pe română cât și pe rusă
        const header = [...document.querySelectorAll(
            'header.card-header-tab.card-header'
        )].find(h => {
            const t = h.textContent || '';
            return t.includes('Lista pasagerilor') ||
                   t.includes('Список пассажиров') ||
                   t.includes('Список пасажирів');
        });

        if (!header) {
            return null;
        }

        panel = document.createElement('div');
        panel.id = 'seat-checker-panel';
        panel.style.cssText = `
            background: #fff8e1;
            border: 2px solid #ffc107;
            border-radius: 6px;
            padding: 10px;
            margin: 8px 0;
            font-size: 14px;
            line-height: 1.5;
        `;
        header.after(panel);
        return panel;
    }

    // ============================================
    // OBȚINE NUMĂRUL TOTAL DE LOCURI
    // ============================================
    function getTotalSeats() {
        const tables = document.querySelectorAll('table');
        for (const table of tables) {
            const text = table.innerText;
            // RO + RU
            if (
                (text.includes('Data') || text.includes('Дата')) &&
                (text.includes('Total') || text.includes('Всего') || text.includes('Разом')) &&
                (text.includes('Vîndut') || text.includes('Продано') || text.includes('Продано'))
            ) {
                const row = table.querySelector('tbody tr');
                if (!row) continue;
                const value = parseInt(row.cells[1]?.innerText, 10);
                if (!isNaN(value)) {
                    return value;
                }
            }
        }
        return 0;
    }

    // ============================================
    // NORMALIZARE NUME (ignoră Mr/Mrs/Chd + ordine)
    // ============================================
    function normalizeName(rawName) {
        if (!rawName) return '';

        // Elimină titlurile comune (RO + RU + EN)
        let cleaned = rawName
            .replace(/\b(mr|mrs|ms|miss|dr|prof|sir|madam|doamna|domnul|dna|dl|chd|child|реб|ребенок)\b\.?/gi, '')
            .replace(/[^\p{L}\s'-]/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();

        // Împarte în cuvinte și sortează → același set = aceeași persoană
        const words = cleaned.split(' ').filter(Boolean).sort();
        return words.join(' ');
    }

    // ============================================
    // ANALIZĂ LOCURI + DUBLURI NUME
    // ============================================
    function analyze() {
        // Detectează tabelul de pasageri pe RO sau RU
        const passengerTable = [...document.querySelectorAll('table')]
            .find(table => {
                const t = table.innerText;
                return (
                    (t.includes('Pașaport') || t.includes('Паспорт') || t.includes('Паспорт')) &&
                    (t.includes('Locuri') || t.includes('Места') || t.includes('Місця'))
                );
            });

        if (!passengerTable) {
            return;
        }

        const counts = {};
        const empty = [];
        let assigned = 0;
        const nameMap = {};

        // --------------------------------------------
        // CITIRE PASAGERI
        // --------------------------------------------
        passengerTable
            .querySelectorAll('tbody tr')
            .forEach((row) => {
                const cells = row.cells;
                if (cells.length < 7) return;

                const name = cells[3].innerText.trim();
                const seat = cells[6].innerText.trim();

                // Colectăm numele pentru dubluri
                if (name) {
                    const key = normalizeName(name);
                    if (key) {
                        if (!nameMap[key]) nameMap[key] = [];
                        nameMap[key].push(name);
                    }
                }

                // Fără loc
                if (!seat) {
                    empty.push(name);
                    return;
                }

                const nr = Number(seat);
                if (!nr) return;

                assigned++;
                counts[nr] = (counts[nr] || 0) + 1;
            });

        // --------------------------------------------
        // TOTAL LOCURI
        // --------------------------------------------
        const seatNumbers = Object.keys(counts).map(Number);
        const total =
            getTotalSeats() ||
            (seatNumbers.length ? Math.max(...seatNumbers) : 0);

        // --------------------------------------------
        // LOCURI LIPSĂ
        // --------------------------------------------
        const missing = [];
        for (let i = 1; i <= total; i++) {
            if (!counts[i]) missing.push(i);
        }

        // --------------------------------------------
        // LOCURI DUPLICATE
        // --------------------------------------------
        const duplicate = Object.entries(counts)
            .filter(([_, count]) => count > 1)
            .map(([number, count]) => `${number} (${count}x)`);

        // --------------------------------------------
        // DUBLURI NUME / PRENUME
        // --------------------------------------------
        const nameDuplicates = [];
        for (const originals of Object.values(nameMap)) {
            if (originals.length > 1) {
                nameDuplicates.push(
                    originals.map(n => `«${n}»`).join(' + ')
                );
            }
        }

        // --------------------------------------------
        // HTML PANOU
        // --------------------------------------------
        const html = `
            <h4 style="margin: 0 0 8px;">
                🚌 Verificare locuri
            </h4>
            <b>Total:</b> ${total}<br>
            <b>Atribuite:</b> ${assigned}
            <hr>
            <b style="color: #d32f2f;">
                🔴 Duplicate locuri
            </b>
            <br>
            ${duplicate.length ? duplicate.join(', ') : 'Nu există'}
            <hr>
            <b style="color: #f57c00;">
                🟡 Lipsesc
            </b>
            <br>
            ${missing.length ? missing.join(', ') : 'Nu există'}
            <hr>
            <b style="color: #1976d2;">
                ⚪ Fără loc (${empty.length})
            </b>
            <br>
            ${empty.length ? empty.join('<br>') : 'Nu există'}
            <hr>
            <b style="color: #7b1fa2;">
                🟣 Dublură Nume Prenume (${nameDuplicates.length})
            </b>
            <br>
            ${nameDuplicates.length ? nameDuplicates.join('<br>') : 'Nu există'}
            <br>
        `;

        if (html === lastResult) return;
        lastResult = html;

        const panel = createPanel();
        if (panel) {
            panel.innerHTML = html;
        }
    }

    // ============================================
    // OBSERVER DOM
    // ============================================
    const observer = new MutationObserver(() => {
        if (!document.body) return;
        const text = document.body.innerText;
        if (
            text.includes('Lista pasagerilor') ||
            text.includes('Список пассажиров') ||
            text.includes('Список пасажирів')
        ) {
            scheduleAnalyze();
        }
    });

    // ============================================
    // PORNIRE OBSERVER
    // ============================================
    const start = setInterval(() => {
        if (document.body) {
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
            clearInterval(start);
            scheduleAnalyze();
        }
    }, 50);
})();
