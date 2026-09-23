// ==UserScript==
// @name         PandaTour - Verificare locuri FAST
// @namespace    http://tampermonkey.net/
// @version      4.1
// @description  Verificare locuri optimizată + detectare dubluri nume/prenume (inclusiv ordine inversă + Mr/Mrs)
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
        const header = [...document.querySelectorAll(
            'header.card-header-tab.card-header'
        )].find(h =>
            h.textContent.includes('Lista pasagerilor')
        );
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
            if (
                text.includes('Data') &&
                text.includes('Total') &&
                text.includes('Vîndut')
            ) {
                const row = table.querySelector('tbody tr');
                if (!row) {
                    continue;
                }
                const value = parseInt(
                    row.cells[1]?.innerText,
                    10
                );
                if (!isNaN(value)) {
                    return value;
                }
            }
        }
        return 0;
    }

    // ============================================
    // NORMALIZARE NUME (ignoră Mr/Mrs + ordine)
    // ============================================
    function normalizeName(rawName) {
        if (!rawName) return '';

        // Elimină titlurile comune (Mr, Mrs, Ms, Miss, etc.)
        let cleaned = rawName
            .replace(/\b(mr|mrs|ms|miss|dr|prof|sir|madam|doamna|domnul|dna|dl)\b\.?/gi, '')
            .replace(/[^\p{L}\s'-]/gu, ' ')   // păstrează litere, spații, apostrof, cratimă
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();

        // Împarte în cuvinte și sortează → același set de cuvinte = aceeași persoană
        const words = cleaned.split(' ').filter(Boolean).sort();
        return words.join(' ');
    }

    // ============================================
    // ANALIZĂ LOCURI + DUBLURI NUME
    // ============================================
    function analyze() {
        const passengerTable = [...document.querySelectorAll('table')]
            .find(table =>
                table.innerText.includes('Pașaport') &&
                table.innerText.includes('Locuri')
            );
        if (!passengerTable) {
            return;
        }

        const counts = {};
        const empty = [];
        let assigned = 0;

        // Mapă: cheie normalizată → lista de nume originale
        const nameMap = {};

        // --------------------------------------------
        // CITIRE PASAGERI
        // --------------------------------------------
        passengerTable
            .querySelectorAll('tbody tr')
            .forEach((row) => {
                const cells = row.cells;
                if (cells.length < 7) {
                    return;
                }

                const name = cells[3].innerText.trim();
                const seat = cells[6].innerText.trim();

                // Colectăm numele pentru verificarea dublurilor (chiar dacă nu are loc)
                if (name) {
                    const key = normalizeName(name);
                    if (key) {
                        if (!nameMap[key]) {
                            nameMap[key] = [];
                        }
                        nameMap[key].push(name);
                    }
                }

                // Pasager fără loc
                if (!seat) {
                    empty.push(name);
                    return;
                }

                const nr = Number(seat);
                if (!nr) {
                    return;
                }

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
            if (!counts[i]) {
                missing.push(i);
            }
        }

        // --------------------------------------------
        // LOCURI DUPLICATE
        // --------------------------------------------
        const duplicate = Object.entries(counts)
            .filter(([number, count]) => count > 1)
            .map(([number, count]) =>
                `${number} (${count}x)`
            );

        // --------------------------------------------
        // DUBLURI NUME / PRENUME (inclusiv ordine inversă)
        // --------------------------------------------
        const nameDuplicates = [];
        for (const [key, originals] of Object.entries(nameMap)) {
            if (originals.length > 1) {
                // Afișăm toate variantele găsite
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
            ${
                duplicate.length
                    ? duplicate.join(', ')
                    : 'Nu există'
            }
            <hr>
            <b style="color: #f57c00;">
                🟡 Lipsesc
            </b>
            <br>
            ${
                missing.length
                    ? missing.join(', ')
                    : 'Nu există'
            }
            <hr>
            <b style="color: #1976d2;">
                ⚪ Fără loc (${empty.length})
            </b>
            <br>
            ${
                empty.length
                    ? empty.join('<br>')
                    : 'Nu există'
            }
            <hr>
            <b style="color: #7b1fa2;">
                🟣 Dublură Nume Prenume (${nameDuplicates.length})
            </b>
            <br>
            ${
                nameDuplicates.length
                    ? nameDuplicates.join('<br>')
                    : 'Nu există'
            }
            <br>
        `;

        // --------------------------------------------
        // NU ACTUALIZA DOM DACĂ REZULTATUL NU S-A SCHIMBAT
        // --------------------------------------------
        if (html === lastResult) {
            return;
        }
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
        if (
            document.body &&
            document.body.innerText.includes('Lista pasagerilor')
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
